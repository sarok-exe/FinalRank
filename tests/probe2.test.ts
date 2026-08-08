import { describe, it } from 'vitest';
import * as fc from 'fast-check';
describe('probe2', () => {
  it('three arb args', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 9 }), fc.boolean(), fc.boolean(), (a, b, c) => a > 0 || b || c));
  });
  it('fc.integer max 60 boolean boolean', () => {
    fc.assert(fc.property(fc.integer({ min: 4, max: 60 }), fc.boolean(), fc.boolean(), (a, b, c) => a > 0));
  });
});
