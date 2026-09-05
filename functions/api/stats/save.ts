interface Env {
  VITE_TURSO_DATABASE_URL?: string;
  VITE_TURSO_AUTH_TOKEN?: string;
}

type Cell = { type: 'text' | 'integer' | 'null'; value: string | null };

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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
  };
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS user_analysis_stats (
  user_id TEXT,
  username TEXT,
  avatar TEXT,
  pgn_hash TEXT,
  short_id TEXT,
  game_label TEXT,
  accuracy REAL,
  brilliant_count INTEGER,
  depth INTEGER,
  analyzed_at TEXT,
  PRIMARY KEY (user_id, pgn_hash)
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
}

type SaveBody = {
  userId?: unknown;
  username?: unknown;
  avatar?: unknown;
  pgnHash?: unknown;
  shortId?: unknown;
  gameLabel?: unknown;
  accuracy?: unknown;
  brilliantCount?: unknown;
  depth?: unknown;
};

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  const headers = corsHeaders(context.request);

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  const url = context.env.VITE_TURSO_DATABASE_URL;
  const token = context.env.VITE_TURSO_AUTH_TOKEN;
  if (!url || !token) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 500, headers });
  }

  let body: SaveBody;
  try {
    body = await context.request.json() as SaveBody;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers });
  }

  const userId = typeof body.userId === 'string' ? body.userId : '';
  const username = typeof body.username === 'string' ? body.username : '';
  const avatar = typeof body.avatar === 'string' ? body.avatar : '';
  const pgnHash = typeof body.pgnHash === 'string' ? body.pgnHash : '';
  const shortId = typeof body.shortId === 'string' ? body.shortId : '';
  const gameLabel = typeof body.gameLabel === 'string' ? body.gameLabel : '';
  const accuracy = typeof body.accuracy === 'number' ? body.accuracy : null;
  const brilliantCount = typeof body.brilliantCount === 'number' ? body.brilliantCount : 0;
  const depth = typeof body.depth === 'number' ? body.depth : 0;

  // Validate required fields.
  if (!userId || !username || !pgnHash || !shortId || !gameLabel) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers });
  }

  // Brilliants are only accepted from analyses at depth 15+.
  if (depth < 15) {
    return new Response(JSON.stringify({ error: 'Depth must be at least 15' }), { status: 400, headers });
  }

  try {
    const httpUrl = toHttpUrl(url);
    await ensureSchema(httpUrl, token);

    await pipeline(httpUrl, token, [
      {
        type: 'execute',
        stmt: {
          sql: `INSERT INTO user_analysis_stats (user_id, username, avatar, pgn_hash, short_id, game_label, accuracy, brilliant_count, depth, analyzed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(user_id, pgn_hash) DO NOTHING`,
          args: [
            toArg(userId),
            toArg(username),
            toArg(avatar),
            toArg(pgnHash),
            toArg(shortId),
            toArg(gameLabel),
            accuracy == null ? { type: 'null', value: null } : toArg(accuracy),
            toArg(brilliantCount),
            toArg(depth),
          ],
        },
      },
    ]);

    return new Response(JSON.stringify({ ok: true }), { headers });
  } catch (err) {
    console.error('stats save fn error:', err instanceof Error ? err.stack : err);
    return new Response(JSON.stringify({ error: 'Save failed', detail: String(err) }), { status: 500, headers });
  }
}
