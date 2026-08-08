import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { classifyMove } from '../src/lib/reporter/classify';
describe('probe7', () => {
  it('inline args + classify import', () => {
    fc.assert(fc.property(fc.integer({ min: 4, max: 60 }), fc.boolean(), fc.boolean(), (a: number, x: boolean, y: boolean) => a > 0));
  });
});
