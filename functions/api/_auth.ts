// Shared Firebase ID-token verification for Cloudflare Pages Functions.
interface Env {
  VITE_FIREBASE_PROJECT_ID?: string;
}

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const KEY_TTL_MS = 60 * 60 * 1000;

let cachedKeys: { keys: Map<string, CryptoKey>; fetchedAt: number } | null = null;

async function getPublicKeys(): Promise<Map<string, CryptoKey>> {
  const now = Date.now();
  if (cachedKeys && now - cachedKeys.fetchedAt < KEY_TTL_MS) return cachedKeys.keys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error('Failed to fetch Firebase JWKS');
  const jwks = (await res.json()) as { keys: Array<{ kid: string; n: string; e: string }> };
  const keys = new Map<string, CryptoKey>();
  for (const jwk of jwks.keys) {
    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', use: 'sig' },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    keys.set(jwk.kid, key);
  }
  cachedKeys = { keys, fetchedAt: now };
  return keys;
}

function base64UrlDecode(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function verifyFirebaseToken(
  request: Request,
  env: Env
): Promise<{ uid: string; email?: string; name?: string; picture?: string } | null> {
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) return null;
  const authHeader = request.headers.get('Authorization') || '';
  const match = /^Bearer\s+(.+)$/.exec(authHeader);
  if (!match) return null;
  const token = match[1];
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(base64UrlDecode(parts[0]).toString()) as { alg?: string; kid?: string };
    const payload = JSON.parse(base64UrlDecode(parts[1]).toString()) as {
      iss?: string; aud?: string; exp?: number; sub?: string;
      email?: string; name?: string; picture?: string;
    };
    if (header.alg !== 'RS256') return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
    if (payload.aud !== projectId) return null;
    if (!payload.sub) return null;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now() - 60_000) return null;
    const keys = await getPublicKeys();
    const key = header.kid ? keys.get(header.kid) : undefined;
    if (!key) return null;
    const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const signature = base64UrlDecode(parts[2]);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data);
    if (!valid) return null;
    return { uid: payload.sub, email: payload.email, name: payload.name, picture: payload.picture };
  } catch {
    return null;
  }
}