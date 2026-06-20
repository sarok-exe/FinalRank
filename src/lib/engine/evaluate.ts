import { sum, round } from 'lodash-es';
import { ChessGame, EngineLine, STARTING_FEN } from '../../types';
import { Engine } from './index';
import { getCloudEvaluation } from './cloudEvaluate';
import { getCloudflareEvaluation, getSupabaseEvaluation, isCloudflareEvalConfigured, isSupabaseEvalConfigured } from './remoteEvaluate';

interface EvaluateMovesOptions {
  engineVersion: string;
  maxEngineCount?: number;
  engineDepth: number;
  engineTimeLimit?: number;
  engineLinesCount: number;
  engineConfig?: (engine: Engine) => void;
  onProgress?: (progress: number) => void;
}

interface EvaluationProcess {
  evaluate: () => Promise<ChessGame>;
  controller: AbortController;
}

function getOptimalEngineCount(requested?: number): number {
  const cpuCores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined;
  const available = cpuCores || 4;
  const max = Math.min(available, 8);
  return Math.min(requested || max, max);
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

  async function tryRemoteSource(
    fen: string,
    index: number,
    engineLines: EngineLine[][],
  ): Promise<void> {
    const promises: Promise<EngineLine[]>[] = [];

    if (isCloudflareEvalConfigured()) {
      promises.push(getCloudflareEvaluation(fen, options.engineDepth, options.engineLinesCount));
    }
    if (isSupabaseEvalConfigured()) {
      promises.push(getSupabaseEvaluation(fen, options.engineDepth, options.engineLinesCount));
    }

    if (promises.length === 0) return;

    const results = await Promise.allSettled(promises);
    let bestLines: EngineLine[] | null = null;
    let bestDepth = 0;

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const lines = result.value;
      const topDepth = lines.reduce((d, l) => Math.max(d, l.depth || 0), 0);
      if (topDepth > bestDepth) {
        bestDepth = topDepth;
        bestLines = lines;
      }
    }

    if (bestLines && bestDepth >= options.engineDepth && bestLines.length >= options.engineLinesCount) {
      engineLines[index] = bestLines;
      progresses[index] = 1;
    } else if (bestLines) {
      engineLines[index] = bestLines;
      progresses[index] = 0.5;
    }
  }

  async function evaluateAll(): Promise<ChessGame> {
    const updatedMoves = [...game.moves];
    const gameEngineLines: EngineLine[][] = Array.from({ length: fens.length }, () => []);

    // Phase 1: Cloud evaluation (lichess) - sequential with global timeout
    const cloudStartTime = Date.now();
    const CLOUD_TIMEOUT = 15000;
    for (let i = 1; i < fens.length; i++) {
      if (controller.signal.aborted) throw new Error('aborted');
      if (Date.now() - cloudStartTime > CLOUD_TIMEOUT) break;
      try {
        const cloudLines = await getCloudEvaluation(fens[i], options.engineLinesCount);
        const topLine = cloudLines.reduce((best, line) =>
          !best || line.depth > best.depth ? line : best,
          undefined as EngineLine | undefined
        );
        if (topLine && topLine.depth >= options.engineDepth && cloudLines.length >= options.engineLinesCount) {
          gameEngineLines[i] = cloudLines;
          progresses[i] = 1;
        }
      } catch {
        progresses[i] = 0.02;
      }
      options.onProgress?.(getProgress());
    }

    // Phase 2: Remote evaluation (Cloudflare Worker / Supabase Edge Function) - parallel batch
    if (isCloudflareEvalConfigured() || isSupabaseEvalConfigured()) {
      const remotePromises: Promise<void>[] = [];
      for (let i = 1; i < fens.length; i++) {
        if (controller.signal.aborted) throw new Error('aborted');
        if (progresses[i] < 1) {
          remotePromises.push(tryRemoteSource(fens[i], i, gameEngineLines));
        }
      }
      if (remotePromises.length > 0) {
        await Promise.allSettled(remotePromises);
        options.onProgress?.(getProgress());
      }
    }

    const evaluatedCount = gameEngineLines.filter(lines => lines.length > 0).length;
    if (evaluatedCount === fens.length - 1) {
      for (let i = 0; i < updatedMoves.length; i++) {
        updatedMoves[i] = { ...updatedMoves[i], engineLines: gameEngineLines[i + 1] || [] };
      }
      return { ...game, moves: updatedMoves };
    }

    // Phase 3: Local Stockfish engines - parallel using all available CPU cores
    await new Promise<void>((resolve, reject) => {
      let enginesResting = 0;
      let nextFenIndex = 1;
      const engines: Engine[] = [];

      function advanceToNextUnresolved(): number {
        while (nextFenIndex < fens.length && progresses[nextFenIndex] >= 1) {
          nextFenIndex++;
        }
        return nextFenIndex;
      }

      function evaluateNextPosition(engine: Engine, engineIndex: number) {
        if (controller.signal.aborted) {
          engine.terminate();
          if (++enginesResting === engines.length) reject(new Error('aborted'));
          return;
        }
        const currentFenIndex = advanceToNextUnresolved();
        if (currentFenIndex >= fens.length) {
          engine.terminate();
          if (++enginesResting === engines.length) resolve();
          return;
        }
        nextFenIndex = currentFenIndex + 1;

        const uciMoves = updatedMoves
          .slice(0, Math.min(currentFenIndex, updatedMoves.length))
          .filter(m => m.from && m.to)
          .map(m => m.from + m.to);

        engine.setPosition(startingFen, uciMoves);

        progresses[currentFenIndex] = 0.1;
        options.onProgress?.(getProgress());

        engine.evaluate({
          depth: options.engineDepth,
          timeLimit: options.engineTimeLimit ? options.engineTimeLimit * 1000 : undefined,
          onEngineLine: line => {
            progresses[currentFenIndex] = Math.max(progresses[currentFenIndex] || 0, line.depth / options.engineDepth);
            options.onProgress?.(getProgress());
          },
        }).then(lines => {
          progresses[currentFenIndex] = 1;
          gameEngineLines[currentFenIndex] = lines;
          options.onProgress?.(getProgress());
          evaluateNextPosition(engine, engineIndex);
        }).catch(() => {
          progresses[currentFenIndex] = 1;
          options.onProgress?.(getProgress());
          engine.terminate();
          const newEngine = new Engine(options.engineVersion);
          options.engineConfig?.(newEngine);
          newEngine.onError(() => {});
          engines[engineIndex] = newEngine;
          evaluateNextPosition(newEngine, engineIndex);
        });
      }

      const remainingCount = fens.length - 1 - evaluatedCount;
      const engineCount = Math.min(getOptimalEngineCount(options.maxEngineCount), remainingCount || 1);
      for (let i = 0; i < engineCount; i++) {
        const engine = new Engine(options.engineVersion);
        options.engineConfig?.(engine);
        engine.onError(() => {});
        engines.push(engine);
        evaluateNextPosition(engine, i);
      }

      controller.signal.addEventListener('abort', () => {
        engines.forEach(e => e.terminate());
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
