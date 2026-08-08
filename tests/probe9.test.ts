import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { classifyMove } from '../src/lib/reporter/classify';
function randomGame(maxPly: number): { moves: {san:string;fen:string;from:string;to:string;color:'w'|'b'}[]; fens: string[] } {
  const { Chess } = awaitImportChess();
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
function awaitImportChess(): typeof import('chess.js') {
  // dynamic-ish: return top-level Chess
  return { Chess: require('../src/../node_modules/chess.js').Chess } as never;
}
describe('probe9', () => {
  it('with try/catch inside loop', () => {
    fc.assert(fc.property(fc.integer({ min: 4, max: 60 }), fc.boolean(), fc.boolean(), (maxPly: number, useMate: boolean, includeCritical: boolean) => {
      const { moves, fens } = randomGame(maxPly);
      for (let i = 1; i < moves.length; i++) {
        try { classifyMove(fens[i-1], [], moves[i].fen, [], moves[i].san, { includeCritical }); } catch { }
      }
      return true;
    }, { numRuns: 40 }));
  });
});
