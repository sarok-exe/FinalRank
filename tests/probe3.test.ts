import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { classifyMove } from '../src/lib/reporter/classify';

function randomGame(maxPly: number): { moves: { san: string; fen: string; from: string; to: string; color: 'w'|'b' }[]; fens: string[] } {
  const { Chess } = require('../node_modules/chess.js') as typeof import('chess.js');
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

describe('probe3', () => {
  it('classify random', () => {
    fc.assert(fc.property(fc.integer({ min: 4, max: 60 }), fc.boolean(), fc.boolean(), (maxPly, useMate, includeCritical) => {
      const { moves, fens } = randomGame(maxPly);
      for (let i = 1; i < moves.length; i++) {
        classifyMove(fens[i-1], [], moves[i].fen, [], moves[i].san, { includeCritical });
      }
    }, { numRuns: 40 }));
  });
});
