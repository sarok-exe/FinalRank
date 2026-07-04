import { Chess } from 'chess.js';
import { minBy } from 'lodash-es';
import type { BoardPiece, RawMove } from '../types';
import { setFenTurn } from '../chess';
import { getAttackingMoves } from './attackers';

export function getDefendingMoves(board: Chess, piece: BoardPiece, transitive = true): RawMove[] {
  const defenderBoard = new Chess(board.fen());
  const attackingMoves = getAttackingMoves(defenderBoard, piece, false);
  const smallestRecapturerSet = minBy(
    attackingMoves.map(attackingMove => {
      const captureBoard = new Chess(setFenTurn(defenderBoard.fen(), piece.color));
      try { captureBoard.move(attackingMove); } catch { return; }
      return getAttackingMoves(captureBoard, { type: attackingMove.piece, color: attackingMove.color, square: attackingMove.to }, transitive);
    }).filter((r): r is RawMove[] => !!r),
    r => r.length
  );
  if (!smallestRecapturerSet) {
    const flippedPiece: BoardPiece = { type: piece.type, color: piece.color === 'w' ? 'b' : 'w', square: piece.square };
    defenderBoard.put(flippedPiece, piece.square);
    return getAttackingMoves(defenderBoard, flippedPiece, transitive);
  }
  return smallestRecapturerSet;
}
