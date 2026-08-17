/**
 * Client-side firewall and spam blocker for FinalRank.
 * Provides request throttling, suspicious activity detection, and spam prevention.
 */

import { isAllowed } from './rateLimit';

const SUSPICIOUS_ACTIVITY_KEY = 'finalrank_suspicious';
const MAX_SUSPICIOUS_EVENTS = 10;

/** Check if an API call is allowed (rate limit) */
export function canMakeApiCall(service: 'chess.com' | 'lichess' | 'turso' | 'engine'): boolean {
  const limits: Record<string, [number, number]> = {
    'chess.com': [10, 60_000],     // 10 req/min
    'lichess': [10, 60_000],       // 10 req/min
    'turso': [30, 60_000],         // 30 req/min
    'engine': [5, 10_000],         // 5 req/10s
  };
  const [max, window] = limits[service] ?? [10, 60_000];
  return isAllowed(`api:${service}`, max, window);
}

/** Check if a game write is allowed (anti-spam) */
export function canWriteGame(): boolean {
  return isAllowed('game:write', 20, 60_000); // 20 writes/min
}

/** Check if a user action is allowed (prevents rapid-fire clicks) */
export function canPerformAction(action: string): boolean {
  return isAllowed(`action:${action}`, 30, 10_000); // 30 per 10s
}

/** Log suspicious activity */
export function logSuspiciousActivity(reason: string): void {
  try {
    const events = JSON.parse(localStorage.getItem(SUSPICIOUS_ACTIVITY_KEY) ?? '[]');
    events.push({ reason, timestamp: Date.now() });
    if (events.length > MAX_SUSPICIOUS_EVENTS) {
      events.splice(0, events.length - MAX_SUSPICIOUS_EVENTS);
    }
    localStorage.setItem(SUSPICIOUS_ACTIVITY_KEY, JSON.stringify(events));
  } catch { /* ignore */ }
}

/** Check if a request looks suspicious (for spam prevention) */
export function isSuspiciousRequest(data: Record<string, unknown>): boolean {
  // Check for oversized payloads
  const jsonSize = JSON.stringify(data).length;
  if (jsonSize > 500_000) { // 500KB limit
    logSuspiciousActivity('oversized_payload');
    return true;
  }
  // Check for rapid repeated data (same content submitted multiple times)
  const fingerprint = JSON.stringify(data).slice(0, 200);
  return isAllowed(`spam:${fingerprint}`, 3, 60_000) === false;
}
