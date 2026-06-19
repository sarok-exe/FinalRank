import { ExtractedPreviousNode, ExtractedCurrentNode } from '../types';
import { isMoveCriticalCandidate } from '../utils/criticalMove';
import { getUnsafePieces } from '../utils/pieceSafety';
import { hasDangerLevels } from '../utils/dangerLevels';
import { isPieceTrapped } from '../utils/pieceTrapped';
import { getAttackingMoves } from '../utils/attackers';

export function considerBrilliantClassification(
  previous: ExtractedPreviousNode,
  current: ExtractedCurrentNode
) {
  if (!isMoveCriticalCandidate(previous, current)) return false;
  if (current.playedMove.promotion) return false;

  const previousUnsafePieces = getUnsafePieces(previous.board, current.playedMove.color);
  const unsafePieces = getUnsafePieces(current.board, current.playedMove.color, current.playedMove);

  if (!current.board.isCheck() && unsafePieces.length < previousUnsafePieces.length) return false;

  const dangerLevelsProtected = unsafePieces.every(
    up => hasDangerLevels(current.board, up, getAttackingMoves(current.board, up, false))
  );
  if (dangerLevelsProtected) return false;

  const previousTrappedPieces = previousUnsafePieces.filter(up => isPieceTrapped(previous.board, up));
  const trappedPieces = unsafePieces.filter(up => isPieceTrapped(current.board, up));
  const movedPieceTrapped = previousTrappedPieces.some(tp => tp.square === current.playedMove.from);

  if (trappedPieces.length === unsafePieces.length || movedPieceTrapped || trappedPieces.length < previousTrappedPieces.length) return false;

  return unsafePieces.length > 0;
}
