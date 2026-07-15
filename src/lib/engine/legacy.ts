import { Chess } from 'chess.js';
import { Engine, getTopEngineLine } from './index';
import type { EvaluationResult } from '../../types';

let engineInstance: Engine | null = null;
let engineEvaluating = false;

function getEngine(): Engine {
  if (!engineInstance) {
    engineInstance = new Engine();
    engineEvaluating = false;
  }
  return engineInstance;
}

export function destroyEngine() {
  if (engineInstance) {
    engineInstance.terminate();
    engineInstance = null;
    engineEvaluating = false;
  }
}

export async function analyzePositionLocally(
  fen: string,
  options: { depth?: number; timeLimit?: number } = {}
): Promise<EvaluationResult> {
  const depth = options.depth ?? 8;

  try {
    const engine = getEngine();

    // Guard against concurrent evaluations — stop any in-progress search first
    if (engineEvaluating) {
      await engine.stopEvaluation();
      engineEvaluating = false;
    }

    // Set position without ucinewgame (avoids spurious bestmove from abort)
    // We only need ucinewgame once; subsequent positions just need "position fen"
    engine.setPositionQuiet(fen);

    // Always use depth mode — convert time budget to depth if needed
    // Engine computes to target depth, no early cutoff
    engineEvaluating = true;
    const lines = await engine.evaluate({ depth });
    engineEvaluating = false;

    const topLine = getTopEngineLine(lines);
    if (topLine) {
      const board = new Chess(fen);
      try {
        board.move(topLine.moves[0]?.san);
      } catch { /* ignore illegal engine move */ }
      return {
        score: topLine.evaluation.type === 'centipawn'
          ? topLine.evaluation.value / 100
          : (topLine.evaluation.value > 0 ? 10 : -10),
        isMate: topLine.evaluation.type === 'mate',
        mateIn: topLine.evaluation.type === 'mate' ? topLine.evaluation.value : undefined,
        depthReached: topLine.depth,
        bestMove: topLine.moves[0]?.san || topLine.moves[0]?.uci || 'e2e4',
        pv: topLine.moves.slice(0, 6).map(m => m.san || m.uci),
      };
    }
  } catch {
    destroyEngine();
  }

  return {
    score: 0,
    isMate: false,
    depthReached: 0,
    bestMove: 'e2e4',
    pv: [],
  };
}
