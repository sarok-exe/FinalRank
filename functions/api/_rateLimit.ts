interface Env {
  VITE_TURSO_DATABASE_URL?: string;
  VITE_TURSO_AUTH_TOKEN?: string;
}

type Cell = { type: 'text' | 'integer' | 'null'; value: string | null };

function toArg(value: string | number): Cell {
  return { type: typeof value === 'number' ? 'integer' : 'text', value: String(value) };
}

function toHttpUrl(url: string): string {
  return url.replace(/^libsql:\/\//, 'https://').replace(/^sql:\/\//, 'https://');
}

const WINDOW_SECONDS = 300;
const MAX_PER_UID = 60;
const MAX_PER_IP = 120;

const SCHEMA = `CREATE TABLE IF NOT EXISTS rate_limits (
  scope TEXT NOT NULL,
  bucket_key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, bucket_key, window_start)
);`;

async function pipeline(httpUrl: string, token: string, requests: unknown[]): Promise<unknown[]> {
  const res = await fetch(`${httpUrl}/v2/pipeline`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) throw new Error(`Turso ${res.status}`);
  const data = await res.json() as { results?: unknown[] };
  return data.results ?? [];
}

export function clientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export async function checkRateLimit(
  httpUrl: string,
  token: string,
  scope: 'uid' | 'ip',
  key: string,
  max: number
): Promise<{ ok: boolean }> {
  const windowStart = Math.floor(Date.now() / 1000 / WINDOW_SECONDS) * WINDOW_SECONDS;
  await pipeline(httpUrl, token, [
    { type: 'execute', stmt: { sql: SCHEMA, args: [] } },
    {
      type: 'execute',
      stmt: {
        sql: `INSERT INTO rate_limits (scope, bucket_key, window_start, count)
              VALUES (?, ?, ?, 1)
              ON CONFLICT(scope, bucket_key, window_start) DO UPDATE SET
                count = rate_limits.count + 1
              RETURNING count`,
        args: [toArg(scope), toArg(key), toArg(windowStart)],
      },
    },
  ]);
  const results = await pipeline(httpUrl, token, [
    {
      type: 'execute',
      stmt: {
        sql: 'SELECT count FROM rate_limits WHERE scope = ? AND bucket_key = ? AND window_start = ?',
        args: [toArg(scope), toArg(key), toArg(windowStart)],
      },
    },
  ]);
  const rows = (results[0] as { response?: { result?: { rows?: unknown[] } } })?.response?.result?.rows ?? [];
  const count = rows.length > 0 ? Number((rows[0] as Array<{ value?: unknown }>)[0]?.value ?? 0) : 0;
  return { ok: count <= max };
}

export async function checkRateLimits(
  httpUrl: string,
  token: string,
  uid: string,
  ip: string
): Promise<{ ok: boolean }> {
  const uidOk = await checkRateLimit(httpUrl, token, 'uid', uid, MAX_PER_UID);
  if (!uidOk.ok) return { ok: false };
  return checkRateLimit(httpUrl, token, 'ip', ip, MAX_PER_IP);
}