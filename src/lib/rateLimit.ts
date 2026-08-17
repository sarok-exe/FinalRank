/**
 * Simple client-side rate limiter to prevent abuse.
 */

const buckets = new Map<string, { count: number; resetAt: number }>();

/**
 * Check if an action is allowed under the rate limit.
 * Returns true if allowed, false if rate-limited.
 */
export function isAllowed(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  
  if (bucket.count >= maxRequests) return false;
  bucket.count++;
  return true;
}

/** Reset a rate limit bucket */
export function resetLimit(key: string): void {
  buckets.delete(key);
}
