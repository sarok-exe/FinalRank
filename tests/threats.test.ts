import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { computeThreats, computeGameThreats } from '../src/lib/threats';

describe('computeThreats', () => {
  it('detects a queen attacked by an enemy rook', () => {
    const fen = '4r2k/8/8/4Q3/8/8/8/4K3 w - - 0 1';
    const threats = computeThreats(fen);
    expect(threats).toHaveLength(1);
    expect(threats[0]).toEqual({
      square: 'e5',
      piece: 'wQ',
      attackers: ['e8'],
      exploitable: false,
    });
  });

  it('reports multiple attackers for a single threatened piece', () => {
    // Black pawn d5 and black knight f6 both attack the white pawn on e4.
    const fen = '4k3/8/5n2/3p4/4P3/8/8/4K3 w - - 0 1';
    const threats = computeThreats(fen);
    const e4 = threats.find(t => t.square === 'e4');
    expect(e4).toBeDefined();
    expect(e4!.piece).toBe('wP');
    expect(e4!.attackers).toHaveLength(2);
    expect(e4!.attackers).toContain('d5');
    expect(e4!.attackers).toContain('f6');
  });

  it('returns no threats when no piece is attacked', () => {
    // Black rook on a8 attacks the a-file and 8th rank only — nothing hits e5/e1.
    const fen = 'r6k/8/8/4N3/8/8/8/4K3 w - - 0 1';
    expect(computeThreats(fen)).toEqual([]);
  });

  it('handles the starting position', () => {
    expect(computeThreats('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toEqual([]);
  });

  it('marks exploitable when the best move captures the threatened piece', () => {
    const fen = '4r2k/8/8/4Q3/8/8/8/4K3 w - - 0 1';
    const threats = computeThreats(fen, 'Rxe5');
    const queen = threats.find(t => t.square === 'e5');
    expect(queen).toBeDefined();
    expect(queen!.exploitable).toBe(true);
  });

  it('leaves exploitable false when the best move does not target the piece', () => {
    const fen = '4r2k/8/8/4Q3/8/8/8/4K3 w - - 0 1';
    const threats = computeThreats(fen, 'Re7');
    const queen = threats.find(t => t.square === 'e5');
    expect(queen).toBeDefined();
    expect(queen!.exploitable).toBe(false);
  });

  it('leaves exploitable false when no best move is provided', () => {
    const fen = '4r2k/8/8/4Q3/8/8/8/4K3 w - - 0 1';
    const threats = computeThreats(fen);
    expect(threats[0].exploitable).toBe(false);
  });
});

describe('computeGameThreats', () => {
  it('reconstructs fens from san-only moves', () => {
    const moves = [
      { san: 'e4' },
      { san: 'd5' },
      { san: 'exd5' },
      { san: 'Qxd5' },
    ];
    const results = computeGameThreats(moves);

    // Replay manually to get the true fens.
    const chess = new Chess();
    const fens: string[] = [];
    for (const m of moves) {
      chess.move(m.san!);
      fens.push(chess.fen());
    }

    expect(results).toHaveLength(moves.length);
    for (let i = 0; i < moves.length; i++) {
      expect(results[i]).toEqual(computeThreats(fens[i]));
    }

    // Sanity: after 3...Qxd5 the black queen on d5 attacks the white pawns on
    // a2, d2 and g2 (the d-file is blocked by the d2 pawn, so d1 is safe).
    const last = results[3];
    const a2 = last.find(t => t.square === 'a2');
    expect(a2).toBeDefined();
    expect(a2!.piece).toBe('wP');
    expect(a2!.attackers).toContain('d5');
  });

  it('replays san moves from initialFen when moves lack fen', () => {
    const initialFen = '4r2k/8/8/4Q3/8/8/8/4K3 w - - 0 1';
    const results = computeGameThreats([{ san: 'Qe7' }], initialFen);
    const chess = new Chess(initialFen);
    chess.move('Qe7');
    expect(results).toEqual([computeThreats(chess.fen())]);
  });

  it('passes moves[i+1].bestSan as bestMoveSan for each position', () => {
    const moves = [
      { san: 'e4', bestSan: 'e5' },
      { san: 'd5', bestSan: 'exd5' },
      { san: 'exd5', bestSan: 'Qxd5' },
      { san: 'Qxd5', bestSan: 'Nc3' },
    ];
    const results = computeGameThreats(moves);

    const chess = new Chess();
    const fens: string[] = [];
    for (const m of moves) {
      chess.move(m.san!);
      fens.push(chess.fen());
    }

    expect(results).toHaveLength(moves.length);
    for (let i = 0; i < moves.length; i++) {
      expect(results[i]).toEqual(computeThreats(fens[i], moves[i + 1]?.bestSan));
    }
  });

  it('returns an empty array for no moves', () => {
    expect(computeGameThreats([])).toEqual([]);
  });
});