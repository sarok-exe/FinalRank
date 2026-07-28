import type { Evaluation } from '../../types';
import { getMoveAccuracy as computeMoveAccuracy } from './expectedPoints';

export function getMoveAccuracy(
  previousEvaluation: Evaluation,
  currentEvaluation: Evaluation,
  moveColour: 'w' | 'b'
): number {
  return computeMoveAccuracy(previousEvaluation, currentEvaluation, moveColour);
}
