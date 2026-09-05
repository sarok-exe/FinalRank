import type { ChessGame } from '../types';

export function hashPgn(pgn: string): string {
  let hash = 5381;
  for (let i = 0; i < pgn.length; i++) {
    hash = ((hash << 5) + hash + pgn.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

export function engineLabel(engine: string): string {
  if (!engine) return 'Stockfish 18 Lite';
  if (engine.includes('stockfish-18-lite') || engine.includes('stockfish-18')) return 'Stockfish 18 Lite';
  if (engine.includes('lichess')) return 'Lichess Cloud';
  if (engine.includes('official')) return 'Stockfish Official';
  return engine;
}

export type AnalysisRunMeta = {
  depth: number;
  engine: string;
  analyzedAt: string;
};

const STORAGE_KEY = 'finalrank_analysis_cache';
const MAX_ENTRIES = 15;

type CacheEntry = {
  key: string;
  hash: string;
  depth: number;
  engine: string;
  analyzedAt: string;
  game: ChessGame;
};

function readCache(): CacheEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CacheEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCache(entries: CacheEntry[]): void {
  try {
    // LRU cap: evict oldest by analyzedAt when over the limit.
    const sorted = [...entries].sort((a, b) => (a.analyzedAt < b.analyzedAt ? -1 : a.analyzedAt > b.analyzedAt ? 1 : 0));
    const trimmed = sorted.length > MAX_ENTRIES ? sorted.slice(sorted.length - MAX_ENTRIES) : sorted;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Quota / private mode — degrade to no-op.
  }
}

export async function getCachedAnalysis(pgn: string, minDepth: number): Promise<ChessGame | null> {
  const hash = hashPgn(pgn);
  const entries = readCache()
    .filter((e) => e.hash === hash && e.depth >= minDepth)
    .sort((a, b) => b.depth - a.depth);
  return entries.length > 0 ? entries[0].game : null;
}

export async function saveCachedAnalysis(game: ChessGame, depth: number, engine: string = ''): Promise<void> {
  const hash = hashPgn(game.pgn);
  const key = `${hash}|${depth}|${engine}`;
  const analyzedAt = new Date().toISOString();
  const entries = readCache();
  const idx = entries.findIndex((e) => e.key === key);
  const entry: CacheEntry = { key, hash, depth, engine, analyzedAt, game };
  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);
  writeCache(entries);
}

export async function getCachedAnalysisByKey(pgn: string, depth: number, engine: string = ''): Promise<ChessGame | null> {
  const key = `${hashPgn(pgn)}|${depth}|${engine}`;
  const entry = readCache().find((e) => e.key === key);
  return entry ? entry.game : null;
}

export async function getPriorAnalyses(pgn: string): Promise<AnalysisRunMeta[]> {
  const hash = hashPgn(pgn);
  const seen = new Map<number, AnalysisRunMeta>();
  for (const e of readCache()) {
    if (e.hash !== hash) continue;
    const existing = seen.get(e.depth);
    if (!existing || e.analyzedAt > existing.analyzedAt) {
      seen.set(e.depth, { depth: e.depth, engine: e.engine, analyzedAt: e.analyzedAt });
    }
  }
  return [...seen.values()].sort((a, b) => b.depth - a.depth);
}

export async function batchCheckAnalysis(games: ChessGame[], minDepth: number): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};
  if (games.length === 0) return result;
  const entries = readCache();
  for (const g of games) {
    const hash = hashPgn(g.pgn);
    if (entries.some((e) => e.hash === hash && e.depth >= minDepth)) {
      result[hash] = true;
    }
  }
  return result;
}
