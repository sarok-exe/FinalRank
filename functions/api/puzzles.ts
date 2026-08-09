interface Env {
  VITE_TURSO_DATABASE_URL?: string;
  VITE_TURSO_AUTH_TOKEN?: string;
  LICHESS_API_TOKEN?: string;
}

type Cell = { type: string; value: string };

function toHttpUrl(url: string): string {
  return url.replace(/^libsql:\/\//, 'https://').replace(/^sql:\/\//, 'https://');
}

// NOTE: Turso /v2/pipeline binds args as {type,value} objects where value is
// ALWAYS a string — even for integers ("integer" with stringified number).
// Plain values or {type:'integer',value:400} (non-string) both 400.
function toArg(value: string | number): Cell {
  return { type: typeof value === 'number' ? 'integer' : 'text', value: String(value) };
}

const ALLOWED_ORIGINS = [
  'https://finalrank.pages.dev',
  'https://finalrank.web.app',
  'https://finalrank.firebaseapp.com',
  'https://sarok-archive.web.app',
  'https://sarok-archive.firebaseapp.com',
  'http://localhost:5173',
  'http://localhost:3000',
];

function getCorsOrigin(request: Request): string {
  const origin = request.headers.get('Origin') || '';
  return ALLOWED_ORIGINS.includes(origin) ? origin : 'https://finalrank.web.app';
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = getCorsOrigin(request);
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
  };
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
  served INTEGER NOT NULL DEFAULT 0,
  synced_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_puzzles_rating ON puzzles(rating);
CREATE TABLE IF NOT EXISTS puzzles_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);`;

async function pipeline(httpUrl: string, token: string, requests: unknown[]): Promise<unknown[]> {
  const res = await fetch(`${httpUrl}/v2/pipeline`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) {
    throw new Error(`Turso ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json() as { results?: unknown[] };
  return data.results ?? [];
}

async function ensureSchema(httpUrl: string, token: string): Promise<void> {
  await pipeline(httpUrl, token, [{ type: 'execute', stmt: { sql: SCHEMA, args: [] } }]);
  try {
    await pipeline(httpUrl, token, [
      { type: 'execute', stmt: { sql: 'ALTER TABLE puzzles ADD COLUMN served INTEGER NOT NULL DEFAULT 0', args: [] } },
    ]);
  } catch {
    /* column already exists */
  }
}

// Pull new puzzles straight from the lichess puzzle stream and store them in the
// shared pool. Returns how many were added (0 when no token / nothing new).
async function refillFromLichess(httpUrl: string, dbToken: string, lichessToken: string, count: number, min: number, max: number): Promise<number> {
  const res = await fetch('https://lichess.org/api/puzzles', {
    headers: { 'Authorization': `Bearer ${lichessToken}`, 'Accept': 'application/x-ndjson' },
  });
  if (!res.ok || !res.body) return 0;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  const collected: { id: string; fen: string; moves: string; rating: number; themes: string }[] = [];

  while (collected.length < count) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (!line.trim()) continue;
      try {
        const p = JSON.parse(line) as { puzzleId?: string; fen?: string; moves?: string; rating?: number; themes?: string[] };
        if (p.puzzleId && p.fen && p.moves && p.rating != null && p.rating >= min && p.rating <= max) {
          collected.push({
            id: p.puzzleId,
            fen: p.fen,
            moves: p.moves,
            rating: p.rating,
            themes: (p.themes ?? []).join('|'),
          });
          if (collected.length >= count) break;
        }
      } catch {
        /* skip malformed line */
      }
    }
  }
  try { reader.releaseLock(); } catch { /* noop */ }

  if (collected.length === 0) return 0;

  const stmts = collected.map(p => ({
    type: 'execute',
    stmt: {
      sql: `INSERT INTO puzzles (id, fen, moves, rating, themes, served)
            VALUES (?, ?, ?, ?, ?, 0)
            ON CONFLICT(id) DO NOTHING`,
      args: [toArg(p.id), toArg(p.fen), toArg(p.moves), toArg(p.rating), toArg(p.themes)],
    },
  }));
  await pipeline(httpUrl, dbToken, [{ type: 'execute', stmt: { sql: SCHEMA, args: [] } }, ...stmts]);
  return collected.length;
}

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  const headers = corsHeaders(context.request);

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }
  if (context.request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  const url = context.env.VITE_TURSO_DATABASE_URL;
  const token = context.env.VITE_TURSO_AUTH_TOKEN;
  if (!url || !token) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 500, headers });
  }

  const params = new URL(context.request.url).searchParams;
  const count = Math.min(50, Math.max(1, parseInt(params.get('count') || '10', 10) || 10));
  const min = parseInt(params.get('min') || '400', 10) || 400;
  const max = parseInt(params.get('max') || '2000', 10) || 2000;

  try {
    const httpUrl = toHttpUrl(url);
    await ensureSchema(httpUrl, token);

    const fetchRandom = async (n: number): Promise<{ row: Cell[] }[]> => {
      const results = await pipeline(httpUrl, token, [
        {
          type: 'execute',
          stmt: {
            sql: `SELECT id, fen, moves, rating, popularity, plays, themes, opening, served
                  FROM puzzles WHERE rating BETWEEN ? AND ?
                  ORDER BY served ASC, RANDOM() LIMIT ?`,
            args: [toArg(min), toArg(max), toArg(n)],
          },
        },
      ]);
      return (results[0] as { response?: { result?: { rows?: { row: Cell[] }[] } } })?.response?.result?.rows ?? [];
    };

    let rows = await fetchRandom(count);

    // Pool ran dry for this range — top it up straight from lichess, then retry.
    if (rows.length < count && context.env.LICHESS_API_TOKEN) {
      const need = count - rows.length;
      try {
        await refillFromLichess(httpUrl, token, context.env.LICHESS_API_TOKEN, Math.max(need, 10), min, max);
        rows = await fetchRandom(count);
      } catch {
        /* refill failed; serve what the pool has */
      }
    }

    const puzzles = rows.map(r => {
      const cell = (i: number): string => {
        const c = r.row[i];
        return c != null ? String(c.value ?? '') : '';
      };
      return {
        id: cell(0),
        fen: cell(1),
        moves: cell(2),
        rating: Number(cell(3)),
        popularity: Number(cell(5)),
        plays: Number(cell(6)),
        themes: cell(7).split('|').filter(Boolean),
        opening: cell(8),
      };
    });

    // Bump served counters so popular puzzles don't dominate forever.
    if (puzzles.length > 0) {
      const ids = puzzles.map(p => toArg(p.id));
      const stmts = ids.map(id => ({
        type: 'execute',
        stmt: { sql: 'UPDATE puzzles SET served = served + 1 WHERE id = ?', args: [id] },
      }));
      try { await pipeline(httpUrl, token, stmts); } catch { /* non-fatal */ }
    }

    return new Response(JSON.stringify({ puzzles, count: puzzles.length }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Puzzle query failed' }), { status: 500, headers });
  }
}
