import type { ChessGame } from '../types';

export type LeaderboardEntry = {
  userId: string;
  username: string;
  avatar: string;
  matches: number;        // number of distinct analyzed games (depth>=15, deduped by game)
  brilliants: number;     // total accepted brilliants
  avgAccuracy: number | null; // rounded to 1 decimal
  lastAnalysis: string;   // ISO/UTC text from DB
};

export type CommunityMatchSummary = {
  pgnHash: string;
  shortId: string;
  gameLabel: string;      // "White vs Black"
  brilliantCount: number;
  accuracy: number | null;
  analyzedAt: string;
};

export type CommunityUserStats = {
  userId: string;
  username: string;
  avatar: string;
  matches: number;
  brilliants: number;
  avgAccuracy: number | null;
  strongest: CommunityMatchSummary | null; // most brilliants, tie-break highest accuracy
  recent: CommunityMatchSummary[];         // latest 10 by analyzed_at
};

/** Heuristic rating estimate from average game accuracy.
 *  Returns null when fewer than 3 matches (insufficient data) or unknown accuracy.
 *  Bands: >=97 -> 2100, >=94 -> 1900, >=90 -> 1700, >=85 -> 1500, >=78 -> 1300, >=70 -> 1100, else 900. */
export function estimateRating(avgAccuracy: number | null, matches: number): number | null {
  if (matches < 3 || avgAccuracy == null) return null;
  if (avgAccuracy >= 97) return 2100;
  if (avgAccuracy >= 94) return 1900;
  if (avgAccuracy >= 90) return 1700;
  if (avgAccuracy >= 85) return 1500;
  if (avgAccuracy >= 78) return 1300;
  if (avgAccuracy >= 70) return 1100;
  return 900;
}

/** Minimum analyzed matches (depth 15+) required to appear on the leaderboard,
 *  consistent with the rating estimate's insufficient-data rule. */
export const LEADERBOARD_MIN_MATCHES = 3;

/** Comparator for the community leaderboard: rank by average accuracy
 *  descending (nulls last), ties broken by more matches first. */
export function compareLeaderboardEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
  const aAcc = a.avgAccuracy;
  const bAcc = b.avgAccuracy;

  // Entries with a known accuracy always rank above those without one.
  if (aAcc != null && bAcc == null) return -1;
  if (aAcc == null && bAcc != null) return 1;

  // Higher average accuracy ranks first.
  if (aAcc != null && bAcc != null && aAcc !== bAcc) return bAcc - aAcc;

  // Accuracy tie (or both unknown): more matches first.
  return b.matches - a.matches;
}

/** Rank leaderboard entries for display: drop users below the minimum match
 *  count, then order by average accuracy DESC (nulls last) with matches as
 *  tiebreak. */
export function rankLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return entries
    .filter((entry) => entry.matches >= LEADERBOARD_MIN_MATCHES)
    .sort(compareLeaderboardEntries);
}
