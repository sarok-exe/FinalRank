import type { Client } from '@libsql/client/web';
import { createClient } from '@libsql/client/web';

// SECURITY WARNING: VITE_TURSO_AUTH_TOKEN is inlined into the client bundle at build time.
// Anyone viewing the built JS can extract it. In production this token grants direct
// read/write access to the Turso database. For a production deploy:
//   1. Restrict the Turso token to read-only
//   2. Use the Cloudflare Functions (/functions/api/) as a proxy for writes
//   3. Remove direct client-side Turso access entirely
// See: functions/api/game/save.ts and functions/api/game/[id].ts

let client: Client | null = null;
let _healthy = true;
let _failCount = 0;
const MAX_FAILURES = 2;

export function getTurso(): Client | null {
  if (!_healthy) return null;
  const url = import.meta.env.VITE_TURSO_DATABASE_URL as string;
  const token = import.meta.env.VITE_TURSO_AUTH_TOKEN as string | undefined;

  if (!client && url !== '') {
    try {
      // @libsql/client/web rejects "sql:" URLs (URL_SCHEME_NOT_SUPPORTED);
      // only libsql:/wss:/ws:/https:/http:/file: are allowed. Normalize.
      const normalized = url.replace(/^sql:/, 'https:');
      client = createClient({
        url: normalized,
        authToken: token ?? undefined,
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
  return import.meta.env.VITE_TURSO_DATABASE_URL as string !== '';
}

export function isTursoHealthy(): boolean {
  return _healthy;
}

export async function initTursoSchema(): Promise<void> {
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
        pgn_hash TEXT NOT NULL,
        depth INTEGER NOT NULL DEFAULT 10,
        engine TEXT NOT NULL DEFAULT '',
        pgn TEXT NOT NULL,
        analysis_data TEXT NOT NULL DEFAULT '{}',
        result TEXT,
        white TEXT,
        black TEXT,
        date TEXT,
        accuracy_white REAL,
        accuracy_black REAL,
        analyzed_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (pgn_hash, depth, engine)
      )
    `);

    // Migration: older DBs had pgn_hash as the only PK and no engine column.
    // Rebuild so multiple analyses (depth + engine) can coexist per game.
    try {
      const tableInfo = await db.execute('PRAGMA table_info(analyzed_games)');
      const hasEngine = tableInfo.rows.some((r) => (r as { name?: string }).name === 'engine');
      if (!hasEngine) {
        await db.execute('ALTER TABLE analyzed_games RENAME TO analyzed_games_old');
        await db.execute(`
          CREATE TABLE analyzed_games (
            pgn_hash TEXT NOT NULL,
            depth INTEGER NOT NULL DEFAULT 10,
            engine TEXT NOT NULL DEFAULT '',
            pgn TEXT NOT NULL,
            analysis_data TEXT NOT NULL DEFAULT '{}',
            result TEXT,
            white TEXT,
            black TEXT,
            date TEXT,
            accuracy_white REAL,
            accuracy_black REAL,
            analyzed_at TEXT DEFAULT (datetime('now')),
            PRIMARY KEY (pgn_hash, depth, engine)
          )
        `);
        await db.execute(`
          INSERT INTO analyzed_games (pgn_hash, depth, engine, pgn, analysis_data, result, white, black, date, accuracy_white, accuracy_black, analyzed_at)
          SELECT pgn_hash, depth, '', pgn, analysis_data, result, white, black, date, accuracy_white, accuracy_black, analyzed_at
          FROM analyzed_games_old
        `);
        await db.execute('DROP TABLE analyzed_games_old');
      }
    } catch {
      markTursoUnhealthy();
    }
    await db.execute(`
      CREATE TABLE IF NOT EXISTS shared_games (
        short_id TEXT PRIMARY KEY,
        game_data TEXT NOT NULL,
        uid TEXT NOT NULL DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS favorites (
        uid TEXT NOT NULL,
        game_id TEXT NOT NULL,
        game_data TEXT NOT NULL,
        favorited_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (uid, game_id)
      )
    `);
  } catch {
    markTursoUnhealthy();
  }
}
