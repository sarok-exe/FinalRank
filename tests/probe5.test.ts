import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { classifyMove } from '../src/lib/reporter/classify';
describe('probe5', () => {
  it('inspect', () => {
    const i = fc.integer({ min: 4, max: 60 });
    const b = fc.boolean();
    const insp = (o: unknown) => typeof o === 'object' && o !== null && ('generate' in o) && ('shrink' in o) && ('canShrinkWithoutContext' in o);
    console.log('integer ok?', insp(i), 'bool ok?', insp(b));
    try {
      fc.assert(fc.property(i, b, b, (a: number, x: boolean, y: boolean) => a > 0));
      console.log('constructed+ran OK');
    } catch (e) {
      console.log('ERR', (e as Error).message);
    }
  });
});
