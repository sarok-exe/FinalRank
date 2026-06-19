import { Chess, Move, Square, PieceSymbol, Color } from 'chess.js';
import { EngineLine, Evaluation } from '../../types';

export interface BoardPiece {
  square: Square;
  type: PieceSymbol;
  color: Color;
}

export interface RawMove {
  piece: PieceSymbol;
  color: Color;
  from: Square;
  to: Square;
  promotion?: PieceSymbol;
}

export interface AnalysisOptions {
  includeBrilliant?: boolean;
  includeCritical?: boolean;
  includeTheory?: boolean;
}

export interface ExtractedNode {
  board: Chess;
  fen: string;
  topLine: EngineLine;
  evaluation: Evaluation;
  secondTopLine?: EngineLine;
  secondTopMove?: Move;
  secondSubjectiveEvaluation?: Evaluation;
}

export interface ExtractedPreviousNode extends ExtractedNode {
  topMove: Move;
  subjectiveEvaluation?: Evaluation;
  playedMove?: Move;
}

export interface ExtractedCurrentNode extends ExtractedNode {
  topMove?: Move;
  subjectiveEvaluation: Evaluation;
  playedMove: Move;
}

export function toRawMove(move: Move): RawMove {
  return { piece: move.piece, color: move.color, from: move.from, to: move.to, promotion: move.promotion };
}

export function getBoardPieces(board: Chess): BoardPiece[] {
  return board.board().reduce((acc, val) => acc.concat(val)).filter((p): p is BoardPiece => !!p);
}

export function toBoardPiece(move: RawMove): BoardPiece {
  return { ...move, type: move.piece, square: move.from };
}
