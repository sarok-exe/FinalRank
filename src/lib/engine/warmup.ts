import { Engine } from './index';
import { getEngineVersion } from './evaluate';

let warmEngine: Engine | null = null;
let warming = false;

export function warmupEngine() {
  if (warming || warmEngine) return;
  warming = true;
  try {
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 4;
    const version = getEngineVersion(cores);
    warmEngine = new Engine(version);
    if (cores > 4) {
      warmEngine.setThreadCount(Math.max(1, Math.round(cores * 0.7)));
    }
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
