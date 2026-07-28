import type { Evaluation } from '../../types';

const SIGMOID_GRADIENT = 0.00368208;
const ACC_A = 103.1668100711649;
const ACC_K = 0.04354415386753951;
const ACC_B = -3.166924740191411;

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

// Lichess-style Win% from centipawns: 0-100 scale
// Formula: 100 / (1 + exp(-gradient * cp))
export function getWinPercent(evaluation: Evaluation, sideToMove: 'w' | 'b'): number {
  const cp = evalToCentiPawns(evaluation, sideToMove);
  return 100 / (1 + Math.exp(-SIGMOID_GRADIENT * cp));
}

// Lichess-style move accuracy from before/after Win%
// If after >= before (maintained or improved), accuracy = 100
// Otherwise: ACC_A * exp(-ACC_K * winDiff) + ACC_B, clamped [0,100]
export function getMoveAccuracyFromWin(winPercentBefore: number, winPercentAfter: number): number {
  if (winPercentAfter >= winPercentBefore) return 100;
  const winDiff = winPercentBefore - winPercentAfter;
  const raw = ACC_A * Math.exp(-ACC_K * winDiff) + ACC_B;
  // Add 1 uncertainty bonus per Lichess (imperfect analysis compensation)
  return Math.min(100, Math.max(0, raw + 1));
}

// === Existing classification functions (unchanged) ===

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

export function getMoveAccuracy(
  previousEvaluation: Evaluation,
  currentEvaluation: Evaluation,
  moveColour: 'w' | 'b'
): number {
  const before = getWinPercent(previousEvaluation, moveColour);
  const after = getWinPercent(currentEvaluation, moveColour);
  return getMoveAccuracyFromWin(before, after);
}

// Lichess-style game accuracy: average of volatility-weighted mean and harmonic mean.
// Volatility = standard deviation of Win% within sliding windows (size = max(2, min(8, moves/10)))
// window = sliding window of winPercent values of size `windowSize`
// weight = standard deviation of each window, clamped [0.5, 12]
// weightedMean = Σ(accuracy_i * weight_i) / Σ(weight_i)
// harmonicMean = n / Σ(1/accuracy_i)
// final = (weightedMean + harmonicMean) / 2
export function getGameAccuracy(accuracies: number[], winPercents: number[]): number {
  if (accuracies.length === 0) return 0;

  const n = winPercents.length;
  const windowSize = Math.max(2, Math.min(8, Math.floor(n / 10)));

  // Build sliding windows of winPercents to compute volatility
  const windows: number[][] = [];
  // Prepend some copies of first window for padding (like Lichess does)
  for (let i = 0; i < windowSize - 1 && i < n; i++) {
    windows.push(winPercents.slice(0, Math.min(windowSize, n)));
  }
  for (let i = 0; i <= n - windowSize; i++) {
    windows.push(winPercents.slice(i, i + windowSize));
  }

  // Compute weight (volatility) for each window
  const weights = windows.map(w => {
    if (w.length < 2) return 0.5;
    const mean = w.reduce((s, v) => s + v, 0) / w.length;
    const variance = w.reduce((s, v) => s + (v - mean) ** 2, 0) / (w.length - 1);
    const stddev = Math.sqrt(variance);
    return Math.max(0.5, Math.min(12, stddev));
  });

  // Weighted mean of accuracies
  let weightedSum = 0;
  let weightSum = 0;
  for (let i = 0; i < accuracies.length && i < weights.length; i++) {
    weightedSum += accuracies[i] * weights[i];
    weightSum += weights[i];
  }
  const weightedMean = weightSum > 0 ? weightedSum / weightSum : 0;

  // Harmonic mean of accuracies
  const safeAccuracies = accuracies.map(a => a < 1 ? 1 : a); // avoid div by zero
  const harmonicMean = safeAccuracies.length / safeAccuracies.reduce((s, a) => s + 1 / a, 0);

  return (weightedMean + harmonicMean) / 2;
}

// Convenience: compute game accuracy from evaluation pairs for one color
export function getGameAccuracyForColor(
  evals: { before: Evaluation; after: Evaluation }[],
  color: 'w' | 'b'
): number {
  const accuracies: number[] = [];
  const winPercents: number[] = [];

  for (const { before, after } of evals) {
    const wpBefore = getWinPercent(before, color);
    const wpAfter = getWinPercent(after, color);
    const acc = getMoveAccuracyFromWin(wpBefore, wpAfter);

    winPercents.push(wpAfter);
    accuracies.push(acc);
  }

  return getGameAccuracy(accuracies, winPercents);
}
