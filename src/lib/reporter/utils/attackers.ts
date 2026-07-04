import type { Square, PieceSymbol} from 'chess.js';
import { Chess, KING } from 'chess.js';
import { isEqual, xorWith } from 'lodash-es';
import type { BoardPiece, RawMove} from '../types';
import { toRawMove } from '../types';
import { setFenTurn, getCaptureSquare } from '../chess';

type TransitiveAttacker = {
  directFen: string;
  square: Square;
  type: PieceSymbol;
}

function directAttackingMoves(board: Chess, piece: BoardPiece): RawMove[] {
  const attackerColor = piece.color === 'w' ? 'b' : 'w';
  const attackerBoard = new Chess(setFenTurn(board.fen(), attackerColor));
  const attackingMoves: RawMove[] = attackerBoard
    .moves({ verbose: true })
    .filter(move => getCaptureSquare(move) === piece.square)
    .map(toRawMove);
  const kingAttackerSquare = attackerBoard
    .attackers(piece.square)
    .find(sq => attackerBoard.get(sq)?.type === KING);
  if (kingAttackerSquare && !attackingMoves.some(a => a.piece === KING)) {
    attackingMoves.push({ piece: KING, color: attackerColor, from: kingAttackerSquare, to: piece.square });
  }
  return attackingMoves;
}

export function getAttackingMoves(board: Chess, piece: BoardPiece, transitive = true): RawMove[] {
  const attackingMoves = directAttackingMoves(board, piece);
  if (!transitive) return attackingMoves;
  const frontier: TransitiveAttacker[] = attackingMoves.map(m => ({
    directFen: board.fen(), square: m.from, type: m.piece,
  }));
  while (frontier.length > 0) {
    const ta = frontier.pop();
    if (!ta) break;
    if (ta.type === KING) continue;
    const tb = new Chess(ta.directFen);
    const old = directAttackingMoves(tb, piece);
    tb.remove(ta.square);
    const revealed = xorWith(
      old.filter(m => m.from !== ta.square), directAttackingMoves(tb, piece), isEqual
    );
    attackingMoves.push(...revealed);
    frontier.push(...revealed.map(m => ({ directFen: tb.fen(), square: m.from, type: m.piece })));
  }
  return attackingMoves;
}
