import { verifyFirebaseToken } from '../_auth';
import { checkRateLimits, clientIp } from '../_rateLimit';
import { isAllowedAvatar } from '../_validate';

interface Env {
  VITE_TURSO_DATABASE_URL?: string;
  VITE_TURSO_AUTH_TOKEN?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
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

  // Firebase ID-token auth — userId is ALWAYS derived from the verified token.
  const auth = await verifyFirebaseToken(context.request, context.env);
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }
  const userId = auth.uid;

  const url = context.env.VITE_TURSO_DATABASE_URL;
  const token = context.env.VITE_TURSO_AUTH_TOKEN;
  if (!url || !token) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 500, headers });
  }

  const httpUrl = toHttpUrl(url);

  // Rate limit (uid + IP) after auth.
  const rateOk = await checkRateLimits(httpUrl, token, userId, clientIp(context.request));
  if (!rateOk.ok) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429, headers });
  }

  let body: SaveBody;
  try {
    body = await context.request.json() as SaveBody;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers });
  }

  // username/avatar are DISPLAY-ONLY fields from the client (anonymous users
  // still appear on the leaderboard). Never trust a client-supplied userId.
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const avatar = typeof body.avatar === 'string' ? body.avatar : '';
  const pgnHash = typeof body.pgnHash === 'string' ? body.pgnHash : '';
  const shortId = typeof body.shortId === 'string' ? body.shortId : '';
  const gameLabel = typeof body.gameLabel === 'string' ? body.gameLabel : '';
  const accuracy = typeof body.accuracy === 'number' ? body.accuracy : null;
  const brilliantCount = typeof body.brilliantCount === 'number' ? body.brilliantCount : 0;
  const depth = typeof body.depth === 'number' ? body.depth : 0;

  // Validate required fields and lengths.
  if (!username || username.length > 32) {
    return new Response(JSON.stringify({ error: 'Invalid username' }), { status: 400, headers });
  }
  if (avatar !== '' && !isAllowedAvatar(avatar)) {
    return new Response(JSON.stringify({ error: 'Invalid avatar' }), { status: 400, headers });
  }
  if (!pgnHash || pgnHash.length > 128) {
    return new Response(JSON.stringify({ error: 'Invalid pgnHash' }), { status: 400, headers });
  }
  if (!shortId || shortId.length > 64) {
    return new Response(JSON.stringify({ error: 'Invalid shortId' }), { status: 400, headers });
  }
  if (!gameLabel || gameLabel.length > 200) {
    return new Response(JSON.stringify({ error: 'Invalid gameLabel' }), { status: 400, headers });
  }
  if (body.accuracy != null && typeof body.accuracy !== 'number') {
    return new Response(JSON.stringify({ error: 'Invalid accuracy' }), { status: 400, headers });
  }
  if (body.brilliantCount != null && typeof body.brilliantCount !== 'number') {
    return new Response(JSON.stringify({ error: 'Invalid brilliantCount' }), { status: 400, headers });
  }

  // Brilliants are only accepted from analyses at depth 15+.
  if (depth < 15) {
    return new Response(JSON.stringify({ error: 'Depth must be at least 15' }), { status: 400, headers });
  }

  try {
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
    return new Response(JSON.stringify({ error: 'Save failed' }), { status: 500, headers });
  }
}