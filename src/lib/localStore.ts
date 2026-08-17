/**
 * Local-first device cache over localStorage.
 *
 * Key: `finalrank_local_cache` — a single JSON blob containing
 *   { favorites: FavoriteMeta[], games: { [shortId]: FullGame }, order: string[] }
 *
 * Reads and writes are synchronous (localStorage).
 * Games are capped at MAX_GAMES; oldest (by insertion order) evicted first.
 * Favorites are uncapped.
 */

const CACHE_KEY = 'finalrank_local_cache';
const MAX_GAMES = 50;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type FavoriteMeta = {
  id: string;            // Firestore/Turso document id (gameId)
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

interface CacheBlob {
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
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(blob));
  } catch (e) {
    console.warn('[LocalStore] write failed:', e);
  }
}

function evictIfNeeded(blob: CacheBlob): void {
  while (blob.order.length > MAX_GAMES) {
    const oldest = blob.order.shift();
    if (oldest && blob.games[oldest]) {
      delete blob.games[oldest];
    }
  }
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

/** Get a single game by shortId (sync). Returns undefined if not cached. */
export function getLocalGame(shortId: string): FullGame | undefined {
  return readBlob().games[shortId];
}

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
  blob.games[sid] = game;
  evictIfNeeded(blob);
  writeBlob(blob);
}

/** Remove a game from the local cache by shortId (sync). */
export function removeLocalGame(shortId: string): void {
  const blob = readBlob();
  delete blob.games[shortId];
  blob.order = blob.order.filter(s => s !== shortId);
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

/** Remove a game from local cache by its document id (sync). */
export function removeLocalGameById(id: string): void {
  const blob = readBlob();
  for (const sid of Object.keys(blob.games)) {
    if (blob.games[sid].id === id) {
      delete blob.games[sid];
      blob.order = blob.order.filter(s => s !== sid);
    }
  }
  blob.favorites = blob.favorites.filter(f => f.id !== id);
  writeBlob(blob);
}

/** Check if a game is in the local cache by its document id (sync). */
export function hasLocalGame(id: string): boolean {
  const blob = readBlob();
  for (const sid of Object.keys(blob.games)) {
    if (blob.games[sid].id === id) return true;
  }
  return false;
}

/** Get a game from the local cache by its document id (sync). */
export function getLocalGameById(id: string): FullGame | undefined {
  const blob = readBlob();
  for (const sid of Object.keys(blob.games)) {
    if (blob.games[sid].id === id) return blob.games[sid];
  }
  return undefined;
}
