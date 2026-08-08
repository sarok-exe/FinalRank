import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { classifyMove } from '../src/lib/reporter/classify';
function randomGame(maxPly: number) { return { moves: [] as unknown[], fens: ['x'] }; }
describe('probe6', () => {
  it('noop body', () => {
    fc.assert(fc.property(fc.integer({ min: 4, max: 60 }), fc.boolean(), fc.boolean(), (maxPly: number, useMate: boolean, includeCritical: boolean) => {
      const { moves, fens } = randomGame(maxPly);
      for (let i = 1; i < moves.length; i++) {
        classifyMove(fens[i-1], [], moves[i].fen, [], moves[i].san, { includeCritical });
      }
    }, { numRuns: 40 }));
  });
});
