import { createClient, Client } from '@libsql/client/web';

let client: Client | null = null;
let _healthy = true;
let _failCount = 0;
const MAX_FAILURES = 2;

export function getTurso(): Client | null {
  if (!_healthy) return null;
  const url = import.meta.env.VITE_TURSO_DATABASE_URL;
  const token = import.meta.env.VITE_TURSO_AUTH_TOKEN;

  if (!client && url) {
    try {
      client = createClient({
        url,
        authToken: token || undefined,
      });
    } catch {
      client = null;
    }
  }
  return client;
}

export function markTursoUnhealthy(): void {
  _failCount++;
  if (_failCount >= MAX_FAILURES) {
    _healthy = false;
    client = null;
  }
}

export function resetTurso(): void {
  client = null;
  _failCount = 0;
  _healthy = true;
}

export function isTursoConfigured(): boolean {
  return !!import.meta.env.VITE_TURSO_DATABASE_URL;
}

export function isTursoHealthy(): boolean {
  return _healthy;
}

export async function initTursoSchema() {
  const db = getTurso();
  if (!db) return;

  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT,
        avatar TEXT,
        streak INTEGER DEFAULT 0,
        analyzed_count INTEGER DEFAULT 0,
        last_active_date TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS analyzed_games (
        pgn_hash TEXT PRIMARY KEY,
        pgn TEXT NOT NULL,
        depth INTEGER NOT NULL DEFAULT 10,
        analysis_data TEXT NOT NULL DEFAULT '{}',
        result TEXT,
        white TEXT,
        black TEXT,
        date TEXT,
        accuracy_white REAL,
        accuracy_black REAL,
        analyzed_at TEXT DEFAULT (datetime('now'))
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS shared_games (
        short_id TEXT PRIMARY KEY,
        game_data TEXT NOT NULL,
        uid TEXT NOT NULL DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
  } catch {
    markTursoUnhealthy();
  }
}
