import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { classifyMove } from '../src/lib/reporter/classify';
describe('probe8', () => {
  it('block body loop', () => {
    fc.assert(fc.property(fc.integer({ min: 4, max: 60 }), fc.boolean(), fc.boolean(), (maxPly: number, useMate: boolean, includeCritical: boolean) => {
      for (let i = 0; i < maxPly; i++) {
        if (i % 3 === 0 && includeCritical) classifyMove('x', [], 'y', [], 'z', { includeCritical });
      }
    }));
  });
});
