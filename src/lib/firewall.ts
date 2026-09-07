/**
 * Client-side firewall and spam blocker for FinalRank.
 * Provides request throttling, suspicious activity detection, and spam prevention.
 */

import { isAllowed } from './rateLimit';

/** Check if an API call is allowed (rate limit) */
export function canMakeApiCall(service: 'chess.com' | 'lichess' | 'engine'): boolean {
  const limits: Record<string, [number, number]> = {
    'chess.com': [10, 60_000],     // 10 req/min
    'lichess': [10, 60_000],       // 10 req/min
    'engine': [5, 10_000],         // 5 req/10s
  };
  const [max, window] = limits[service] ?? [10, 60_000];
  return isAllowed(`api:${service}`, max, window);
}
