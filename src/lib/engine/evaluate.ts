import { sum, round } from 'lodash-es';
import { ChessGame, EngineLine, STARTING_FEN } from '../../types';
import { Engine } from './index';
import { getCloudEvaluation } from './cloudEvaluate';

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

    // Try cloud evaluation first for all positions
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

    // Locally evaluate positions that don't have cloud data
    const evaluatedCount = gameEngineLines.filter(lines => lines.length > 0).length;
    if (evaluatedCount === fens.length - 1) {
      // All positions had cloud data
      for (let i = 0; i < updatedMoves.length; i++) {
        updatedMoves[i] = { ...updatedMoves[i], engineLines: gameEngineLines[i + 1] || [] };
      }
      return { ...game, moves: updatedMoves };
    }

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
           const newEngine = new Engine(options.engineVersion);
           options.engineConfig?.(newEngine);
           newEngine.onError(() => {});
           engines[engineIndex] = newEngine;
           evaluateNextPosition(newEngine, engineIndex);
         });
      }

      const remainingCount = fens.length - 1 - evaluatedCount;
      const maxParallel = Math.min(options.maxEngineCount || 2, 4);
      const engineCount = Math.min(maxParallel, remainingCount || 1);
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
