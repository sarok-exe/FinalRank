/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MoveClassification, EvaluationResult } from '../types';

/**
 * Classifies a move based on the player's move evaluation vs the best move evaluation.
 */
export function classifyMove(
  playerEval: EvaluationResult,
  bestEval: EvaluationResult | undefined,
  prevEval: EvaluationResult | undefined,
  color: 'w' | 'b',
  moveIndex: number
): MoveClassification {
  // If no best evaluation is available, assume it's the best move
  if (!bestEval) {
    return 'best';
  }

  // Book moves: simple heuristic for the first 5 moves of the game if eval is within range
  if (moveIndex < 10) {
    const diff = Math.abs(getScoreFromEval(playerEval, color) - getScoreFromEval(bestEval, color));
    if (diff < 0.5) return 'book';
  }

  const sign = color === 'w' ? 1 : -1;
  const playerVal = getNormalizedScore(playerEval, sign);
  const bestVal = getNormalizedScore(bestEval, sign);
  const prevVal = prevEval ? getNormalizedScore(prevEval, sign) : 0;

  // Eval difference (loss of win margin)
  // Best possible score is bestVal. playerVal is what player actually got.
  // evalLoss is bestVal - playerVal.
  const evalLoss = bestVal - playerVal;

  // Let's first check if player move is exactly the best move
  const isBestMove = evalLoss < 0.05;

  if (isBestMove) {
    // Check for brilliant move:
    // Heuristic: playerVal is high, and prevVal was low or standard, or we had a trade off/sacrifice
    // For a game, simulate a percentage chance or trigger on positive change with specific positional complexity
    const isSacrificeCandidate = moveIndex > 10 && (playerVal - prevVal > 1.2 || (playerVal > 1.0 && Math.random() < 0.05));
    if (isSacrificeCandidate) {
      return 'brilliant';
    }
    return 'best';
  }

  if (evalLoss < 0.25) {
    return 'excellent';
  }
  if (evalLoss < 0.55) {
    return 'good';
  }
  if (evalLoss < 1.1) {
    return 'inaccuracy';
  }
  if (evalLoss < 2.2) {
    return 'mistake';
  }
  return 'blunder';
}

/**
 * Safely converts an EvaluationResult into a centipawn score.
 * Mates are treated as high evaluation values.
 */
export function getScoreFromEval(evaluation: EvaluationResult, color: 'w' | 'b'): number {
  const multiplier = color === 'w' ? 1 : -1;
  if (evaluation.isMate) {
    const mateIn = evaluation.mateIn || 1;
    // Mate in 1 for our side = +1000, for opponent = -1000
    // Sign of mateIn tells us who is mating. Positive is White, Negative is Black
    const sign = mateIn > 0 ? 1 : -1;
    return sign * (1000 - Math.abs(mateIn));
  }
  return evaluation.score * multiplier;
}

/**
 * Normalizes score to centipawns bound to chess.com-style scale (-10 to +10)
 */
function getNormalizedScore(evalRes: EvaluationResult, sign: 1 | -1): number {
  if (evalRes.isMate) {
    const mateIn = evalRes.mateIn || 1;
    // If we have a forced checkmate in our favor, score is highest
    const isOurMate = (mateIn > 0 && sign > 0) || (mateIn < 0 && sign < 0);
    return isOurMate ? 10.0 : -10.0;
  }
  // Standard score
  const score = evalRes.score * sign;
  // Compress extreme values
  if (score > 10) return 9.5 + Math.tanh((score - 10) / 10) * 0.5;
  if (score < -10) return -9.5 - Math.tanh((-score - 10) / 10) * 0.5;
  return score;
}

/**
 * Calculates the Chess.com-style accuracy of a game based on average centipawn loss.
 */
export function calculateAccuracy(avgCentipawnLoss: number): number {
  // Accuracy = 100 * exp(-0.04 * cpLoss)
  // E.g., cpLoss = 10 => 100 * exp(-0.4) = 67%
  // cpLoss = 5 => 100 * exp(-0.2) = 81.8%
  // Let's use a smoother standard mapping:
  const loss = Math.max(0, avgCentipawnLoss);
  const accuracy = 100 * Math.exp(-0.015 * loss);
  return Math.min(100, Math.max(0, Math.round(accuracy * 10) / 10));
}
