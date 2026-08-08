import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { classifyMove } from '../src/lib/reporter/classify';
function helper(x: number) { return x + 1; }
describe('probe10', () => {
  it('consts inside it + module helper', () => {
    const mp = fc.integer({ min: 4, max: 60 });
    const b = fc.boolean();
    fc.assert(fc.property(mp, b, b, (a: number, x: boolean, y: boolean) => helper(a) > 0));
  });
});
