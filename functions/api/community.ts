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

  const params = new URL(context.request.url).searchParams;
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') || '50', 10) || 50));

  try {
    const httpUrl = toHttpUrl(url);
    await ensureSchema(httpUrl, token);

    const results = await pipeline(httpUrl, token, [
      {
        type: 'execute',
        stmt: {
          sql: `SELECT user_id, username, avatar, COUNT(*) AS matches, SUM(brilliant_count) AS brilliants, AVG(accuracy) AS avg_accuracy, MAX(analyzed_at) AS last_analysis
                FROM user_analysis_stats
                GROUP BY user_id, username, avatar
                HAVING COUNT(*) >= 3
                ORDER BY avg_accuracy DESC NULLS LAST, matches DESC, brilliants DESC, last_analysis DESC
                LIMIT ?`,
          args: [toArg(limit)],
        },
      },
    ]);

    const rows = (results[0] as { response?: { result?: { rows?: unknown[] } } })?.response?.result?.rows ?? [];

    const leaderboard = rows.map((r) => {
      const row = (Array.isArray(r) ? r : (r as { row?: Cell[] }).row) ?? [];
      const cell = (i: number): string => {
        const c = row[i];
        return c != null ? String(c.value ?? '') : '';
      };
      const avgRaw = cell(5) === '' ? null : Math.round(Number(cell(5)) * 10) / 10;
      return {
        userId: cell(0),
        username: cell(1),
        avatar: cell(2),
        matches: Number(cell(3) || 0),
        brilliants: Number(cell(4) || 0),
        avgAccuracy: avgRaw == null ? null : Number(avgRaw),
        lastAnalysis: cell(6),
      };
    });

    return new Response(JSON.stringify({ leaderboard }), { headers });
  } catch (err) {
    console.error('community fn error:', err instanceof Error ? err.stack : err);
    return new Response(JSON.stringify({ error: 'Leaderboard query failed', detail: String(err) }), { status: 500, headers });
  }
}
