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
