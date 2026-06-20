import { createClient, Client } from '@libsql/client/web';

let client: Client | null = null;

export function getTurso(): Client | null {
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

export function resetTurso(): void {
  client = null;
}

export function isTursoConfigured(): boolean {
  return !!import.meta.env.VITE_TURSO_DATABASE_URL;
}

export async function initTursoSchema() {
  const db = getTurso();
  if (!db) return;

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
}
