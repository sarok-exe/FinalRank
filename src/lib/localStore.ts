/**
 * Local-first device cache over localStorage.
 *
 * Key: `finalrank_local_cache` — a single JSON blob containing
 *   { favorites: FavoriteMeta[], games: { [shortId]: FullGame }, order: string[] }
 *
 * Reads and writes are synchronous (localStorage).
 * Games are capped at MAX_GAMES and at MAX_BLOB_CHARS (oldest evicted first).
 * Favorites are uncapped.
 */

import type { EngineLine } from '../types';

const CACHE_KEY = 'finalrank_local_cache';
const MAX_GAMES = 50;
// localStorage quota is ~5MB per origin (measured in UTF-16 units, so
// JSON.stringify(...).length ≈ 2 bytes/char). Keep the game blob well under
// it so other keys (settings, analysis cache) always have room.
const MAX_BLOB_CHARS = 1_500_000;
// Cached moves keep at most 2 engine lines and 12 plies each — enough for
// the report, coach, and what-if features at a fraction of the size.
const MAX_CACHED_LINES = 2;
const MAX_CACHED_PLIES = 12;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type FavoriteMeta = {
  id: string;            // Firestore document id (gameId)
  shortId: string;
  white: { username: string; rating?: number; avatar?: string };
  black: { username: string; rating?: number; avatar?: string };
  result: string;
  date: string;
  classificationCounts?: Record<string, Record<string, number>>;
  accuracy?: { white: number; black: number };
  userSaved?: boolean;
  analyzedAt?: string;
};

export type FullGame = {
  id: string;
  shortId: string;
  white: { username: string; rating?: number; avatar?: string };
  black: { username: string; rating?: number; avatar?: string };
  result: string;
  date: string;
  pgn: string;
  moves: unknown[];
  initialPosition?: string;
  classificationCounts?: Record<string, Record<string, number>>;
  accuracy?: { white: number; black: number };
  userSaved?: boolean;
  analyzedAt?: string;
  analysisDurationMs?: number;
  analysisDepth?: number;
};

// ---------------------------------------------------------------------------
// Internal shape
// ---------------------------------------------------------------------------

type CacheBlob = {
  favorites: FavoriteMeta[];
  games: Record<string, FullGame>;
  order: string[];       // insertion-ordered shortIds for LRU eviction
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readBlob(): CacheBlob {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return { favorites: [], games: {}, order: [] };
    const parsed = JSON.parse(raw) as Partial<CacheBlob>;
    return {
      favorites: parsed.favorites ?? [],
      games: parsed.games ?? {},
      order: parsed.order ?? Object.keys(parsed.games ?? {}),
    };
  } catch {
    return { favorites: [], games: {}, order: [] };
  }
}

function writeBlob(blob: CacheBlob): void {
  evictToFit(blob);
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(blob));
  } catch (e) {
    // Quota exceeded — evict the oldest games until the write fits.
    while (blob.order.length > 0) {
      const oldest = blob.order.shift();
      if (oldest && blob.games[oldest]) {
        delete blob.games[oldest];
      }
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(blob));
        return;
      } catch { /* keep evicting */ }
    }
    console.warn('[LocalStore] write failed:', e);
  }
}

/** Estimated serialized size of the blob in UTF-16 units. */
function estimatedChars(blob: CacheBlob): number {
  try {
    return JSON.stringify(blob).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

/** Enforce the count cap, then the size cap — oldest games evicted first. */
function evictToFit(blob: CacheBlob): void {
  while (blob.order.length > MAX_GAMES) {
    const oldest = blob.order.shift();
    if (oldest && blob.games[oldest]) {
      delete blob.games[oldest];
    }
  }
  let size = estimatedChars(blob);
  while (blob.order.length > 0 && size > MAX_BLOB_CHARS) {
    const oldest = blob.order.shift();
    if (oldest && blob.games[oldest]) {
      delete blob.games[oldest];
    }
    size = estimatedChars(blob);
  }
}

/**
 * Trim a game for caching: cap engine lines and PV length per move so the
 * local cache stays small. Classifications and evals are already stored on
 * each move, so the report/coach/what-if features keep working.
 */
function trimGameForCache(game: FullGame): FullGame {
  const moves = game.moves.map(m => {
    const move = m as { engineLines?: EngineLine[] } | null;
    if (move == null || typeof move !== 'object' || !Array.isArray(move.engineLines)) {
      return m;
    }
    return {
      ...move,
      engineLines: move.engineLines
        .slice(0, MAX_CACHED_LINES)
        .map(line => ({ ...line, moves: line.moves.slice(0, MAX_CACHED_PLIES) })),
    };
  });
  return { ...game, moves };
}

// ---------------------------------------------------------------------------
// Public API — Favorites
// ---------------------------------------------------------------------------

/** Get all locally-cached favorite metadata (sync). */
export function getLocalFavorites(): FavoriteMeta[] {
  return readBlob().favorites;
}

/** Overwrite the entire favorites list in the local cache (sync). */
export function setLocalFavorites(favs: FavoriteMeta[]): void {
  const blob = readBlob();
  blob.favorites = favs;
  writeBlob(blob);
}

// ---------------------------------------------------------------------------
// Public API — Full games
// ---------------------------------------------------------------------------

/** Get all locally-cached games as an array (sync). */
export function getLocalGames(): FullGame[] {
  const blob = readBlob();
  return blob.order
    .map(sid => blob.games[sid])
    .filter((g): g is FullGame => g != null);
}

/** Store a full game in the local cache, evicting the oldest if needed (sync). */
export function setLocalGame(game: FullGame): void {
  const blob = readBlob();
  const sid = game.shortId || game.id;
  if (!blob.games[sid]) {
    blob.order.push(sid);
  }
  blob.games[sid] = trimGameForCache(game);
  writeBlob(blob);
}

/** Clear all games from the local cache (games map + order), keeping
 *  favorites and settings intact (sync). */
export function clearLocalGames(): void {
  const blob = readBlob();
  blob.games = {};
  blob.order = [];
  writeBlob(blob);
}

/** Update just the metadata fields of an already-cached game (sync).
 *  Useful for flipping userSaved or updating analysis stats without
 *  replacing the full PGN/moves blob. */
export function setLocalGameMeta(meta: Partial<FullGame> & { shortId: string; id: string }): void {
  const blob = readBlob();
  const existing = blob.games[meta.shortId];
  if (existing) {
    blob.games[meta.shortId] = { ...existing, ...meta };
  }
  // Also update in favorites list if present
  blob.favorites = blob.favorites.map(f =>
    f.id === meta.id ? { ...f, ...meta } : f,
  );
  writeBlob(blob);
}

// ---------------------------------------------------------------------------
// Public API — id-based helpers (for deleteUserGame which only has gameId)
// ---------------------------------------------------------------------------

/** Mark a game as userSaved:false by its document id (sync). */
export function markGameUnsavedById(id: string): void {
  const blob = readBlob();
  for (const sid of Object.keys(blob.games)) {
    if (blob.games[sid].id === id) {
      blob.games[sid] = { ...blob.games[sid], userSaved: false };
    }
  }
  blob.favorites = blob.favorites.filter(f => f.id !== id);
  writeBlob(blob);
}
