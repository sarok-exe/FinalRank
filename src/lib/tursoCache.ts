import type { ChessGame } from '../types';
import { getTurso, isTursoConfigured, markTursoUnhealthy } from './turso';

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
