import { WHITE } from 'chess.js';
import type { MoveClassification, Evaluation } from '../../../types';
import type { ExtractedCurrentNode } from '../types';
import { getExpectedPointsLoss } from '../expectedPoints';

/**
 * Depth-aware strictness multiplier for expected-points-loss thresholds.
 * Higher analysis depth → stricter classification (lower thresholds).
 * - depth 12 → 1.0 (current behavior preserved)
 * - depth 18 → 0.625 (stricter)
 * - depth 8  → 1.25 (more lenient)
 * - depth 25 → 0.55 (very strict, clamped floor)
 */
export function depthStrictnessScale(depth: number): number {
  return Math.min(1.4, Math.max(0.55, 1.75 - 0.0625 * depth));
}

export function pointLossClassify(
  previousEvaluation: Evaluation,
  current: ExtractedCurrentNode,
  depth: number = 12
): MoveClassification {
  const scale = depthStrictnessScale(depth);
  const previousSubjectiveValue = previousEvaluation.value * (current.playedMove.color === WHITE ? 1 : -1);
  const subjectiveValue = current.subjectiveEvaluation.value;

  if (previousEvaluation.type === 'mate' && current.evaluation.type === 'mate') {
    if (previousSubjectiveValue > 0 && subjectiveValue < 0) {
      return subjectiveValue < -3 ? 'mistake' : 'blunder';
    }
    const mateLoss = (current.evaluation.value - previousEvaluation.value) * (current.playedMove.color === WHITE ? 1 : -1);
    if (mateLoss < 0 || (mateLoss === 0 && subjectiveValue < 0)) return 'best';
    if (mateLoss < 2) return 'excellent';
    if (mateLoss < 7) return 'okay';
    return 'inaccuracy';
  }

  if (previousEvaluation.type === 'mate' && current.evaluation.type === 'centipawn') {
    if (subjectiveValue >= 800 * scale) return 'excellent';
    if (subjectiveValue >= 400 * scale) return 'okay';
    if (subjectiveValue >= 200 * scale) return 'inaccuracy';
    if (subjectiveValue >= 0) return 'mistake';
    return 'blunder';
  }

  if (previousEvaluation.type === 'centipawn' && current.evaluation.type === 'mate') {
    if (subjectiveValue > 0) return 'best';
    if (subjectiveValue >= -2) return 'blunder';
    if (subjectiveValue >= -5) return 'mistake';
    return 'inaccuracy';
  }

  const pointLoss = getExpectedPointsLoss(previousEvaluation, current.evaluation, current.playedMove.color === WHITE ? 'w' : 'b');

  if (pointLoss < 0.01 * scale) return 'best';
  if (pointLoss < 0.045 * scale) return 'excellent';
  if (pointLoss < 0.08 * scale) return 'okay';
  if (pointLoss < 0.12 * scale) return 'inaccuracy';
  if (pointLoss < 0.22 * scale) return 'mistake';
  return 'blunder';
}
