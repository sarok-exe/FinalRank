import { Chess, QUEEN } from 'chess.js';
import { differenceWith, isEqual } from 'lodash-es';
import type { BoardPiece, RawMove } from '../types';
import { PIECE_VALUES } from '../../../types';
import { getUnsafePieces } from './pieceSafety';
import { getAttackingMoves } from './attackers';

function relativeUnsafePieceAttacks(
  actionBoard: Chess,
  threatenedPiece: BoardPiece,
  colour: 'w' | 'b',
  playedMove?: Move
): RawMove[] {
  return getUnsafePieces(actionBoard, colour, playedMove)
    .filter(up => up.square !== threatenedPiece.square && PIECE_VALUES[up.type] >= PIECE_VALUES[threatenedPiece.type])
    .map(up => getAttackingMoves(actionBoard, up, false))
    .reduce<RawMove[]>((acc, val) => acc.concat(val), []);
}

import type { Move } from 'chess.js';

export function moveCreatesGreaterThreat(board: Chess, threatenedPiece: BoardPiece, actingMove: RawMove): boolean {
  const actionBoard = new Chess(board.fen());
  const previousRelativeAttacks = relativeUnsafePieceAttacks(actionBoard, threatenedPiece, actingMove.color);
  let bakedMove: Move;
  try { bakedMove = actionBoard.move(actingMove); } catch { return false; }
  const relativeAttacks = relativeUnsafePieceAttacks(actionBoard, threatenedPiece, actingMove.color, bakedMove);
  const newRelativeAttacks = differenceWith(relativeAttacks, previousRelativeAttacks, isEqual);
  if (newRelativeAttacks.length > 0) return true;
  return PIECE_VALUES[threatenedPiece.type] < PIECE_VALUES[QUEEN]
    && actionBoard.moves().some(m => {
      const parsed = actionBoard.move(m);
      actionBoard.undo();
      return parsed.san.includes('#');
    });
}

export function moveLeavesGreaterThreat(board: Chess, threatenedPiece: BoardPiece, actingMove: RawMove): boolean {
  const actionBoard = new Chess(board.fen());
  try { actionBoard.move(actingMove); } catch { return false; }
  const relativeAttacks = relativeUnsafePieceAttacks(actionBoard, threatenedPiece, actingMove.color);
  if (relativeAttacks.length > 0) return true;
  return PIECE_VALUES[threatenedPiece.type] < PIECE_VALUES[QUEEN]
    && actionBoard.moves().some(m => {
      const parsed = actionBoard.move(m);
      actionBoard.undo();
      return parsed.san.includes('#');
    });
}

export function hasDangerLevels(
  board: Chess,
  threatenedPiece: BoardPiece,
  actingMoves: RawMove[],
  equalityStrategy: 'creates' | 'leaves' = 'leaves'
): boolean {
  return actingMoves.every(am => equalityStrategy === 'creates'
    ? moveCreatesGreaterThreat(board, threatenedPiece, am)
    : moveLeavesGreaterThreat(board, threatenedPiece, am)
  );
}
