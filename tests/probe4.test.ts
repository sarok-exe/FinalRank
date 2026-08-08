import { describe, it } from 'vitest';
import * as fc from 'fast-check';
describe('probe4', () => {
  it('with numRuns', () => {
    fc.assert(fc.property(fc.integer({ min: 4, max: 60 }), fc.boolean(), fc.boolean(), (a, b, c) => a > 0 || b || c), { numRuns: 40 });
  });
});
