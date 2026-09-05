interface Env {
  VITE_TURSO_DATABASE_URL?: string;
  VITE_TURSO_AUTH_TOKEN?: string;
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

  const userId = decodeURIComponent(context.request.url.split('/').pop() || '');

  try {
    const httpUrl = toHttpUrl(url);
    await ensureSchema(httpUrl, token);

    const results = await pipeline(httpUrl, token, [
      {
        type: 'execute',
        stmt: {
          sql: 'SELECT username, avatar FROM user_analysis_stats WHERE user_id = ? LIMIT 1',
          args: [toArg(userId)],
        },
      },
      {
        type: 'execute',
        stmt: {
          sql: 'SELECT COUNT(*) AS matches, SUM(brilliant_count) AS brilliants, AVG(accuracy) AS avg_accuracy FROM user_analysis_stats WHERE user_id = ?',
          args: [toArg(userId)],
        },
      },
      {
        type: 'execute',
        stmt: {
          sql: `SELECT pgn_hash, short_id, game_label, brilliant_count, accuracy, analyzed_at
                FROM user_analysis_stats
                WHERE user_id = ?
                ORDER BY brilliant_count DESC, accuracy DESC NULLS LAST, analyzed_at DESC
                LIMIT 1`,
          args: [toArg(userId)],
        },
      },
      {
        type: 'execute',
        stmt: {
          sql: `SELECT pgn_hash, short_id, game_label, brilliant_count, accuracy, analyzed_at
                FROM user_analysis_stats
                WHERE user_id = ?
                ORDER BY analyzed_at DESC
                LIMIT 10`,
          args: [toArg(userId)],
        },
      },
    ]);

    const profileRows = (results[0] as { response?: { result?: { rows?: unknown[] } } })?.response?.result?.rows ?? [];
    if (profileRows.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers });
    }

    const aggRows = (results[1] as { response?: { result?: { rows?: unknown[] } } })?.response?.result?.rows ?? [];
    const strongestRows = (results[2] as { response?: { result?: { rows?: unknown[] } } })?.response?.result?.rows ?? [];
    const recentRows = (results[3] as { response?: { result?: { rows?: unknown[] } } })?.response?.result?.rows ?? [];

    const cellOf = (row: unknown[], i: number): string => {
      const c = row[i] as Cell | undefined;
      return c != null ? String(c.value ?? '') : '';
    };

    const toSummary = (row: unknown[]) => ({
      pgnHash: cellOf(row, 0),
      shortId: cellOf(row, 1),
      gameLabel: cellOf(row, 2),
      brilliantCount: Number(cellOf(row, 3) || 0),
      accuracy: cellOf(row, 4) === '' ? null : Number(cellOf(row, 4)),
      analyzedAt: cellOf(row, 5),
    });

    const profileRow = (Array.isArray(profileRows[0]) ? profileRows[0] : (profileRows[0] as { row?: Cell[] }).row) ?? [];
    const aggRow = (Array.isArray(aggRows[0]) ? aggRows[0] : (aggRows[0] as { row?: Cell[] }).row) ?? [];

    const avgRaw = cellOf(aggRow, 2) === '' ? null : Math.round(Number(cellOf(aggRow, 2)) * 10) / 10;

    const strongest = strongestRows.length > 0
      ? toSummary((Array.isArray(strongestRows[0]) ? strongestRows[0] : (strongestRows[0] as { row?: Cell[] }).row) ?? [])
      : null;

    const recent = recentRows.map((r) =>
      toSummary((Array.isArray(r) ? r : (r as { row?: Cell[] }).row) ?? [])
    );

    return new Response(JSON.stringify({
      userId,
      username: cellOf(profileRow, 0),
      avatar: cellOf(profileRow, 1),
      matches: Number(cellOf(aggRow, 0) || 0),
      brilliants: Number(cellOf(aggRow, 1) || 0),
      avgAccuracy: avgRaw == null ? null : Number(avgRaw),
      strongest,
      recent,
    }), { headers });
  } catch (err) {
    console.error('community user fn error:', err instanceof Error ? err.stack : err);
    return new Response(JSON.stringify({ error: 'User stats query failed' }), { status: 500, headers });
  }
}
