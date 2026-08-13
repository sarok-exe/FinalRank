export function generateShortId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(7);
  crypto.getRandomValues(array);
  let result = '';
  for (let i = 0; i < 7; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}

/**
 * Deterministic short id derived from a stable game identity (e.g. the game id).
 *
 * Linked games used to receive a fresh random shortId on every fetch, which made
 * share links go stale and created duplicate rows in the shared-games store.
 * Deriving the shortId from the stable id keeps the same URL across sessions.
 */
export function shortIdFromKey(key: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  hash = (hash ^ (hash >>> 13)) | 0;
  hash = (Math.imul(hash, 1274126177) ^ (hash >>> 16)) >>> 0;
  let result = '';
  for (let i = 0; i < 7; i++) {
    result += chars[hash % chars.length];
    hash = Math.floor(hash / chars.length);
  }
  return result;
}
