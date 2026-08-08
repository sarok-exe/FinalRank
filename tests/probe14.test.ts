import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { Chess } from 'chess.js';
describe('probe14', () => {
  it('logs before assert', () => {
    const mp = fc.integer({ min: 4, max: 60 });
    console.log('A before property');
    const prop = fc.property(mp, (maxPly: number) => {
      const chess = new Chess();
      for (let i = 0; i < maxPly; i++) {
        const legal = chess.moves({ verbose: true });
        if (legal.length === 0) break;
        chess.move(legal[Math.floor(Math.random() * legal.length)].san);
      }
      return true;
    });
    console.log('B property built');
    try {
      fc.assert(prop);
      console.log('C assert ok');
    } catch (e) {
      console.log('C ERR:', (e as Error).message);
    }
  });
});
