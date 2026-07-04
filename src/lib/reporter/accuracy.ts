import type { Evaluation } from '../../types';
import { getExpectedPointsLoss } from './expectedPoints';

export function getMoveAccuracy(
  previousEvaluation: Evaluation,
  currentEvaluation: Evaluation,
  moveColour: 'w' | 'b'
): number {
  const pointLoss = getExpectedPointsLoss(previousEvaluation, currentEvaluation, moveColour);
  return 103.16 * Math.exp(-4 * pointLoss) - 3.17;
}
