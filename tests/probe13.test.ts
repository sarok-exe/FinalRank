import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { Chess } from 'chess.js';
import { classifyMove } from '../src/lib/reporter/classify';
function randomGame(maxPly: number): { moves: any[]; fens: string[] } {
  const chess = new Chess();
  const fens = [chess.fen()];
  const moves: any[] = [];
  for (let i = 0; i < maxPly; i++) {
    const legal = chess.moves({ verbose: true });
    if (legal.length === 0) break;
    const mv = legal[Math.floor(Math.random() * legal.length)];
    chess.move(mv.san);
    moves.push({ san: mv.san, fen: chess.fen() });
    fens.push(chess.fen());
  }
  return { moves, fens };
}
describe('probe13', () => {
  it('randomGame only, no classify call', () => {
    const mp = fc.integer({ min: 4, max: 60 });
    fc.assert(fc.property(mp, (maxPly: number) => {
      const { moves, fens } = randomGame(maxPly);
      return moves.length === fens.length - 1;
    }, { numRuns: 40 }));
  });
  it('classify call with valid input, single arg', () => {
    const mp = fc.integer({ min: 4, max: 60 });
    fc.assert(fc.property(mp, (maxPly: number) => {
      const { moves, fens } = randomGame(maxPly);
      for (let i = 1; i < moves.length; i++) {
        try { classifyMove(fens[i-1], [], moves[i].fen, [], moves[i].san); } catch (e) { return false; }
      }
      return true;
    }, { numRuns: 40 }));
  });
});
