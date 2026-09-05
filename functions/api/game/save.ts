import { verifyFirebaseToken } from '../_auth';
import { checkRateLimits, clientIp } from '../_rateLimit';

interface Env {
  VITE_TURSO_DATABASE_URL?: string;
  VITE_TURSO_AUTH_TOKEN?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
}

function toHttpUrl(url: string): string {
  return url.replace(/^libsql:\/\//, 'https://');
}

type Cell = { type: 'text' | 'integer' | 'null'; value: string | null };

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
  };
}

const MAX_BODY_BYTES = 256 * 1024;

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  const headers = corsHeaders(context.request);

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  // Firebase ID-token auth — uid is ALWAYS derived from the verified token.
  const auth = await verifyFirebaseToken(context.request, context.env);
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }
  const uid = auth.uid;

  const url = context.env.VITE_TURSO_DATABASE_URL;
  const token = context.env.VITE_TURSO_AUTH_TOKEN;
  if (!url || !token) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 500, headers });
  }

  const httpUrl = toHttpUrl(url);

  // Rate limit (uid + IP) after auth.
  const rateOk = await checkRateLimits(httpUrl, token, uid, clientIp(context.request));
  if (!rateOk.ok) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429, headers });
  }

  // Read raw body first so we can reject oversized payloads before parsing.
  const raw = await context.request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers });
  }

  let body: { shortId: string; gameData: Record<string, unknown> };
  try {
    body = JSON.parse(raw) as { shortId: string; gameData: Record<string, unknown> };
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers });
  }

  const { shortId, gameData } = body;

  if (!shortId || shortId.length > 64) {
    return new Response(JSON.stringify({ error: 'Invalid shortId' }), { status: 400, headers });
  }
  if (!gameData || typeof gameData !== 'object' || Array.isArray(gameData)) {
    return new Response(JSON.stringify({ error: 'Invalid gameData' }), { status: 400, headers });
  }

  try {
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
              sql: `INSERT INTO shared_games (short_id, game_data, uid, updated_at)
                    VALUES (?, ?, ?, datetime('now'))
                    ON CONFLICT(short_id) DO UPDATE SET
                      game_data = excluded.game_data,
                      uid = excluded.uid,
                      updated_at = datetime('now')`,
              args: [toArg(shortId), toArg(JSON.stringify(gameData)), toArg(uid)],
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Turso write failed' }), { status: 502, headers });
    }

    return new Response(JSON.stringify({ ok: true }), { headers });
  } catch (err) {
    console.error('game save fn error:', err instanceof Error ? err.stack : err);
    return new Response(JSON.stringify({ error: 'Save failed' }), { status: 500, headers });
  }
}