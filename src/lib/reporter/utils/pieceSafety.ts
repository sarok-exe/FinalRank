import type { Chess, Move} from 'chess.js';
import { PAWN, KNIGHT, ROOK, KING } from 'chess.js';
import { minBy } from 'lodash-es';
import type { BoardPiece} from '../types';
import { getBoardPieces, toBoardPiece } from '../types';
import { PIECE_VALUES } from '../../../types';
import { getAttackingMoves } from './attackers';
import { getDefendingMoves } from './defenders';

export function isPieceSafe(board: Chess, piece: BoardPiece, playedMove?: Move) {
  const directAttackers = getAttackingMoves(board, piece, false).map(toBoardPiece);
  const attackers = getAttackingMoves(board, piece).map(toBoardPiece);
  const defenders = getDefendingMoves(board, piece).map(toBoardPiece);
  if (playedMove?.captured && piece.type === ROOK && PIECE_VALUES[playedMove.captured] === PIECE_VALUES[KNIGHT]
    && attackers.length === 1 && defenders.length > 0 && PIECE_VALUES[attackers[0].type] === PIECE_VALUES[KNIGHT]) return true;
  const hasLowerValueAttacker = directAttackers.some(a => PIECE_VALUES[a.type] < PIECE_VALUES[piece.type]);
  if (hasLowerValueAttacker) return false;
  if (attackers.length <= defenders.length) return true;
  const lowestValueAttacker = minBy(directAttackers, a => PIECE_VALUES[a.type]);
  if (!lowestValueAttacker) return true;
  if (PIECE_VALUES[piece.type] < PIECE_VALUES[lowestValueAttacker.type]
    && defenders.some(d => PIECE_VALUES[d.type] < PIECE_VALUES[lowestValueAttacker.type])) return true;
  if (defenders.some(d => d.type === PAWN)) return true;
  return false;
}

export function getUnsafePieces(board: Chess, colour: 'w' | 'b', playedMove?: Move) {
  const capturedPieceValue = playedMove?.captured ? PIECE_VALUES[playedMove.captured] : 0;
  return getBoardPieces(board).filter(piece =>
    piece.color === colour && piece.type !== PAWN && piece.type !== KING
    && PIECE_VALUES[piece.type] > capturedPieceValue
    && !isPieceSafe(board, piece, playedMove)
  );
}
