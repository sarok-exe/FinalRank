import { sum, round } from 'lodash-es';
import type { ChessGame, EngineLine, EvaluationResult } from '../../types';
import { STARTING_FEN } from '../../types';
import { Engine, getTopEngineLine } from './index';
import { getOpeningName } from '../reporter/utils/opening';

type EvaluateMovesOptions = {
  engineVersion: string;
  maxEngineCount?: number;
  engineDepth: number;
  engineTimeLimit?: number;
  engineLinesCount: number;
  engineConfig?(engine: Engine): void;
  onProgress?(progress: number): void;
}

type EvaluationProcess = {
  evaluate(): Promise<ChessGame>;
  controller: AbortController;
}

const fenCache = new Map<string, { lines: EngineLine[]; depth: number }>();

export function getOptimalEngineCount(requested?: number): number {
  return Math.max(1, Math.min(requested ?? 1, 8));
}

export function getEngineVersion(_cores: number): string {
  return 'stockfish-18-lite-single.js';
}

export function clearFenCache(): void {
  fenCache.clear();
}

function getCacheKey(fen: string, uciMoves: string[], depth: number): string {
  return `${fen}|${uciMoves.join(',')}|d${depth}`;
}

export function createGameEvaluator(
  game: ChessGame,
  options: EvaluateMovesOptions
): EvaluationProcess {
  const controller = new AbortController();
  const startingFen = game.initialPosition || STARTING_FEN;
  const moveCount = game.moves.length;
  const fens: string[] = [startingFen, ...game.moves.map(m => m.fen)];
  const progresses: number[] = new Array(fens.length).fill(0);

  function getProgress() {
    if (moveCount === 0) return 1;
    return round(sum(progresses.slice(1).map(p => Math.min(p, 1))) / moveCount, 3);
  }

  async function evaluateAll(): Promise<ChessGame> {
    const updatedMoves = [...game.moves];
    const gameEngineLines: EngineLine[][] = Array.from({ length: fens.length }, () => []);

    // Opening book: positions matching ECO book get a cheap 0-eval and skip engine work.
    // This saves up to 10-15 full engine calls for typical games.
    for (let i = 1; i < fens.length; i++) {
      if (getOpeningName(fens[i])) {
        gameEngineLines[i] = [{
          evaluation: { type: 'centipawn', value: 0 },
          source: options.engineVersion as unknown as EngineLine['source'],
          depth: 1,
          index: 1,
          moves: [],
        }];
        progresses[i] = 1;
      }
    }

    // Check FEN cache for remaining positions
    for (let i = 1; i < fens.length; i++) {
      if (progresses[i] >= 1) continue;
      const uciMoves = updatedMoves
        .slice(0, Math.min(i, updatedMoves.length))
        .filter(m => m.from && m.to)
        .map(m => m.from + m.to);
      const key = getCacheKey(startingFen, uciMoves, options.engineDepth);
      const cached = fenCache.get(key);
      if (cached && cached.depth >= options.engineDepth) {
        gameEngineLines[i] = cached.lines;
        progresses[i] = 1;
      }
    }

    await new Promise<void>((resolve, reject) => {
      let enginesResting = 0;
      let nextFenIndex = 1;
      const engines: Engine[] = [];
      const zeroLine: EngineLine = {
        evaluation: { type: 'centipawn', value: 0 },
        source: options.engineVersion as unknown as EngineLine['source'],
        depth: 1,
        index: 1,
        moves: [],
      };
      const MAX_SLOT_FAILURES = 3;
      const slotFailures: number[] = [];
      const positionTimeoutMs = options.engineTimeLimit
        ? options.engineTimeLimit * 1000 + 10000
        : 120000;

      function fillRemainingWithZeros(from: number) {
        for (let i = from; i < fens.length; i++) {
          if (progresses[i] < 1) {
            progresses[i] = 1;
            gameEngineLines[i] = [zeroLine];
          }
        }
        options.onProgress?.(getProgress());
      }

      function advanceToNextUnresolved(): number {
        while (nextFenIndex < fens.length && progresses[nextFenIndex] >= 1) {
          nextFenIndex++;
        }
        return nextFenIndex;
      }

      function spawnEngine(): Engine {
        const engine = new Engine(options.engineVersion);
        options.engineConfig?.(engine);
        engine.onError(() => {});
        return engine;
      }

      function settleSlot() {
        if (++enginesResting === engines.length) resolve();
      }

      function evaluatePosition(engine: Engine, engineIndex: number, currentFenIndex: number, attempt: number) {
        if (controller.signal.aborted) {
          engine.terminate();
          settleSlot();
          return;
        }

        const uciMoves = updatedMoves
          .slice(0, Math.min(currentFenIndex, updatedMoves.length))
          .filter(m => m.from && m.to)
          .map(m => m.from + m.to);

        engine.setPosition(startingFen, uciMoves);

        progresses[currentFenIndex] = 0.1;
        options.onProgress?.(getProgress());

        let timer: ReturnType<typeof setTimeout> | undefined;
        const failPosition = () => {
          if (timer) { clearTimeout(timer); timer = undefined; }
          engine.terminate();
          if (controller.signal.aborted) { settleSlot(); return; }
          // Retry the position once on a fresh worker before giving up on it, so a
          // single bad spawn can't lose a move.
          if (attempt < 1) {
            const fresh = spawnEngine();
            engines[engineIndex] = fresh;
            evaluatePosition(fresh, engineIndex, currentFenIndex, attempt + 1);
            return;
          }
          // Give up on this position only — mark it zero and keep the rest of the
          // game. A failed move must never strand the remaining tail.
          progresses[currentFenIndex] = 1;
          gameEngineLines[currentFenIndex] = [zeroLine];
          options.onProgress?.(getProgress());
          if (++slotFailures[engineIndex] >= MAX_SLOT_FAILURES) {
            // This slot keeps failing (broken engine env). Retire it. If every
            // slot retires, fill the remaining tail so analysis still completes.
            if (++enginesResting === engines.length) {
              fillRemainingWithZeros(nextFenIndex);
              resolve();
            }
            return;
          }
          const fresh = spawnEngine();
          engines[engineIndex] = fresh;
          evaluateNextPosition(fresh, engineIndex);
        };

        timer = setTimeout(failPosition, positionTimeoutMs);

        engine.evaluate({
          depth: options.engineDepth,
          timeLimit: options.engineTimeLimit ? options.engineTimeLimit * 1000 : undefined,
          onEngineLine: line => {
            progresses[currentFenIndex] = Math.max(progresses[currentFenIndex] || 0, line.depth / options.engineDepth);
            options.onProgress?.(getProgress());
          },
        }).then(lines => {
          if (timer) { clearTimeout(timer); timer = undefined; }
          if (controller.signal.aborted) { engine.terminate(); settleSlot(); return; }
          progresses[currentFenIndex] = 1;
          gameEngineLines[currentFenIndex] = lines;
          const key = getCacheKey(startingFen, uciMoves, options.engineDepth);
          fenCache.set(key, { lines, depth: options.engineDepth });
          if (fenCache.size > 5000) {
            const first = fenCache.keys().next().value;
            if (first) fenCache.delete(first);
          }
          options.onProgress?.(getProgress());
          evaluateNextPosition(engine, engineIndex);
        }).catch(() => {
          failPosition();
        });
      }

      function evaluateNextPosition(engine: Engine, engineIndex: number) {
        if (controller.signal.aborted) {
          engine.terminate();
          settleSlot();
          return;
        }
        const currentFenIndex = advanceToNextUnresolved();
        if (currentFenIndex >= fens.length) {
          engine.terminate();
          settleSlot();
          return;
        }
        nextFenIndex = currentFenIndex + 1;
        evaluatePosition(engine, engineIndex, currentFenIndex, 0);
      }

      const engineCount = Math.max(1, getOptimalEngineCount(options.maxEngineCount));
      for (let i = 0; i < engineCount; i++) {
        slotFailures.push(0);
        const engine = spawnEngine();
        engines.push(engine);
        evaluateNextPosition(engine, i);
      }

      controller.signal.addEventListener('abort', () => {
        engines.forEach(e => { e.terminate(); });
        if (!enginesResting) reject(new Error('aborted'));
      });
    });

    for (let i = 0; i < updatedMoves.length; i++) {
      updatedMoves[i] = {
        ...updatedMoves[i],
        engineLines: gameEngineLines[i + 1] || [],
      };
    }

    return { ...game, moves: updatedMoves };
  }

  return { evaluate: evaluateAll, controller };
}

export function createPositionEvaluator(
  fen: string,
  options: { depth: number; linesCount?: number; engineVersion?: string }
): { evaluate(): Promise<EngineLine[]>; controller: AbortController } {
  const controller = new AbortController();

  // Every engine spawned across the initial attempt and the retry; the abort
  // listener terminates all of them.
  const engines: Engine[] = [];

  function spawnEngine(): Engine {
    const engine = new Engine(options.engineVersion ?? 'stockfish-18-lite-single.js');
    engine.setLineCount(options.linesCount ?? 2);
    engine.onError(() => {});
    engine.setPositionQuiet(fen);
    engines.push(engine);
    return engine;
  }

  // Holds the reject of the in-flight evaluate() promise so the abort listener
  // can reject it with 'aborted' (treated as a non-error by the app).
  let rejectEvaluate: ((reason: Error) => void) | null = null;

  async function evaluate(): Promise<EngineLine[]> {
    const key = getCacheKey(fen, [], options.depth);
    const cached = fenCache.get(key);
    if (cached && cached.depth >= options.depth) {
      engines.forEach(e => e.terminate());
      return cached.lines;
    }

    return new Promise<EngineLine[]>((resolve, reject) => {
      rejectEvaluate = reject;

      const runAttempt = (attempt: number): void => {
        const engine = spawnEngine();
        engine.evaluate({ depth: options.depth }).then(lines => {
          rejectEvaluate = null;
          fenCache.set(key, { lines, depth: options.depth });
          if (fenCache.size > 5000) {
            const first = fenCache.keys().next().value;
            if (first) fenCache.delete(first);
          }
          engines.forEach(e => e.terminate());
          resolve(lines);
        }).catch(err => {
          // Once aborted, never retry — surface the abort to the caller.
          if (controller.signal.aborted) {
            rejectEvaluate = null;
            reject(new Error('aborted'));
            return;
          }
          // Worker/WASM failures are often transient (e.g. a dropped worker
          // after the tab sat idle); retry once with a fresh engine.
          if (attempt < 2) {
            engine.terminate();
            runAttempt(attempt + 1);
          } else {
            rejectEvaluate = null;
            engines.forEach(e => e.terminate());
            reject(err);
          }
        });
      };

      runAttempt(1);
    });
  }

  controller.signal.addEventListener('abort', () => {
    engines.forEach(e => e.terminate());
    if (rejectEvaluate) {
      rejectEvaluate(new Error('aborted'));
      rejectEvaluate = null;
    }
  });

  return { evaluate, controller };
}

export function getEvaluationResultFromLines(lines: EngineLine[]): EvaluationResult | undefined {
  const line = getTopEngineLine(lines);
  if (!line) return undefined;
  let score: number;
  if (line.evaluation.type === 'centipawn') {
    score = line.evaluation.value / 100;
  } else if (line.evaluation.value > 0) {
    score = 10;
  } else {
    score = -10;
  }
  return {
    score,
    isMate: line.evaluation.type === 'mate',
    mateIn: line.evaluation.type === 'mate' ? line.evaluation.value : undefined,
    depthReached: line.depth,
    bestMove: line.moves?.[0]?.uci,
    pv: line.moves.map(m => m.san),
  };
}
