import type { Chess, Move, Square, PieceSymbol, Color } from 'chess.js';
import type { EngineLine, Evaluation } from '../../types';

export type BoardPiece = {
  square: Square;
  type: PieceSymbol;
  color: Color;
}

export type RawMove = {
  piece: PieceSymbol;
  color: Color;
  from: Square;
  to: Square;
  promotion?: PieceSymbol;
}

export type AnalysisOptions = {
  includeBrilliant?: boolean;
  includeCritical?: boolean;
  includeTheory?: boolean;
}

export type ExtractedNode = {
  board: Chess;
  fen: string;
  topLine: EngineLine;
  evaluation: Evaluation;
  secondTopLine?: EngineLine;
  secondTopMove?: Move;
  secondSubjectiveEvaluation?: Evaluation;
}

export type ExtractedPreviousNode = {
  topMove: Move;
  subjectiveEvaluation?: Evaluation;
  playedMove?: Move;
} & ExtractedNode

export type ExtractedCurrentNode = {
  topMove?: Move;
  subjectiveEvaluation: Evaluation;
  playedMove: Move;
} & ExtractedNode

export function toRawMove(move: Move): RawMove {
  return { piece: move.piece, color: move.color, from: move.from, to: move.to, promotion: move.promotion };
}

export function getBoardPieces(board: Chess): BoardPiece[] {
  return board.board().reduce((acc, val) => acc.concat(val), []).filter((p): p is BoardPiece => !!p);
}

export function toBoardPiece(move: RawMove): BoardPiece {
  return { ...move, type: move.piece, square: move.from };
}
