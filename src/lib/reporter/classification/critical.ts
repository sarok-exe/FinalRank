import { ExtractedCurrentNode, ExtractedPreviousNode } from '../types';
import { getCaptureSquare } from '../chess';
import { getExpectedPointsLoss } from '../expectedPoints';
import { isMoveCriticalCandidate } from '../utils/criticalMove';
import { isPieceSafe } from '../utils/pieceSafety';

export function considerCriticalClassification(
  previous: ExtractedPreviousNode,
  current: ExtractedCurrentNode
) {
  if (!isMoveCriticalCandidate(previous, current)) return false;

  if (current.subjectiveEvaluation.type === 'mate' && current.subjectiveEvaluation.value > 0) return false;

  if (current.playedMove.captured) {
    const capturedPieceSafety = isPieceSafe(
      previous.board,
      { color: current.playedMove.color === 'w' ? 'b' : 'w', square: getCaptureSquare(current.playedMove), type: current.playedMove.captured }
    );
    if (!capturedPieceSafety) return false;
  }

  if (!previous.secondTopLine?.evaluation) return false;

  const secondTopMovePointLoss = getExpectedPointsLoss(
    previous.evaluation,
    previous.secondTopLine.evaluation,
    current.playedMove.color === 'w' ? 'w' : 'b'
  );

  return secondTopMovePointLoss >= 0.1;
}
