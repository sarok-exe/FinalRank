import { Evaluation } from '../../types';

export function getExpectedPoints(evaluation: Evaluation, moveColour: 'w' | 'b') {
  const centipawnGradient = 0.0035;
  if (evaluation.type === 'mate') {
    if (evaluation.value === 0) return moveColour === 'w' ? 1 : 0;
    return evaluation.value > 0 ? 1 : 0;
  }
  return 1 / (1 + Math.exp(-centipawnGradient * evaluation.value));
}

export function getExpectedPointsLoss(
  previousEvaluation: Evaluation,
  currentEvaluation: Evaluation,
  moveColour: 'w' | 'b'
) {
  const opponentColour = moveColour === 'w' ? 'b' : 'w';
  return Math.max(0,
    (
      getExpectedPoints(previousEvaluation, opponentColour)
      - getExpectedPoints(currentEvaluation, moveColour)
    ) * (moveColour === 'w' ? 1 : -1)
  );
}
