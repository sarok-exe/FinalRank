import { Engine } from './index';

let warmEngine: Engine | null = null;
let warming = false;

export function warmupEngine() {
  if (warming || warmEngine) return;
  warming = true;
  try {
    warmEngine = new Engine('stockfish-18-lite-single.js');
    warmEngine.setPosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    warmEngine.evaluate({ depth: 1 }).then(() => {});
  } catch {}
}

export function getWarmEngine(): Engine | null {
  const e = warmEngine;
  warmEngine = null;
  return e;
}

export function resetWarmEngine() {
  if (warmEngine) {
    try { warmEngine.terminate(); } catch {}
    warmEngine = null;
  }
  warming = false;
}
