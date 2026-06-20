import { WHITE } from 'chess.js';
import { MoveClassification } from '../../../types';
import { ExtractedCurrentNode, ExtractedPreviousNode } from '../types';
import { getExpectedPointsLoss } from '../expectedPoints';

export function pointLossClassify(
  previous: ExtractedPreviousNode,
  current: ExtractedCurrentNode
): MoveClassification {
  const previousSubjectiveValue = previous.evaluation.value * (current.playedMove.color === WHITE ? 1 : -1);
  const subjectiveValue = current.subjectiveEvaluation.value;

  if (previous.evaluation.type === 'mate' && current.evaluation.type === 'mate') {
    if (previousSubjectiveValue > 0 && subjectiveValue < 0) {
      return subjectiveValue < -3 ? 'mistake' : 'blunder';
    }
    const mateLoss = (current.evaluation.value - previous.evaluation.value) * (current.playedMove.color === WHITE ? 1 : -1);
    if (mateLoss < 0 || (mateLoss === 0 && subjectiveValue < 0)) return 'best';
    if (mateLoss < 2) return 'excellent';
    if (mateLoss < 7) return 'okay';
    return 'inaccuracy';
  }

  if (previous.evaluation.type === 'mate' && current.evaluation.type === 'centipawn') {
    if (subjectiveValue >= 800) return 'excellent';
    if (subjectiveValue >= 400) return 'okay';
    if (subjectiveValue >= 200) return 'inaccuracy';
    if (subjectiveValue >= 0) return 'mistake';
    return 'blunder';
  }

  if (previous.evaluation.type === 'centipawn' && current.evaluation.type === 'mate') {
    if (subjectiveValue > 0) return 'best';
    if (subjectiveValue >= -2) return 'blunder';
    if (subjectiveValue >= -5) return 'mistake';
    return 'inaccuracy';
  }

  const pointLoss = getExpectedPointsLoss(previous.evaluation, current.evaluation, current.playedMove.color === WHITE ? 'w' : 'b');

  if (pointLoss < 0.01) return 'best';
  if (pointLoss < 0.045) return 'excellent';
  if (pointLoss < 0.08) return 'okay';
  if (pointLoss < 0.12) return 'inaccuracy';
  if (pointLoss < 0.22) return 'mistake';
  return 'blunder';
}
