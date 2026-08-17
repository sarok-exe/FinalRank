/**
 * Browser-side Cache API helpers for static assets.
 *
 * Uses a dedicated cache bucket (`finalrank-assets-v1`) separate from the
 * Service Worker so the two layers never collide.  Every public function
 * silently degrades to normal network behaviour when the Cache API is
 * unavailable or throws.
 */

const CACHE_NAME = 'finalrank-assets-v1';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function hasCacheApi(): boolean {
  try {
    return typeof caches !== 'undefined' && typeof caches.open === 'function';
  } catch {
    return false;
  }
}

async function openCache(): Promise<Cache | null> {
  if (!hasCacheApi()) return null;
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Classification icons                                               */
/* ------------------------------------------------------------------ */

/** Base names for every classification icon in `public/img/classifications/`. */
const CLASSIFICATION_BASES = [
  'alternative',
  'best',
  'blunder',
  'book',
  'brilliant',
  'checkmate_black',
  'checkmate_white',
  'correct',
  'critical',
  'draw_black',
  'draw_white',
  'excellent',
  'fast_win',
  'forced',
  'free_piece',
  'good',
  'inaccuracy',
  'incorrect',
  'mate',
  'missed_win',
  'mistake',
  'unnamed_clock_black',
  'unnamed_clock_white',
  'unnamed_redo',
  'unnamed_updown_arrow',
  'resign_black',
  'resign_white',
  'sharp',
  'take_back',
  'threat',
  'winner',
];

/**
 * Precache every classification icon (SVG + 64× PNG) into the Cache API
 * bucket.  Called once at application start.  Failures are silent — the app
 * still works perfectly without cached icons.
 */
export async function precacheAssets(): Promise<void> {
  const cache = await openCache();
  if (!cache) return;

  const urls: string[] = [];
  for (const base of CLASSIFICATION_BASES) {
    urls.push(`/img/classifications/${base}.svg`);
    urls.push(`/img/classifications/${base}_64x.png`);
  }

  await Promise.allSettled(
    urls.map(async (url) => {
      try {
        // Skip if already cached.
        const existing = await cache.match(url);
        if (existing) return;
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
        }
      } catch {
        // Silent — degrade to network.
      }
    }),
  );
}

/* ------------------------------------------------------------------ */
/*  Generic asset cache                                                */
/* ------------------------------------------------------------------ */

/**
 * Return the cached `Response` for `url`, or `null` if it is not in the
 * cache (or the Cache API is unavailable).
 */
export async function getCachedAsset(url: string): Promise<Response | null> {
  const cache = await openCache();
  if (!cache) return null;
  try {
    const response = await cache.match(url);
    return response ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch `url` from the network and store the response in the cache.
 * Intended for background caching (callers should not block on this).
 */
export async function cacheAsset(url: string): Promise<void> {
  const cache = await openCache();
  if (!cache) return;
  try {
    const response = await fetch(url);
    if (response.ok) {
      await cache.put(url, response);
    }
  } catch {
    // Silent — degrade to network.
  }
}

/**
 * Convenience alias used by engine caching to store the engine JS file.
 */
export const cacheEngine = cacheAsset;
