import type { Move, Square, Color} from 'chess.js';
import type { Evaluation } from '../../types';

export function setFenTurn(fen: string, colour: Color): string {
  const parts = fen.split(' ');
  if (parts[1] === (colour === 'w' ? 'b' : 'w')) {
    parts[3] = '-';
  }
  parts[1] = colour;
  return parts.join(' ');
}

export function getCaptureSquare(move: Move): Square {
  return move.isEnPassant() ? (move.to[0] + move.from[1]) as Square : move.to;
}

export function getSubjectiveEvaluation(evaluation: Evaluation, colour: Color): Evaluation {
  return {
    type: evaluation.type,
    value: evaluation.value * (colour === 'w' ? 1 : -1),
  };
}
