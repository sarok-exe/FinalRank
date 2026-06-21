/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Chess } from 'chess.js';
import { ChessGame, AnalyzedMove } from '../types';
import { generateShortId } from './shortId';

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
        shortId: generateShortId(),
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

export function fetchGameById(_id: string): Promise<ChessGame | null> {
  return Promise.resolve(null);
}
