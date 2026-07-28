import { Engine } from './index';
import { getEngineVersion } from './evaluate';

let warmEngine: Engine | null = null;
let warming = false;
let warmupPromise: Promise<void> | null = null;

export function warmupEngine() {
  if (warming || warmEngine) return;
  warming = true;
  try {
    const version = getEngineVersion(4);
    warmEngine = new Engine(version);
    warmEngine.setPosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    warmupPromise = warmEngine.evaluate({ depth: 1 }).then(() => {});
  } catch {}
}

export async function getWarmEngine(): Promise<Engine | null> {
  if (warmupPromise) await warmupPromise;
  warming = false;
  warmupPromise = null;
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
  warmupPromise = null;
}
