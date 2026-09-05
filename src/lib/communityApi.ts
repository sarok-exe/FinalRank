import type { ChessGame } from '../types';
import type { CommunityUserStats, LeaderboardEntry } from './community';
import { hashPgn } from './analysisCache';

const API_BASE = '/api';

export async function fetchLeaderboard(limit?: number): Promise<LeaderboardEntry[]> {
  try {
    const qs = limit != null ? `?limit=${encodeURIComponent(limit)}` : '';
    const res = await fetch(`${API_BASE}/community${qs}`);
    if (!res.ok) return [];
    const data = await res.json() as { leaderboard?: LeaderboardEntry[] };
    return data.leaderboard ?? [];
  } catch {
    return [];
  }
}

export async function fetchCommunityUserStats(userId: string): Promise<CommunityUserStats | null> {
  try {
    const res = await fetch(`${API_BASE}/community/${encodeURIComponent(userId)}`);
    if (!res.ok) return null;
    return await res.json() as CommunityUserStats;
  } catch {
    return null;
  }
}

export async function saveAnalysisStats(
  user: { id: string; username: string; avatar?: string; chessComUsername?: string },
  game: ChessGame,
  depth: number
): Promise<void> {
  // Brilliants are only accepted from analyses at depth 15+.
  if (depth < 15) return;

  try {
    const pgnHash = hashPgn(game.pgn);

    // Determine the user's side from their account name or linked chess.com
    // username (both compared case-insensitively after trim). A brilliant is only
    // accepted when the name of the player matches the name the user chose for
    // their account.
    const accountName = user.username.trim();
    const chessCom = (user.chessComUsername ?? '').trim();
    const whiteName = game.white?.username ?? '';
    const blackName = game.black?.username ?? '';
    const matchesWhite =
      (accountName !== '' && whiteName !== '' && accountName.toLowerCase() === whiteName.toLowerCase()) ||
      (chessCom !== '' && whiteName !== '' && chessCom.toLowerCase() === whiteName.toLowerCase());
    const matchesBlack =
      (accountName !== '' && blackName !== '' && accountName.toLowerCase() === blackName.toLowerCase()) ||
      (chessCom !== '' && blackName !== '' && chessCom.toLowerCase() === blackName.toLowerCase());
    let side: 'w' | 'b' | null = null;
    if (matchesWhite) side = 'w';
    else if (matchesBlack) side = 'b';

    // Accuracy: user's side when known, else average of both, else whichever is defined.
    const whiteAcc = game.accuracy?.white;
    const blackAcc = game.accuracy?.black;
    let accuracy: number | null;
    if (side === 'w') accuracy = whiteAcc ?? null;
    else if (side === 'b') accuracy = blackAcc ?? null;
    else if (whiteAcc != null && blackAcc != null) accuracy = (whiteAcc + blackAcc) / 2;
    else accuracy = whiteAcc ?? blackAcc ?? null;

    // Brilliant count: only credited when the user's name matches one of the
    // players. Without a name match, no brilliants are credited to this account
    // (the accuracy metric is about the analyzed game and is unaffected).
    const whiteBrilliants = game.classificationCounts?.white?.brilliant ?? 0;
    const blackBrilliants = game.classificationCounts?.black?.brilliant ?? 0;
    let brilliantCount: number;
    if (side === 'w') brilliantCount = whiteBrilliants;
    else if (side === 'b') brilliantCount = blackBrilliants;
    else brilliantCount = 0;

    const shortId = game.shortId ?? game.id ?? '';
    const gameLabel = `${whiteName} vs ${blackName}`;

    await fetch(`${API_BASE}/stats/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        username: user.username,
        avatar: user.avatar ?? '',
        pgnHash,
        shortId,
        gameLabel,
        accuracy,
        brilliantCount,
        depth,
      }),
    });
  } catch {
    // Fire-and-forget stats — never throw.
  }
}
