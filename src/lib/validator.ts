/**
 * Input validation and sanitization utilities for FinalRank.
 */

/** Validate chess platform usernames (Chess.com, Lichess) */
export function isValidUsername(username: string): boolean {
  // 1-30 chars, alphanumeric + underscore + hyphen
  return /^[a-zA-Z0-9_-]{1,30}$/.test(username.trim());
}

/** Validate PGN string — basic structure check + size limit */
export function isValidPgn(pgn: string, maxSize = 65536): boolean {
  if (pgn.length > maxSize) return false;
  // Must contain at least one move number or SAN move
  return /\d+\.\s*\S+/.test(pgn) || pgn.split(/\s+/).length > 2;
}

/** Clamp a number to a range */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
