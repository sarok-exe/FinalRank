#!/usr/bin/env node
/**
 * Sync the full lichess puzzle database into Turso.
 *
 * Source: https://database.lichess.org/lichess_db_puzzle.csv.zst
 *   (~6M puzzles; CSV columns: PuzzleId,FEN,Moves,Rating,RatingDeviation,
 *   Popularity,NbPlays,Themes,GameUrl,OpeningTags,DailyDate)
 *   Moves are space-separated UCI. The puzzle position to show a player is the
 *   FEN with the FIRST move applied; moves[1], moves[3], ... are the player's
 *   winning moves (opponent replies fill the even indices).
 *
 * Usage:
 *   node scripts/sync-puzzles.mjs                # full sync
 *   node scripts/sync-puzzles.mjs --limit 5000   # partial (testing)
 *   node scripts/sync-puzzles.mjs --skip-download
 *
 * Reads VITE_TURSO_DATABASE_URL / VITE_TURSO_AUTH_TOKEN from .env (dotenv).
 */

import 'dotenv/config';
import { createClient } from '@libsql/client';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import readline from 'node:readline';

const PUZZLE_URL = 'https://database.lichess.org/lichess_db_puzzle.csv.zst';
const TMP_DIR = join(tmpdir(), 'opencode');
const LOCAL_FILE = join(TMP_DIR, 'lichess_db_puzzle.csv.zst');

const args = process.argv.slice(2);
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;
const SKIP_DOWNLOAD = args.includes('--skip-download');
const fromArg = args.find(a => a.startsWith('--from-line='));
const FROM_LINE = fromArg ? parseInt(fromArg.split('=')[1], 10) : 0;

const PROGRESS_FILE = new URL('../.puzzles-sync-progress', import.meta.url).pathname;

const START = Date.now();
const log = (...m) => console.log(`[${((Date.now() - START) / 1000).toFixed(1)}s]`, ...m);

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

async function download() {
  log('downloading', PUZZLE_URL);
  const maxAttempts = 12;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(PUZZLE_URL);
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 120)}`);
      }
      const total = Number(res.headers.get('content-length') || 0);
      await mkdir(TMP_DIR, { recursive: true });
      const ws = createWriteStream(LOCAL_FILE);
      let received = 0;
      const reader = res.body.getReader();
      await new Promise((resolve, reject) => {
        const pump = async () => {
          try {
            const { done, value } = await reader.read();
            if (done) { ws.end(); resolve(); return; }
            received += value.byteLength;
            if (!ws.write(value)) {
              ws.once('drain', pump);
            } else {
              pump();
            }
            if (total > 0) {
              process.stdout.write(`\r  ${(received / 1048576).toFixed(1)}/${(total / 1048576).toFixed(1)} MB`);
            }
          } catch (err) { reject(err); }
        };
        pump();
      });
      process.stdout.write('\n');
      log('download complete', (received / 1048576).toFixed(1), 'MB');
      return;
    } catch (err) {
      const wait = Math.min(60, 8 * attempt) * 1000;
      log(`attempt ${attempt} failed (${err.message}); retry in ${wait / 1000}s`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  fail('download failed after retries');
}

async function* csvLines(zstdFile) {
  const child = spawn('zstd', ['-d', '-c', zstdFile], { stdio: ['ignore', 'pipe', 'inherit'] });
  const rl = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line || line.trim() === '') continue;
    yield line;
  }
  const code = await new Promise(resolve => child.on('close', resolve));
  if (code !== 0) fail('zstd failed to decompress');
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS puzzles (
  id TEXT PRIMARY KEY,
  fen TEXT NOT NULL,
  moves TEXT NOT NULL,
  rating INTEGER NOT NULL,
  rating_deviation INTEGER,
  popularity INTEGER,
  plays INTEGER,
  themes TEXT NOT NULL DEFAULT '',
  game_url TEXT,
  opening TEXT,
  daily_date TEXT,
  synced_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_puzzles_rating ON puzzles(rating);
CREATE TABLE IF NOT EXISTS puzzles_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);`;

function rowToStmt(r) {
  const c = r.split(',');
  const id = c[0];
  const fen = c[1];
  const moves = c[2];
  const rating = parseInt(c[3], 10) || 0;
  const rd = parseInt(c[4], 10) || 0;
  const popularity = parseInt(c[5], 10) || 0;
  const plays = parseInt(c[6], 10) || 0;
  const themes = c[7] || '';
  const gameUrl = c[8] || '';
  const opening = c[9] || '';
  const dailyDate = c[10] || '';
  return {
    sql: `INSERT INTO puzzles (id, fen, moves, rating, rating_deviation, popularity, plays, themes, game_url, opening, daily_date, synced_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            fen = excluded.fen,
            moves = excluded.moves,
            rating = excluded.rating,
            rating_deviation = excluded.rating_deviation,
            popularity = excluded.popularity,
            plays = excluded.plays,
            themes = excluded.themes,
            game_url = excluded.game_url,
            opening = excluded.opening,
            daily_date = excluded.daily_date,
            synced_at = datetime('now')`,
    args: [id, fen, moves, rating, rd, popularity, plays, themes, gameUrl, opening, dailyDate],
  };
}

async function withRetry(fn, label = 'db call') {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= 6) throw err;
      const wait = Math.min(120, 10 * attempt) * 1000;
      log(`${label} failed (${err.message?.slice(0, 80)}); retry ${attempt}/5 in ${wait / 1000}s`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

async function main() {
  const rawUrl = process.env.VITE_TURSO_DATABASE_URL;
  const token = process.env.VITE_TURSO_AUTH_TOKEN;
  if (!rawUrl || !token) {
    fail('VITE_TURSO_DATABASE_URL / VITE_TURSO_AUTH_TOKEN missing in .env');
  }
  const url = rawUrl.replace(/^sql:\/\//, 'https://').replace(/^libsql:\/\//, 'https://');
  const db = createClient({ url, authToken: token });

  log('ensuring schema');
  await withRetry(() => db.executeMultiple(SCHEMA));

  if (!SKIP_DOWNLOAD) {
    const REFRESH_AFTER_MS = 12 * 60 * 60 * 1000;
    const info = await stat(LOCAL_FILE).then(s => ({ size: s.size, mtime: s.mtimeMs }), () => null);
    if (info && info.size > 0 && Date.now() - info.mtime < REFRESH_AFTER_MS) {
      log('reusing cached file', (info.size / 1048576).toFixed(1), 'MB');
    } else {
      await download();
    }
  }

  log('parsing + inserting (limit=' + (LIMIT === Infinity ? 'all' : LIMIT) + ')');
  const BATCH = 5000;
  let rows = 0;
  let stmts = [];
  let failed = 0;
  let first = true;
  let processed = 0;

  const resumeFrom = await readFile(PROGRESS_FILE, 'utf8').then(
    n => Math.max(parseInt((n || '').trim(), 10) || 0, FROM_LINE),
    () => FROM_LINE,
  );
  if (resumeFrom > 0) {
    log(`resuming: skipping first ${resumeFrom.toLocaleString()} data lines`);
  }

  const commit = async (skipLog = false) => {
    if (stmts.length === 0) return;
    let attempt = 0;
    for (;;) {
      try {
        await db.batch(stmts);
        break;
      } catch (err) {
        attempt++;
        if (attempt >= 6) throw err;
        const wait = Math.min(120, 10 * attempt) * 1000;
        log(`batch failed (${err.message?.slice(0, 80)}); retry ${attempt}/5 in ${wait / 1000}s`);
        await new Promise(r => setTimeout(r, wait));
      }
    }
    const committed = rows;
    try {
      await writeFile(PROGRESS_FILE, String(committed));
    } catch {
      /* progress is best-effort */
    }
    stmts = [];
    if (!skipLog && rows % 500000 === 0) log(`${rows.toLocaleString()} rows inserted`);
  };

  for await (const line of csvLines(LOCAL_FILE)) {
    if (first) {
      first = false;
      continue;
    }
    if (rows >= LIMIT) break;
    rows++;
    if (processed < resumeFrom) {
      processed++;
      continue;
    }
    try {
      stmts.push(rowToStmt(line));
    } catch {
      failed++;
      continue;
    }
    if (stmts.length >= BATCH) {
      await commit();
    }
  }
  await commit();

  log(`done: ${rows.toLocaleString()} rows (${failed} skipped)`);
  await withRetry(() => db.execute({
    sql: `INSERT INTO puzzles_meta (key, value) VALUES ('last_sync', ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    args: [new Date().toISOString()],
  }));
  log('meta updated (last_sync)');
  db.close();
  process.exit(0);
}

main().catch(err => {
  console.error('sync failed:', err);
  process.exit(1);
});
