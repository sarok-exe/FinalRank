import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { Chess } from 'chess.js';
describe('probe12', () => {
  it('import chess.js only', () => {
    const mp = fc.integer({ min: 4, max: 60 });
    const b = fc.boolean();
    fc.assert(fc.property(mp, b, b, (a: number, x: boolean, y: boolean) => a > 0));
  });
});
