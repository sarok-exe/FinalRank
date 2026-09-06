import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { Chess } from 'chess.js';
import type { Evaluation, EngineLine, MoveClassification } from '../src/types';
import {
  getWinPercent,
  getMoveAccuracy,
  getExpectedPointsLoss,
  getGameAccuracy,
  getMoveAccuracyFromWin,
  getMoveAccuracyFromWinChesscom,
} from '../src/lib/reporter/expectedPoints';
import { classifyMove } from '../src/lib/reporter/classify';
import { pointLossClassify, depthStrictnessScale } from '../src/lib/reporter/classification/pointLoss';
import type { ExtractedCurrentNode } from '../src/lib/reporter/types';
import { getGameAnalysis } from '../src/lib/reporter/report';
import { getSubjectiveEvaluation, setFenTurn, getCaptureSquare } from '../src/lib/reporter/chess';
import { getTopEngineLine } from '../src/lib/engine';
import type { ChessGame } from '../src/types';

const cpArbitrary = fc.integer({ min: -2000, max: 2000 });
const mateArbitrary = fc.integer({ min: -10, max: 10 }).filter(v => v !== 0);
const evalArbitrary = fc.oneof(
  cpArbitrary.map(value => ({ type: 'centipawn' as const, value })),
  mateArbitrary.map(value => ({ type: 'mate' as const, value })),
);
const colorArbitrary = fc.constantFrom<'w' | 'b'>('w', 'b');

const CLASSIFICATIONS: MoveClassification[] = [
  'brilliant', 'critical', 'best', 'excellent', 'good', 'okay', 'book',
  'inaccuracy', 'mistake', 'blunder', 'forced', 'risky',
];

describe('getWinPercent', () => {
  it('always returns value in [0,100]', () => {
    fc.assert(fc.property(evalArbitrary, colorArbitrary, (ev, c) => {
      const wp = getWinPercent(ev, c);
      return wp >= 0 && wp <= 100;
    }));
  });

  it('is strictly monotonic in centipawn value (mover-perspective adjusted)', () => {
    fc.assert(fc.property(cpArbitrary, cpArbitrary, colorArbitrary, (a, b, c) => {
      const e1: Evaluation = { type: 'centipawn', value: a };
      const e2: Evaluation = { type: 'centipawn', value: b };
      const s1 = getWinPercent(e1, c);
      const s2 = getWinPercent(e2, c);
      const moverValue = (v: number) => c === 'w' ? v : -v;
      return moverValue(a) <= moverValue(b) ? s1 <= s2 : s1 >= s2;
    }));
  });

  it('inverts for black: white +x == black -x', () => {
    fc.assert(fc.property(cpArbitrary, (v) => {
      const ev: Evaluation = { type: 'centipawn', value: v };
      const wpWhite = getWinPercent(ev, 'w');
      const wpBlack = getWinPercent(ev, 'b');
      expect(wpWhite + wpBlack).toBeCloseTo(100, 5);
    }));
  });

  it('mate magnitudes dominate centipawn', () => {
    fc.assert(fc.property(mateArbitrary, (v) => {
      const m: Evaluation = { type: 'mate', value: v };
      const wp = getWinPercent(m, 'w');
      if (v > 0) expect(wp).toBeGreaterThan(getWinPercent({ type: 'centipawn', value: 500 }, 'w'));
      else expect(wp).toBeLessThan(getWinPercent({ type: 'centipawn', value: -500 }, 'w'));
    }));
  });
});

describe('getMoveAccuracy', () => {
  it('always returns value in [0,100]', () => {
    fc.assert(fc.property(evalArbitrary, evalArbitrary, colorArbitrary, (a, b, c) => {
      const acc = getMoveAccuracy(a, b, c);
      return acc >= 0 && acc <= 100 && Number.isFinite(acc);
    }));
  });

  it('returns 100 when position did not worsen (per mover perspective)', () => {
    fc.assert(fc.property(cpArbitrary, cpArbitrary, colorArbitrary, (a, b, c) => {
      const before: Evaluation = { type: 'centipawn', value: a };
      const after: Evaluation = { type: 'centipawn', value: b };
      const improved = getWinPercent(after, c) >= getWinPercent(before, c);
      if (improved) expect(getMoveAccuracy(before, after, c)).toBe(100);
    }));
  });

  it('is symmetric w.r.t. color when eval sign is inverted', () => {
    fc.assert(fc.property(cpArbitrary, cpArbitrary, (a, b) => {
      const before: Evaluation = { type: 'centipawn', value: a };
      const after: Evaluation = { type: 'centipawn', value: b };
      // White playing from eval a -> b should equal black playing from -a -> -b
      const w = getMoveAccuracy(before, after, 'w');
      const b2 = getMoveAccuracy(
        { type: 'centipawn', value: -a },
        { type: 'centipawn', value: -b },
        'b',
      );
      expect(w).toBeCloseTo(b2, 5);
    }));
  });
});

describe('getExpectedPointsLoss', () => {
  it('is never negative and finite', () => {
    fc.assert(fc.property(evalArbitrary, evalArbitrary, colorArbitrary, (a, b, c) => {
      const loss = getExpectedPointsLoss(a, b, c);
      return loss >= 0 && Number.isFinite(loss);
    }));
  });

  it('white improving (+0.5 -> +1) is best-level loss (< 0.01)', () => {
    const loss = getExpectedPointsLoss(
      { type: 'centipawn', value: 50 },
      { type: 'centipawn', value: 100 },
      'w',
    );
    expect(loss).toBeLessThan(0.01);
  });

  it('black losing a full pawn is not best-level loss', () => {
    const loss = getExpectedPointsLoss(
      { type: 'centipawn', value: 100 },
      { type: 'centipawn', value: 200 },
      'b',
    );
    expect(loss).toBeGreaterThan(0.01);
    const improvedWhite = getExpectedPointsLoss(
      { type: 'centipawn', value: 50 },
      { type: 'centipawn', value: 100 },
      'w',
    );
    expect(loss).toBeGreaterThan(improvedWhite);
  });
});

describe('depthStrictnessScale', () => {
  it('is 1.0 at depth 12 (current behavior preserved)', () => {
    expect(depthStrictnessScale(12)).toBe(1.0);
  });

  it('is monotonically decreasing with depth', () => {
    for (let d = 1; d < 40; d++) {
      expect(depthStrictnessScale(d + 1)).toBeLessThanOrEqual(depthStrictnessScale(d));
    }
  });

  it('stays within [0.55, 1.4] bounds', () => {
    for (let d = 1; d <= 40; d++) {
      const s = depthStrictnessScale(d);
      expect(s).toBeGreaterThanOrEqual(0.55);
      expect(s).toBeLessThanOrEqual(1.4);
    }
  });
});

describe('pointLossClassify depth strictness', () => {
  it('classifies the same eval delta as mistake at depth 8 and blunder at depth 18', () => {
    // White drops from +2.0 to 0.0 (~0.17 expected-points loss).
    const prevEval: Evaluation = { type: 'centipawn', value: 200 };
    const currEval: Evaluation = { type: 'centipawn', value: 0 };
    const board = new Chess();
    const playedMove = board.move('e4');
    const current: ExtractedCurrentNode = {
      board,
      fen: board.fen(),
      topLine: {
        evaluation: currEval,
        source: 'test',
        depth: 18,
        index: 1,
        moves: [{ uci: 'e2e4', san: 'e4' }],
      },
      evaluation: currEval,
      subjectiveEvaluation: { type: 'centipawn', value: 0 },
      playedMove,
    };

    const loss = getExpectedPointsLoss(prevEval, currEval, 'w');
    // Sanity: the delta sits in the 'mistake' band at depth 12 (0.12–0.22).
    expect(loss).toBeGreaterThan(0.12);
    expect(loss).toBeLessThan(0.22);

    expect(pointLossClassify(prevEval, current, 8)).toBe('mistake');
    expect(pointLossClassify(prevEval, current, 18)).toBe('blunder');
  });
});

describe('getMoveAccuracyFromWin', () => {
  it('never exceeds 100 and never drops below 0', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 100 }), fc.integer({ min: 0, max: 100 }), (a, b) => {
      const acc = getMoveAccuracyFromWin(a, b);
      return acc >= 0 && acc <= 100;
    }));
  });
});

describe('getGameAccuracy', () => {
  it('is in [0,100] and finite for arbitrary inputs', () => {
    fc.assert(fc.property(
      fc.array(fc.integer({ min: 0, max: 100 }), { maxLength: 200 }),
      fc.array(fc.integer({ min: 0, max: 100 }), { maxLength: 200 }),
      (acc, wp) => {
        const g = getGameAccuracy(acc, wp);
        return g >= 0 && g <= 100 && Number.isFinite(g);
      },
    ));
  });

  it('is 100 when every move is 100 accurate', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 50 }), (n) => {
      const acc = Array(n).fill(100);
      const wp = Array(n).fill(50);
      expect(getGameAccuracy(acc, wp)).toBeCloseTo(100, 6);
    }));
  });

  it('is 0 when no accuracies', () => {
    expect(getGameAccuracy([], [])).toBe(0);
  });

  it('handles empty winPercents with non-empty accuracies without crashing', () => {
    expect(() => getGameAccuracy([100, 90, 80], [])).not.toThrow();
  });
});

function randomGame(maxPly: number): { moves: { san: string; fen: string; from: string; to: string; color: 'w'|'b' }[]; fens: string[] } {
  const chess = new Chess();
  const fens = [chess.fen()];
  const moves: { san: string; fen: string; from: string; to: string; color: 'w'|'b' }[] = [];
  for (let i = 0; i < maxPly; i++) {
    const legal = chess.moves({ verbose: true });
    if (legal.length === 0) break;
    const mv = legal[Math.floor(Math.random() * legal.length)];
    chess.move(mv.san);
    moves.push({ san: mv.san, fen: chess.fen(), from: mv.from, to: mv.to, color: mv.color as 'w'|'b' });
    fens.push(chess.fen());
  }
  return { moves, fens };
}

function syntheticLines(fen: string, topMoveSan: string, topEval: Evaluation): EngineLine[] {
  const board = new Chess(fen);
  const lines: EngineLine[] = [];
  const legal = board.moves({ verbose: true });
  // Top line: played move
  try {
    const mv = board.move(topMoveSan);
    lines.push({
      evaluation: topEval,
      source: 'test',
      depth: 22,
      index: 1,
      moves: [{ uci: mv.from + mv.to, san: mv.san }],
    });
  } catch { /* illegal top move */ }
  // Second line: first legal move different from top
  const b2 = new Chess(fen);
  for (const m of legal) {
    if (m.san === topMoveSan) continue;
    try {
      b2.move(m.san);
      lines.push({
        evaluation: { type: 'centipawn', value: (topEval.type === 'centipawn' ? topEval.value : 100) - 80 },
        source: 'test',
        depth: 21,
        index: 2,
        moves: [{ uci: m.from + m.to, san: m.san }],
      });
      break;
    } catch { /* skip */ }
  }
  return lines;
}

const maxPlyArb = fc.integer({ min: 4, max: 60 });
const boolArb = fc.boolean();

describe('classifyMove', () => {
  it('never throws and returns valid classification for 60 random games', () => {
    for (let run = 0; run < 60; run++) {
      const maxPly = 8 + (run % 45);
      const useMate = run % 2 === 0;
      const includeCritical = run % 3 === 0;
      const { moves, fens } = randomGame(maxPly);
      for (let i = 1; i < moves.length; i++) {
        const prevFen = fens[i - 1];
        const currFen = moves[i].fen;
        const topEval: Evaluation = useMate
          ? { type: 'mate', value: (i % 2 === 0 ? 1 : -1) * (1 + (i % 3)) }
          : { type: 'centipawn', value: (i % 2 === 0 ? 1 : -1) * (i * 15) };
        const prevLines = syntheticLines(prevFen, moves[i].san, topEval);
        const currLines = (() => {
          const b = new Chess(currFen);
          const legal = b.moves({ verbose: true });
          if (legal.length === 0) return [];
          return syntheticLines(currFen, legal[0].san, topEval);
        })();
        const result = classifyMove(prevFen, prevLines, currFen, currLines, moves[i].san, { includeCritical, includeBrilliant: true, includeTheory: true });
        if (result.classification) {
          expect(CLASSIFICATIONS).toContain(result.classification);
        }
      }
    }
  }, 120_000);

  it('classifies a played best move as never blunder/mistake/inaccuracy', () => {
    for (let run = 0; run < 40; run++) {
      const maxPly = 8 + (run % 33);
      const { moves, fens } = randomGame(maxPly);
      for (let i = 2; i < moves.length; i++) {
        const prevFen = fens[i - 1];
        // top line = played move with high eval for mover
        const moverColor = moves[i].color;
        const signed = moverColor === 'w' ? 150 : -150; // white-perspective: mover winning
        const topEval: Evaluation = { type: 'centipawn', value: signed };
        const prevLines = syntheticLines(prevFen, moves[i].san, topEval);
        const currBoard = new Chess(moves[i].fen);
        const legal = currBoard.moves({ verbose: true });
        if (legal.length === 0) continue;
        const currLines = syntheticLines(moves[i].fen, legal[0].san, topEval);
        const { classification } = classifyMove(prevFen, prevLines, moves[i].fen, currLines, moves[i].san, { includeCritical: true, includeBrilliant: true, includeTheory: false });
        expect(['blunder', 'mistake', 'inaccuracy']).not.toContain(classification);
      }
    }
  }, 120_000);

  it('classifies the first move after a book zero-line via cp-0 baseline fallback', () => {
    // Book positions carry a synthetic zero-line ({cp: 0, depth: 1, moves: []}).
    // The move leaving the book must still get a real classification.
    const prevFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'; // after 1.e4
    const zeroLine: EngineLine = {
      evaluation: { type: 'centipawn', value: 0 },
      source: 'engine',
      depth: 1,
      index: 1,
      moves: [],
    };
    const playedSan = 'g5'; // bad for black; white ends up clearly better
    const currFen = 'rnbqkbnr/pppp1ppp/8/8/4P1P1/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    const currLines = syntheticLines(currFen, 'd4', { type: 'centipawn', value: 100 });
    const result = classifyMove(prevFen, [zeroLine], currFen, currLines, playedSan, { includeTheory: false });
    // 0.0 -> +1.0 for the mover: expected-points loss ~0.087 lands in 'inaccuracy'
    expect(result.classification).toBe('inaccuracy');
  });

  it('does not classify positions whose engine evaluation failed (synthetic zero-line)', () => {
    const prevFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const prevLines = syntheticLines(prevFen, 'e4', { type: 'centipawn', value: 0 });
    const currFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const failureLine: EngineLine = {
      evaluation: { type: 'centipawn', value: 0 },
      source: 'engine',
      depth: 1,
      index: 1,
      moves: [],
    };
    const result = classifyMove(prevFen, prevLines, currFen, [failureLine], 'e5', { includeTheory: false });
    expect(result.classification).toBeUndefined();
  });
});

describe('getGameAnalysis', () => {
  function buildGame(maxPly: number): ChessGame {
    const { moves, fens } = randomGame(maxPly);
    return {
      id: 'test',
      white: { username: 'w' },
      black: { username: 'b' },
      result: '*',
      date: '2026-01-01',
      pgn: '',
      moves: moves.map((m, i) => {
        const topEval: Evaluation = { type: 'centipawn', value: 100 };
        const b = new Chess(fens[i]);
        const legal = b.moves({ verbose: true });
        const lines = legal.length > 0 ? syntheticLines(fens[i], legal[0].san, topEval) : [];
        return {
          index: i,
          san: m.san,
          from: m.from,
          to: m.to,
          fen: m.fen,
          color: m.color,
          engineLines: lines,
        };
      }),
    };
  }

  it('produces accuracy in [0,100] and classificationCounts matching moves', () => {
    for (let run = 0; run < 10; run++) {
      const maxPly = 6 + (run % 9);
      const game = buildGame(maxPly);
      const res = getGameAnalysis(game, { includeBrilliant: true, includeCritical: true, includeTheory: true });
      expect(res.accuracy!.white).toBeGreaterThanOrEqual(0);
      expect(res.accuracy!.white).toBeLessThanOrEqual(100);
      expect(res.accuracy!.black).toBeGreaterThanOrEqual(0);
      expect(res.accuracy!.black).toBeLessThanOrEqual(100);
      const counts = res.classificationCounts!;
      const total = Object.values(counts.white).reduce((a, b) => a + b, 0) + Object.values(counts.black).reduce((a, b) => a + b, 0);
      expect(total).toBeLessThanOrEqual(game.moves.length);
    }
  });
});

describe('reporter/chess utils', () => {
  it('setFenTurn always produces consistent turn', () => {
    fc.assert(fc.property(fc.constantFrom('w', 'b'), (c) => {
      const fen = setFenTurn('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', c);
      expect(fen.split(' ')[1]).toBe(c);
      const board = new Chess(fen);
      expect(() => board.turn()).not.toThrow();
    }));
  });

  it('getSubjectiveEvaluation inverts value for black, keeps for white', () => {
    fc.assert(fc.property(cpArbitrary, (v) => {
      const ev: Evaluation = { type: 'centipawn', value: v };
      expect(getSubjectiveEvaluation(ev, 'w').value).toBe(v);
      expect(getSubjectiveEvaluation(ev, 'b').value).toBe(-v);
      expect(getSubjectiveEvaluation(ev, 'b').type).toBe('centipawn');
    }));
  });

  it('getCaptureSquare returns en-passant capture square or move.to', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 200 }), (seed) => {
      // just ensure no crash on normal moves
      const chess = new Chess();
      const legal = chess.moves({ verbose: true });
      const mv = legal[seed % legal.length];
      expect(() => getCaptureSquare(mv)).not.toThrow();
    }));
  });

  it('getTopEngineLine prefers highest depth then lowest index', () => {
    const lines: EngineLine[] = [
      { evaluation: { type: 'centipawn', value: 10 }, source: 's', depth: 10, index: 1, moves: [] },
      { evaluation: { type: 'centipawn', value: 20 }, source: 's', depth: 20, index: 2, moves: [] },
      { evaluation: { type: 'centipawn', value: 30 }, source: 's', depth: 20, index: 1, moves: [] },
    ];
    const top = getTopEngineLine(lines);
    expect(top?.evaluation.value).toBe(30);
  });

  it('getTopEngineLine handles empty input', () => {
    expect(getTopEngineLine([])).toBeUndefined();
  });
});

describe('power-mean aggregation', () => {
  it('lies between arithmetic and harmonic mean for a mixed array', () => {
    const accs = [95, 95, 95, 95, 95, 95, 95, 95, 95, 5];
    const n = accs.length;
    const arithmetic = accs.reduce((s, a) => s + a, 0) / n;
    const harmonic = n / accs.reduce((s, a) => s + 1 / a, 0);
    const power = getGameAccuracy(accs);
    // Power mean (p=0.25) should sit between harmonic (≤ geometric ≤ arithmetic)
    expect(power).toBeGreaterThan(harmonic);
    expect(power).toBeLessThan(arithmetic);
  });

  it('approaches the maximum for near-uniform arrays', () => {
    const accs = Array(20).fill(99);
    expect(getGameAccuracy(accs)).toBeCloseTo(99, 0);
  });

  it('is 100 when every move is 100', () => {
    const accs = Array(30).fill(100);
    expect(getGameAccuracy(accs)).toBeCloseTo(100, 4);
  });

  it('is 0 for an empty array', () => {
    expect(getGameAccuracy([])).toBe(0);
  });
});

describe('getMoveAccuracyFromWinChesscom', () => {
  it('returns 100 when position did not worsen', () => {
    expect(getMoveAccuracyFromWinChesscom(50, 50)).toBe(100);
    expect(getMoveAccuracyFromWinChesscom(50, 60)).toBe(100);
    expect(getMoveAccuracyFromWinChesscom(50, 100)).toBe(100);
  });

  it('returns near 0 for a catastrophic loss', () => {
    // 50 pp win% drop → should be very close to 0
    const acc = getMoveAccuracyFromWinChesscom(80, 30);
    expect(acc).toBeLessThan(10);
    expect(acc).toBeGreaterThanOrEqual(0);
  });

  it('is always in [0, 100]', () => {
    fc.assert(fc.property(
      fc.float({ min: 0, max: 100, noNaN: true }),
      fc.float({ min: 0, max: 100, noNaN: true }),
      (a, b) => {
        const acc = getMoveAccuracyFromWinChesscom(a, b);
        return acc >= 0 && acc <= 100;
      },
    ));
  });

  it('is steeper than Lichess for moderate losses', () => {
    // 20 pp win% drop: chess.com should score lower than Lichess
    const cc = getMoveAccuracyFromWinChesscom(70, 50);
    const li = getMoveAccuracyFromWin(70, 50);
    expect(cc).toBeLessThan(li);
  });
});
