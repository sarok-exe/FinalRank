import { Chess } from 'chess.js';
import { Engine, getTopEngineLine } from './index';
import { EvaluationResult, EngineGoMode } from '../../types';

let engineInstance: Engine | null = null;

function getEngine(): Engine {
  if (!engineInstance) {
    engineInstance = new Engine();
  }
  return engineInstance;
}

export function destroyEngine() {
  if (engineInstance) {
    engineInstance.terminate();
    engineInstance = null;
  }
}

export async function analyzePositionLocally(
  fen: string,
  options: { depth?: number; timeLimit?: number; goMode?: EngineGoMode } = {}
): Promise<EvaluationResult> {
  const depth = options.depth ?? 8;
  const goMode = options.goMode ?? 'depth';
  try {
    const engine = getEngine();
    engine.setPosition(fen);
    const evaluateOpts: { depth: number; goMode?: 'depth' | 'time'; timeLimit?: number } = { depth, goMode };
    if (goMode === 'time' && options.timeLimit) {
      evaluateOpts.timeLimit = options.timeLimit;
    }
    const lines = await engine.evaluate(evaluateOpts);
    const topLine = getTopEngineLine(lines);
    if (topLine) {
      const board = new Chess(fen);
      try {
        board.move(topLine.moves[0]?.san);
      } catch {}
      return {
        score: topLine.evaluation.type === 'centipawn' ? topLine.evaluation.value / 100 : (topLine.evaluation.value > 0 ? 10 : -10),
        isMate: topLine.evaluation.type === 'mate',
        mateIn: topLine.evaluation.type === 'mate' ? topLine.evaluation.value : undefined,
        depthReached: topLine.depth,
        bestMove: topLine.moves[0]?.san || topLine.moves[0]?.uci || 'e2e4',
        pv: topLine.moves.slice(0, 6).map(m => m.san || m.uci),
      };
    }
  } catch {}
  return {
    score: 0,
    isMate: false,
    depthReached: 0,
    bestMove: 'e2e4',
    pv: [],
  };
}
