import { ChessGame } from '../types';
import { getTurso, isTursoConfigured, markTursoUnhealthy } from './turso';

export function hashPgn(pgn: string): string {
  let hash = 5381;
  for (let i = 0; i < pgn.length; i++) {
    hash = ((hash << 5) + hash + pgn.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
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
    const data = JSON.parse(row.analysis_data as string);
    return data as ChessGame;
  } catch {
    markTursoUnhealthy();
    return null;
  }
}

export async function saveCachedAnalysis(game: ChessGame, depth: number): Promise<void> {
  if (!isTursoConfigured()) return;
  const db = getTurso();
  if (!db) return;
  try {
    const pgnHash = hashPgn(game.pgn);
    const analysisData = JSON.stringify(game);
    await db.execute({
      sql: `INSERT INTO analyzed_games (pgn_hash, pgn, depth, analysis_data, result, white, black, date, accuracy_white, accuracy_black, analyzed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(pgn_hash) DO UPDATE SET
              depth = excluded.depth,
              analysis_data = excluded.analysis_data,
              accuracy_white = excluded.accuracy_white,
              accuracy_black = excluded.accuracy_black,
              analyzed_at = datetime('now')`,
      args: [
        pgnHash,
        game.pgn,
        depth,
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
