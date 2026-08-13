interface Env {
  VITE_TURSO_DATABASE_URL?: string;
  VITE_TURSO_AUTH_TOKEN?: string;
}

function toHttpUrl(url: string): string {
  return url.replace(/^libsql:\/\//, 'https://');
}

type Cell = { type: 'text' | 'integer' | 'null'; value: string | null };

function toArg(value: string | number): Cell {
  return { type: typeof value === 'number' ? 'integer' : 'text', value: String(value) };
}

const ALLOWED_ORIGINS = [
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
  };
}

export async function onRequest(context: { request: Request; env: Env; params: { id: string } }): Promise<Response> {
  const headers = corsHeaders(context.request);

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  if (context.request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  const shortId = context.params.id;
  if (!shortId) {
    return new Response(JSON.stringify({ error: 'Missing game id' }), { status: 400, headers });
  }

  const url = context.env.VITE_TURSO_DATABASE_URL;
  const token = context.env.VITE_TURSO_AUTH_TOKEN;
  if (!url || !token) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 500, headers });
  }

  try {
    const httpUrl = toHttpUrl(url);
    const response = await fetch(`${httpUrl}/v2/pipeline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            type: 'execute',
            stmt: {
              sql: `CREATE TABLE IF NOT EXISTS shared_games (
                short_id TEXT PRIMARY KEY,
                game_data TEXT NOT NULL,
                uid TEXT NOT NULL DEFAULT '',
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
              )`,
              args: [],
            },
          },
          {
            type: 'execute',
            stmt: {
              sql: 'SELECT game_data FROM shared_games WHERE short_id = ?',
              args: [toArg(shortId)],
            },
          },
        ],
      }),
    });

    const result = await response.json() as {
      results?: Array<{ response?: { result?: { rows?: Array<unknown[] | string> } } }>;
    };
    const rows = result?.results?.[1]?.response?.result?.rows;

    if (rows && rows.length > 0) {
      const cell = rows[0] as Array<{ value?: unknown }> | string;
      const raw = typeof cell === 'string' ? cell : String(cell[0]?.value ?? cell[0]);
      const gameData = JSON.parse(raw);
      return new Response(JSON.stringify(gameData), { headers });
    }

    return new Response(JSON.stringify({ error: 'Game not found' }), { status: 404, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Fetch failed' }), { status: 500, headers });
  }
}
