/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Chess } from 'chess.js';
import type { ChessGame, AnalyzedMove } from '../types';
import { shortIdFromKey } from './shortId';

type LichessPlayerUser = {
  name?: string;
  title?: string;
};

type LichessPlayer = {
  user?: LichessPlayerUser;
  rating?: number;
  ratingDiff?: number;
  aiLevel?: number;
};

type LichessGameRaw = {
  id?: string;
  players?: {
    white?: LichessPlayer;
    black?: LichessPlayer;
  };
  winner?: 'white' | 'black' | null;
  moves?: string;
  initialFen?: string;
  clock?: {
    initial?: number;
    increment?: number;
  };
  createdAt?: number;
  lastMoveAt?: number;
  pgn?: string;
  status?: string;
  variant?: { key?: string };
};

/**
 * Fetches recent chess games for a Lichess username via the public API.
 * Returns up to 50 games in the same ChessGame format used throughout the app.
 *
 * Uses `pgnInJson=true` so each game includes the full PGN verbatim.
 * We parse SAN moves from PGN via chess.js rather than reconstructing from UCI.
 */
export async function fetchLichessGames(username: string): Promise<ChessGame[]> {
  const cleanUsername = username.trim().toLowerCase();
  if (cleanUsername === '') return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const url = `https://lichess.org/api/games/user/${encodeURIComponent(cleanUsername)}?max=50&pgnInJson=true`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/x-ndjson',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Lichess user "${username}" not found.`);
      }
      throw new Error(`Lichess API error (Status ${response.status})`);
    }

    const text = await response.text();
    const lines = text.trim().split('\n').filter(l => l.length > 0);

    if (lines.length === 0) return [];

    const rawGames: LichessGameRaw[] = lines.map(line => {
      try { return JSON.parse(line) as LichessGameRaw; } catch { return null; }
    }).filter((g): g is LichessGameRaw => g != null);

    return rawGames.map((g, index) => parseLichessGame(g, cleanUsername, index));
  } finally {
    clearTimeout(timeout);
  }
}

function parseLichessGame(g: LichessGameRaw, cleanUsername: string, index: number): ChessGame {
  const id = g.id ?? `lichess-${cleanUsername}-${index}`;
  const dateRaw = g.lastMoveAt ? new Date(g.lastMoveAt) : (g.createdAt ? new Date(g.createdAt) : new Date());

  // Handle AI opponents — Lichess returns aiLevel instead of a user for bots
  const whiteName = g.players?.white?.aiLevel != null
    ? `AI Level ${g.players.white.aiLevel}`
    : g.players?.white?.user?.name ?? 'White';
  const blackName = g.players?.black?.aiLevel != null
    ? `AI Level ${g.players.black.aiLevel}`
    : g.players?.black?.user?.name ?? 'Black';
  const whiteRating = g.players?.white?.rating;
  const blackRating = g.players?.black?.rating;

  const result = resolveResult(g);

  // Use the real PGN from Lichess (populated because pgnInJson=true)
  const pgn = g.pgn ?? buildPgn(whiteName, blackName, whiteRating, blackRating, dateRaw, result, []);

  // Parse moves from PGN via chess.js instead of reconstructing from UCI
  const chess = new Chess(g.initialFen || undefined);
  chess.loadPgn(pgn);
  const history = chess.history({ verbose: true });

  // Replay to capture the FEN after each move
  const chess2 = new Chess(g.initialFen || undefined);
  const moves: AnalyzedMove[] = history.map((m, i) => {
    chess2.move(m.san);
    return {
      index: i,
      san: m.san,
      from: m.from,
      to: m.to,
      fen: chess2.fen(),
      color: m.color,
    };
  });

  return {
    id,
    shortId: shortIdFromKey(id),
    white: { username: whiteName, rating: whiteRating },
    black: { username: blackName, rating: blackRating },
    result,
    date: dateRaw.toISOString().split('T')[0],
    pgn,
    moves,
    initialPosition: g.initialFen || undefined,
  };
}

function resolveResult(g: LichessGameRaw): string {
  if (g.winner === 'white') return '1-0';
  if (g.winner === 'black') return '0-1';
  return '1/2-1/2';
}

/**
 * Fallback: Build a minimal PGN string from parsed data when Lichess doesn't
 * return a PGN (should rarely happen with pgnInJson=true).
 */
function buildPgn(
  whiteName: string,
  blackName: string,
  whiteRating: number | undefined,
  blackRating: number | undefined,
  date: Date,
  result: string,
  moves: AnalyzedMove[],
): string {
  const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  const headers = [
    `[Event "Lichess Game"]`,
    `[Site "https://lichess.org"]`,
    `[Date "${dateStr}"]`,
    `[White "${whiteName}"]`,
    `[Black "${blackName}"]`,
    `[Result "${result}"]`,
    whiteRating != null ? `[WhiteElo "${whiteRating}"]` : null,
    blackRating != null ? `[BlackElo "${blackRating}"]` : null,
  ].filter(Boolean).join('\n');

  // Reconstruct SAN move text from moves array
  const chess = new Chess();
  const moveText = moves.map((m, i) => {
    const moveIdx = chess.move(m.san);
    if (!moveIdx) return '';
    const num = Math.floor(i / 2) + 1;
    if (i % 2 === 0) return `${num}. ${m.san}`;
    return m.san;
  }).join(' ');

  return `${headers}\n\n${moveText} ${result}`.trim();
}
