/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Chess } from 'chess.js';
import { ChessGame, AnalyzedMove } from '../types';

/**
 * Fetches recent chess games for a Chess.com username.
 */
export async function fetchChessComGames(username: string): Promise<ChessGame[]> {
  try {
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) return [];

    // Step 1: Get list of monthly archives from Chess.com
    const archivesResponse = await fetch(`https://api.chess.com/pub/player/${cleanUsername}/games/archives`);
    
    if (!archivesResponse.ok) {
      if (archivesResponse.status === 404) {
        throw new Error(`Chess.com user "${username}" not found.`);
      }
      throw new Error(`Chess.com API error (Status ${archivesResponse.status})`);
    }

    const archivesData = await archivesResponse.json();
    const archives: string[] = archivesData.archives || [];

    if (archives.length === 0) {
      return [];
    }

    // Sort archives to get the most recent months first
    const reverseArchives = [...archives].reverse();
    
    let rawGames: any[] = [];
    
    // Fetch the most recent month(s) to aggregate up to 50 games
    for (const archiveUrl of reverseArchives) {
      if (rawGames.length >= 50) break;
      
      const gameRes = await fetch(archiveUrl);
      if (gameRes.ok) {
        const gameData = await gameRes.json();
        const gamesInMonth = gameData.games || [];
        rawGames = [...rawGames, ...gamesInMonth.reverse()];
      }
    }

    // Limit to 50 games
    const gamesToProcess = rawGames.slice(0, 50);

    return gamesToProcess.map((g: any, index: number) => {
      const dateRaw = g.end_time ? new Date(g.end_time * 1000) : new Date();
      const pgn = g.pgn || '';
      
      return {
        id: g.uuid || `chesscom-${cleanUsername}-${index}`,
        white: {
          username: g.white?.username || 'White',
          rating: g.white?.rating
        },
        black: {
          username: g.black?.username || 'Black',
          rating: g.black?.rating
        },
        result: parseResultFromHeaders(pgn) || g.white?.result === 'win' ? '1-0' : g.black?.result === 'win' ? '0-1' : '1/2-1/2',
        date: dateRaw.toISOString().split('T')[0],
        pgn: pgn,
        moves: parsePgnToMoves(pgn)
      };
    });
  } catch (error: any) {
    throw error;
  }
}

/**
 * Parses the game result directly out of the PGN headers
 */
function parseResultFromHeaders(pgn: string): string | null {
  const match = pgn.match(/\[Result "(.*?)"\]/);
  return match ? match[1] : null;
}

export function parsePgnToMoves(pgn: string): AnalyzedMove[] {
  if (!pgn) return [];
  const chess = new Chess();
  const moves: AnalyzedMove[] = [];

  const clean = pgn
    .replace(/\[.*?\]/g, '')
    .replace(/\{.*?\}/g, '')
    .replace(/\d+\.+\s*/g, '')
    .trim();

  const tokens = clean.split(/\s+/).filter(
    m => m && !m.includes('$') && m !== '*' && !m.match(/^(1-0|0-1|1\/2-1\/2)$/)
  );

  for (let i = 0; i < tokens.length; i++) {
    try {
      const moveResult = chess.move(tokens[i]);
      moves.push({
        index: i,
        san: moveResult.san,
        from: moveResult.from,
        to: moveResult.to,
        fen: chess.fen(),
        color: moveResult.color,
      });
    } catch {
      break;
    }
  }
  return moves;
}

/**
 * Elite tournament chess games provided as elegant presets
 */
export async function fetchChessComPlayerAvatar(username: string): Promise<string | undefined> {
  if (!username) return undefined;
  try {
    const res = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}`);
    if (!res.ok) return undefined;
    const data = await res.json();
    return data.avatar || undefined;
  } catch {
    return undefined;
  }
}

export async function fetchAvatarsForGames(games: ChessGame[]): Promise<ChessGame[]> {
  const uniqueUsernames = new Set<string>();
  games.forEach(g => {
    uniqueUsernames.add(g.white.username);
    uniqueUsernames.add(g.black.username);
  });
  const cache = new Map<string, string | undefined>();
  await Promise.all(Array.from(uniqueUsernames).map(async (name) => {
    cache.set(name, await fetchChessComPlayerAvatar(name));
  }));
  return games.map(g => ({
    ...g,
    white: { ...g.white, avatar: cache.get(g.white.username) },
    black: { ...g.black, avatar: cache.get(g.black.username) },
  }));
}

export const LEGENDARY_PRESET_GAMES: ChessGame[] = [
  {
    id: 'legend-fischer',
    white: { username: 'Donald Byrne', rating: 2200 },
    black: { username: 'Bobby Fischer', rating: 2600 },
    result: '0-1',
    date: '1956-10-17',
    pgn: '1. Nf3 Nf6 2. c4 g6 3. Nc3 Bg7 4. d4 O-O 5. Bf4 d5 6. Qb3 dxc4 7. Qxc4 c6 8. e4 Nbd7 9. Rd1 Nb6 10. Qc5 Bg4 11. Bg5 Na4 12. Qa3 Nxc3 13. bxc3 Nxe4 14. Bxe7 Qb6 15. Bc4 Nxc3 16. Bc5 Rfe8+ 17. Kf1 Be6 18. Bxb6 Bxc4+ 19. Kg1 Ne2+ 20. Kf1 Nxd4+ 21. Kg1 Ne2+ 22. Kf1 Nc3+ 23. Kg1 axb6 24. Qb4 Ra4 25. Qxb6 Nxd1 26. h3 Rxa2 27. Kh2 Nxf2 28. Re1 Rxe1 29. Qd8+ Bf8 30. Nxe1 Bd5 31. Nf3 Ne4 32. Qb8 b5 33. h4 h5 34. Ne5 Kg7 35. Kg1 Bc5+ 36. Kf1 Ng3+ 37. Ke1 Bb4+ 38. Kd1 Bb3+ 39. Kc1 Ne2+ 40. Kb1 Nc3+ 41. Kc1 Rc2#',
    moves: [] // Will be populated dynamically using chess.js when selected
  },
  {
    id: 'legend-kasparov',
    white: { username: 'Garry Kasparov', rating: 2820 },
    black: { username: 'Deep Blue', rating: 2700 },
    result: '1-0',
    date: '1996-02-10',
    pgn: '1. e4 c5 2. c3 d5 3. exd5 Qxd5 4. d4 Nf6 5. Nf3 Bg4 6. Be2 e6 7. h3 Bh5 8. O-O Nc6 9. Be3 cxd4 10. cxd4 Bb4 11. a3 Ba5 12. Nc3 Qd6 13. Nb5 Qe7 14. Ne5 Bxe2 15. Qxe2 O-O 16. Rac1 Rac8 17. Bg5 Bb6 18. Bxf6 gxf6 19. Nc4 Rfd8 20. Nxb6 axb6 21. Rfd1 f5 22. Qe3 Qf6 23. d5 Rxd5 24. Rxd5 exd5 25. b3 Kh8 26. Qxb6 Rg8 27. Qc5 d4 28. Nd6 f4 29. Nxb7 Ne5 30. Qd5 f3 31. g3 Nd3 32. Rc7 Re8 33. Nd6 Re1+ 34. Kh2 Nxf2 35. Nxf7+ Kg7 36. Ng5+ Kh6 37. Rxh7+ 1-0',
    moves: []
  },
  {
    id: 'legend-immortal',
    white: { username: 'Adolf Anderssen', rating: 2400 },
    black: { username: 'Lionel Kieseritzky', rating: 2350 },
    result: '1-0',
    date: '1851-06-21',
    pgn: '1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5 8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8 15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2 Na6 21. Nxg7+ Kd8 22. Qf6+ Nxf6 23. Be7#',
    moves: []
  }
];
