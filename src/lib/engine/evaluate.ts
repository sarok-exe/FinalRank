import { sum, round } from 'lodash-es';
import type { ChessGame, EngineLine} from '../../types';
import { STARTING_FEN } from '../../types';
import { Engine } from './index';

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

function getOptimalEngineCount(_requested?: number): number {
  return 1;
}

export function getEngineVersion(_cores: number): string {
  // Always use single-threaded: multi-threaded requires SharedArrayBuffer
  // which needs Cross-Origin-Isolation headers (not available on Cloudflare Pages)
  return 'stockfish-18-lite-single.js';
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

    // Local Stockfish engine — analyze every position from scratch
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
          // Engine error — still mark position as resolved with empty lines
          // so the pipeline doesn't hang. Use at least one synthetic line.
          progresses[currentFenIndex] = 1;
          gameEngineLines[currentFenIndex] = [{
            evaluation: { type: 'centipawn', value: 0 },
            source: options.engineVersion as unknown as EngineLine['source'],
            depth: 1,
            index: 1,
            moves: [],
          }];
          options.onProgress?.(getProgress());
          const newEngine = new Engine(options.engineVersion);
          options.engineConfig?.(newEngine);
          newEngine.onError(() => {});
          engines[engineIndex] = newEngine;
          evaluateNextPosition(newEngine, engineIndex);
        });
      }

      const engineCount = Math.max(1, getOptimalEngineCount(options.maxEngineCount));
      for (let i = 0; i < engineCount; i++) {
        const engine = new Engine(options.engineVersion);
        options.engineConfig?.(engine);
        engine.onError(() => {});
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
