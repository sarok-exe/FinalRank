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
    moves.push({ san: mv.san, fen: chess.fen(), from: mv.from, to: mv.to, color: mv.color });
    fens.push(chess.fen());
  }
  return { moves, fens };
}
describe('probe11', () => {
  it('exact replicate', () => {
    const mp = fc.integer({ min: 4, max: 60 });
    const b = fc.boolean();
    fc.assert(fc.property(mp, b, b, (maxPly: number, useMate: boolean, includeCritical: boolean) => {
      const { moves, fens } = randomGame(maxPly);
      for (let i = 1; i < moves.length; i++) {
        try { classifyMove(fens[i-1], [], moves[i].fen, [], moves[i].san, { includeCritical }); } catch {}
      }
    }, { numRuns: 40 }));
  });
});
