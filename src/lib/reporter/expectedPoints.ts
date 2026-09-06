import type { Evaluation } from '../../types';

// ─── Lichess-style constants (kept for classification) ───────────────────
const SIGMOID_GRADIENT = 0.00368208;
// Lichess per-move accuracy: A * exp(-K * Δwp) + B
const LICHESS_ACC_A = 103.1668100711649;
const LICHESS_ACC_K = 0.04354415386753951;
const LICHESS_ACC_B = -3.166924740191411;

// ─── Chess.com-style constants ──────────────────────────────────────────
// Win%: flatter sigmoid (1 pawn ≈ +6 pts vs +9.1 on Lichess).
const CC_SIGMOID_GRADIENT = 0.0024;
// Per-move accuracy: steeper decay curve (2.75× steeper than Lichess).
const CC_ACC_A = 103.1668100711649;
const CC_ACC_K = 0.14;
const CC_ACC_B = -3.166924740191411;
// Game aggregation: power-mean exponent (forgiving of individual blunders).
const CC_GAME_POWER = 0.25;

// Convert engine evaluation to centipawns from the sideToMove's perspective.
// Engine eval is always from white's perspective (+ = good for white).
function evalToCentiPawns(evaluation: Evaluation, sideToMove: 'w' | 'b'): number {
  if (evaluation.type === 'centipawn') {
    return sideToMove === 'w' ? evaluation.value : -evaluation.value;
  }
  // Mate: Stockfish reports mate-in-N for side to move, negative = being mated
  const sign = evaluation.value > 0 ? 1 : -1;
  const mateIn = Math.abs(evaluation.value);
  const cp = sign * Math.max(1000, 100000 - 1000 * mateIn);
  return sideToMove === 'w' ? cp : -cp;
}

// ─── Lichess-style Win% (kept – classification depends on it) ───────────
// Formula: 100 / (1 + exp(-gradient * cp))
export function getWinPercent(evaluation: Evaluation, sideToMove: 'w' | 'b'): number {
  const cp = evalToCentiPawns(evaluation, sideToMove);
  return 100 / (1 + Math.exp(-SIGMOID_GRADIENT * cp));
}

// ─── Chess.com-style Win% (flatter sigmoid) ────────────────────────────
// 50 + 50 * (2/(1+exp(-k1*cp)) - 1)  ≡  100/(1+exp(-k1*cp))
// cp clamped to ±1000 (chess.com caps win% at ~91.7% for a full pawn+).
export function getWinPercentChesscom(evaluation: Evaluation, sideToMove: 'w' | 'b'): number {
  const cp = Math.max(-1000, Math.min(1000, evalToCentiPawns(evaluation, sideToMove)));
  return 100 / (1 + Math.exp(-CC_SIGMOID_GRADIENT * cp));
}

// ─── Lichess-style per-move accuracy (kept for getGameAccuracyForColor) ──
// If after >= before → 100; else A·exp(-K·Δwp) + B, clamped [0,100]
export function getMoveAccuracyFromWin(winPercentBefore: number, winPercentAfter: number): number {
  if (winPercentAfter >= winPercentBefore) return 100;
  const winDiff = winPercentBefore - winPercentAfter;
  const raw = LICHESS_ACC_A * Math.exp(-LICHESS_ACC_K * winDiff) + LICHESS_ACC_B;
  // Add 1 uncertainty bonus per Lichess (imperfect analysis compensation)
  return Math.min(100, Math.max(0, raw + 1));
}

// ─── Chess.com-style per-move accuracy ──────────────────────────────────
// Steeper decay (k2 = 0.14 vs Lichess 0.0435), no uncertainty bonus.
export function getMoveAccuracyFromWinChesscom(
  winPercentBefore: number,
  winPercentAfter: number
): number {
  if (winPercentAfter >= winPercentBefore) return 100;
  const winDiff = winPercentBefore - winPercentAfter;
  const raw = CC_ACC_A * Math.exp(-CC_ACC_K * winDiff) + CC_ACC_B;
  return Math.min(100, Math.max(0, raw));
}

// ─── Classification helpers (unchanged) ─────────────────────────────────

export function getExpectedPoints(evaluation: Evaluation, moveColour: 'w' | 'b'): number {
  const centipawnGradient = 0.0035;
  if (evaluation.type === 'mate') {
    if (evaluation.value === 0) return moveColour === 'w' ? 1 : 0;
    return evaluation.value > 0 ? 1 : 0;
  }
  return 1 / (1 + Math.exp(-centipawnGradient * evaluation.value));
}

export function getExpectedPointsLoss(
  previousEvaluation: Evaluation,
  currentEvaluation: Evaluation,
  moveColour: 'w' | 'b'
): number {
  const opponentColour = moveColour === 'w' ? 'b' : 'w';
  return Math.max(0,
    (
      getExpectedPoints(previousEvaluation, opponentColour)
      - getExpectedPoints(currentEvaluation, moveColour)
    ) * (moveColour === 'w' ? 1 : -1)
  );
}

// ─── Accuracy functions (now chess.com-style) ───────────────────────────

/** Per-move accuracy using chess.com-style win% model + steeper decay. */
export function getMoveAccuracy(
  previousEvaluation: Evaluation,
  currentEvaluation: Evaluation,
  moveColour: 'w' | 'b'
): number {
  // Checkmate delivered: the mover just gave checkmate — perfect accuracy.
  // (The engine reports score mate 0 for the checkmated side; the mover
  // delivered it so win% from mover's perspective is 100.)
  if (currentEvaluation.type === 'mate' && currentEvaluation.value === 0) return 100;
  const before = getWinPercentChesscom(previousEvaluation, moveColour);
  const after = getWinPercentChesscom(currentEvaluation, moveColour);
  return getMoveAccuracyFromWinChesscom(before, after);
}

/**
 * Game accuracy via power-mean aggregation (chess.com-style).
 *
 * `(mean(accuracy^p))^(1/p)` with p ≈ 0.25 — much more forgiving of
 * individual blunders than Lichess's harmonic-mean approach.
 * Signature preserved: winPercents parameter accepted for API compatibility
 * but unused (power mean operates solely on the accuracy array).
 */
export function getGameAccuracy(accuracies: number[], _winPercents?: number[]): number {
  if (accuracies.length === 0) return 0;
  const sum = accuracies.reduce((s, a) => s + Math.pow(a, CC_GAME_POWER), 0);
  return Math.pow(sum / accuracies.length, 1 / CC_GAME_POWER);
}

// Convenience: compute game accuracy from evaluation pairs for one color
export function getGameAccuracyForColor(
  evals: { before: Evaluation; after: Evaluation }[],
  color: 'w' | 'b'
): number {
  const accuracies: number[] = [];

  for (const { before, after } of evals) {
    const wpBefore = getWinPercentChesscom(before, color);
    const wpAfter = getWinPercentChesscom(after, color);
    accuracies.push(getMoveAccuracyFromWinChesscom(wpBefore, wpAfter));
  }

  return getGameAccuracy(accuracies);
}
