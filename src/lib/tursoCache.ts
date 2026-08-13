import type { ChessGame } from '../types';
import { getTurso, isTursoConfigured, markTursoUnhealthy } from './turso';
import type { CommunityMatchSummary, CommunityUserStats, LeaderboardEntry } from './community';

export function hashPgn(pgn: string): string {
  let hash = 5381;
  for (let i = 0; i < pgn.length; i++) {
    hash = ((hash << 5) + hash + pgn.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

export type AnalysisRunMeta = {
  depth: number;
  engine: string;
  analyzedAt: string;
};

export function engineLabel(engine: string): string {
  if (!engine) return 'Stockfish 18 Lite';
  if (engine.includes('stockfish-18-lite') || engine.includes('stockfish-18')) return 'Stockfish 18 Lite';
  if (engine.includes('lichess')) return 'Lichess Cloud';
  if (engine.includes('official')) return 'Stockfish Official';
  return engine;
}

export async function getCachedAnalysis(pgn: string, minDepth: number): Promise<ChessGame | null> {
  if (!isTursoConfigured()) return null;
  const db = getTurso();
  if (!db) return null;
  try {
    const pgnHash = hashPgn(pgn);
    const rs = await db.execute({
      sql: 'SELECT analysis_data, depth FROM analyzed_games WHERE pgn_hash = ? AND depth >= ? ORDER BY depth DESC LIMIT 1',
      args: [pgnHash, minDepth],
    });
    if (rs.rows.length === 0) return null;
    const row = rs.rows[0];
    return JSON.parse(row.analysis_data as string) as ChessGame;
  } catch {
    markTursoUnhealthy();
    return null;
  }
}

export async function saveCachedAnalysis(game: ChessGame, depth: number, engine: string = ''): Promise<void> {
  if (!isTursoConfigured()) return;
  const db = getTurso();
  if (!db) return;
  try {
    const pgnHash = hashPgn(game.pgn);
    const analysisData = JSON.stringify(game);
    await db.execute({
      sql: `INSERT INTO analyzed_games (pgn_hash, pgn, depth, engine, analysis_data, result, white, black, date, accuracy_white, accuracy_black, analyzed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(pgn_hash, depth, engine) DO UPDATE SET
              pgn = excluded.pgn,
              analysis_data = excluded.analysis_data,
              result = excluded.result,
              white = excluded.white,
              black = excluded.black,
              date = excluded.date,
              accuracy_white = excluded.accuracy_white,
              accuracy_black = excluded.accuracy_black,
              analyzed_at = datetime('now')`,
      args: [
        pgnHash,
        game.pgn,
        depth,
        engine,
        analysisData,
        game.result || '',
        game.white.username || '',
        game.black.username || '',
        game.date || '',
        game.accuracy?.white ?? null,
        game.accuracy?.black ?? null,
      ],
    });
  } catch {
    markTursoUnhealthy();
  }
}

export async function getPriorAnalyses(pgn: string): Promise<AnalysisRunMeta[]> {
  if (!isTursoConfigured()) return [];
  const db = getTurso();
  if (!db) return [];
  try {
    const rs = await db.execute({
      sql: 'SELECT depth, engine, analyzed_at FROM analyzed_games WHERE pgn_hash = ? ORDER BY depth DESC, analyzed_at DESC',
      args: [hashPgn(pgn)],
    });
    const seen = new Map<number, { depth: number; engine: string; analyzedAt: string }>();
    for (const r of rs.rows) {
      const meta = { depth: (r.depth as number) ?? 0, engine: (r.engine as string) ?? '', analyzedAt: (r.analyzed_at as string) ?? '' };
      const existing = seen.get(meta.depth);
      if (!existing || meta.analyzedAt > existing.analyzedAt) seen.set(meta.depth, meta);
    }
    return [...seen.values()].sort((a, b) => b.depth - a.depth);
  } catch {
    markTursoUnhealthy();
    return [];
  }
}

export async function getCachedAnalysisByKey(pgn: string, depth: number, engine: string = ''): Promise<ChessGame | null> {
  if (!isTursoConfigured()) return null;
  const db = getTurso();
  if (!db) return null;
  try {
    const rs = await db.execute({
      sql: 'SELECT analysis_data FROM analyzed_games WHERE pgn_hash = ? AND depth = ? AND engine = ? LIMIT 1',
      args: [hashPgn(pgn), depth, engine],
    });
    if (rs.rows.length === 0) return null;
    return JSON.parse(rs.rows[0].analysis_data as string) as ChessGame;
  } catch {
    markTursoUnhealthy();
    return null;
  }
}

export async function saveSharedGameToTurso(shortId: string, game: ChessGame): Promise<void> {
  if (!isTursoConfigured()) return;
  const db = getTurso();
  if (!db || !shortId) return;
  try {
    const payload = {
      ...game,
      moves: JSON.parse(JSON.stringify(game.moves)) as typeof game.moves,
      userSaved: false,
    };
    await db.execute({
      sql: `INSERT INTO shared_games (short_id, game_data, uid, updated_at)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(short_id) DO UPDATE SET
              game_data = excluded.game_data,
              uid = excluded.uid,
              updated_at = datetime('now')`,
      args: [shortId, JSON.stringify(payload), ''],
    });
  } catch {
    markTursoUnhealthy();
  }
}

export async function saveFavoriteTurso(uid: string, gameId: string, gameData: string): Promise<void> {
  if (!isTursoConfigured()) return;
  const db = getTurso();
  if (!db || !gameId) return;
  try {
    await db.execute({
      sql: `INSERT INTO favorites (uid, game_id, game_data, favorited_at)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(uid, game_id) DO UPDATE SET
              game_data = excluded.game_data,
              favorited_at = datetime('now')`,
      args: [uid, gameId, gameData],
    });
  } catch {
    markTursoUnhealthy();
  }
}

export async function fetchFavoritesTurso(uid: string): Promise<Record<string, unknown>[]> {
  if (!isTursoConfigured()) return [];
  const db = getTurso();
  if (!db) return [];
  try {
    const rs = await db.execute({
      sql: 'SELECT game_id, game_data FROM favorites WHERE uid = ? ORDER BY favorited_at DESC',
      args: [uid],
    });
    return rs.rows.map((r) => {
      const gameId = r.game_id as string;
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(r.game_data as string) as Record<string, unknown>;
      } catch { /* keep empty */ }
      return { id: gameId, ...parsed };
    });
  } catch {
    markTursoUnhealthy();
    return [];
  }
}

export async function deleteFavoriteTurso(uid: string, gameId: string): Promise<void> {
  if (!isTursoConfigured()) return;
  const db = getTurso();
  if (!db) return;
  try {
    await db.execute({
      sql: 'DELETE FROM favorites WHERE uid = ? AND game_id = ?',
      args: [uid, gameId],
    });
  } catch {
    markTursoUnhealthy();
  }
}

export async function batchCheckAnalysis(games: ChessGame[], minDepth: number): Promise<Record<string, boolean>> {
  if (!isTursoConfigured() || games.length === 0) return {};
  const db = getTurso();
  if (!db) return {};

  const hashes = games.map(g => hashPgn(g.pgn));
  const placeholders = hashes.map(() => '?').join(',');
  const result: Record<string, boolean> = {};

  try {
    const rs = await db.execute({
      sql: `SELECT DISTINCT pgn_hash FROM analyzed_games WHERE pgn_hash IN (${placeholders}) AND depth >= ?`,
      args: [...hashes, minDepth],
    });
    for (const row of rs.rows) {
      result[row.pgn_hash as string] = true;
    }
  } catch {
    markTursoUnhealthy();
  }

  return result;
}

export async function saveUserAnalysisStats(
  user: { id: string; username: string; avatar?: string; chessComUsername?: string },
  game: ChessGame,
  depth: number
): Promise<void> {
  // Brilliants are only accepted from analyses at depth 15+.
  if (!isTursoConfigured() || depth < 15) return;
  const db = getTurso();
  if (!db) return;
  try {
    const pgnHash = hashPgn(game.pgn);

    // Determine the user's side from their linked chess.com username (case-insensitive).
    const chessCom = (user.chessComUsername ?? '').trim();
    const whiteName = game.white?.username ?? '';
    const blackName = game.black?.username ?? '';
    let side: 'w' | 'b' | null = null;
    if (chessCom && whiteName && chessCom.toLowerCase() === whiteName.toLowerCase()) side = 'w';
    else if (chessCom && blackName && chessCom.toLowerCase() === blackName.toLowerCase()) side = 'b';

    // Accuracy: user's side when known, else average of both, else whichever is defined.
    const whiteAcc = game.accuracy?.white;
    const blackAcc = game.accuracy?.black;
    let accuracy: number | null;
    if (side === 'w') accuracy = whiteAcc ?? null;
    else if (side === 'b') accuracy = blackAcc ?? null;
    else if (whiteAcc != null && blackAcc != null) accuracy = (whiteAcc + blackAcc) / 2;
    else accuracy = whiteAcc ?? blackAcc ?? null;

    // Brilliant count: user's side when known, else both sides combined.
    const whiteBrilliants = game.classificationCounts?.white?.brilliant ?? 0;
    const blackBrilliants = game.classificationCounts?.black?.brilliant ?? 0;
    let brilliantCount: number;
    if (side === 'w') brilliantCount = whiteBrilliants;
    else if (side === 'b') brilliantCount = blackBrilliants;
    else brilliantCount = whiteBrilliants + blackBrilliants;

    const shortId = game.shortId ?? game.id ?? '';
    const gameLabel = `${whiteName} vs ${blackName}`;

    await db.execute({
      sql: `INSERT INTO user_analysis_stats (user_id, username, avatar, pgn_hash, short_id, game_label, accuracy, brilliant_count, depth, analyzed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(user_id, pgn_hash) DO NOTHING`,
      args: [
        user.id,
        user.username,
        user.avatar ?? '',
        pgnHash,
        shortId,
        gameLabel,
        accuracy,
        brilliantCount,
        depth,
      ],
    });
  } catch {
    markTursoUnhealthy();
  }
}

export async function fetchCommunityLeaderboard(limit?: number): Promise<LeaderboardEntry[]> {
  if (!isTursoConfigured()) return [];
  const db = getTurso();
  if (!db) return [];
  try {
    const rs = await db.execute({
      sql: `SELECT user_id, username, avatar, COUNT(*) AS matches, SUM(brilliant_count) AS brilliants, AVG(accuracy) AS avg_accuracy, MAX(analyzed_at) AS last_analysis
            FROM user_analysis_stats
            GROUP BY user_id, username, avatar
            ORDER BY matches DESC, brilliants DESC, last_analysis DESC
            LIMIT ?`,
      args: [limit ?? 50],
    });
    return rs.rows.map((r) => {
      const avgRaw = r.avg_accuracy == null ? null : Math.round(Number(r.avg_accuracy) * 10) / 10;
      return {
        userId: String(r.user_id ?? ''),
        username: String(r.username ?? ''),
        avatar: String(r.avatar ?? ''),
        matches: Number(r.matches ?? 0),
        brilliants: Number(r.brilliants ?? 0),
        avgAccuracy: avgRaw == null ? null : Number(avgRaw),
        lastAnalysis: String(r.last_analysis ?? ''),
      };
    });
  } catch {
    markTursoUnhealthy();
    return [];
  }
}

export async function fetchCommunityUserStats(userId: string): Promise<CommunityUserStats | null> {
  if (!isTursoConfigured() || !userId) return null;
  const db = getTurso();
  if (!db) return null;
  try {
    const profileRs = await db.execute({
      sql: 'SELECT username, avatar FROM user_analysis_stats WHERE user_id = ? LIMIT 1',
      args: [userId],
    });
    if (profileRs.rows.length === 0) return null;

    const aggRs = await db.execute({
      sql: 'SELECT COUNT(*) AS matches, SUM(brilliant_count) AS brilliants, AVG(accuracy) AS avg_accuracy FROM user_analysis_stats WHERE user_id = ?',
      args: [userId],
    });
    const agg = aggRs.rows[0];
    const avgRaw = agg.avg_accuracy == null ? null : Math.round(Number(agg.avg_accuracy) * 10) / 10;

    const strongestRs = await db.execute({
      sql: `SELECT pgn_hash, short_id, game_label, brilliant_count, accuracy, analyzed_at
            FROM user_analysis_stats
            WHERE user_id = ?
            ORDER BY brilliant_count DESC, accuracy DESC NULLS LAST, analyzed_at DESC
            LIMIT 1`,
      args: [userId],
    });

    const toSummary = (r: Record<string, unknown>): CommunityMatchSummary => ({
      pgnHash: String(r.pgn_hash ?? ''),
      shortId: String(r.short_id ?? ''),
      gameLabel: String(r.game_label ?? ''),
      brilliantCount: Number(r.brilliant_count ?? 0),
      accuracy: r.accuracy == null ? null : Number(r.accuracy),
      analyzedAt: String(r.analyzed_at ?? ''),
    });

    let recent: CommunityMatchSummary[] = [];
    try {
      const recentRs = await db.execute({
        sql: `SELECT pgn_hash, short_id, game_label, brilliant_count, accuracy, analyzed_at
              FROM user_analysis_stats
              WHERE user_id = ?
              ORDER BY analyzed_at DESC
              LIMIT 10`,
        args: [userId],
      });
      recent = recentRs.rows.map(toSummary);
    } catch {
      markTursoUnhealthy();
      // Never throw — recent degrades to [] on error.
    }

    return {
      userId,
      username: String(profileRs.rows[0].username ?? ''),
      avatar: String(profileRs.rows[0].avatar ?? ''),
      matches: Number(agg.matches ?? 0),
      brilliants: Number(agg.brilliants ?? 0),
      avgAccuracy: avgRaw == null ? null : Number(avgRaw),
      strongest: strongestRs.rows.length > 0 ? toSummary(strongestRs.rows[0]) : null,
      recent,
    };
  } catch {
    markTursoUnhealthy();
    return null;
  }
}
