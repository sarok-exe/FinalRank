import { QUEEN } from 'chess.js';
import { ExtractedPreviousNode, ExtractedCurrentNode } from '../types';

export function isMoveCriticalCandidate(
  previous: ExtractedPreviousNode,
  current: ExtractedCurrentNode
) {
  const secondSubjectiveEval = previous.secondSubjectiveEvaluation;
  if (secondSubjectiveEval) {
    if (secondSubjectiveEval.type === 'centipawn' && secondSubjectiveEval.value >= 700) return false;
  } else {
    if (current.evaluation.type === 'centipawn' && current.subjectiveEvaluation.value >= 700) return false;
  }
  if (current.subjectiveEvaluation.value < 0) return false;
  if (current.playedMove.promotion === QUEEN) return false;
  if (previous.board.isCheck()) return false;
  return true;
}
