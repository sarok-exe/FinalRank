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
  pgn?: string;
  status?: string;
  variant?: { key?: string };
};

/**
 * Fetches recent chess games for a Lichess username via the public API.
 * Returns up to 50 games in the same ChessGame format used throughout the app.
 *
 * The Lichess API returns NDJSON (newline-delimited JSON) — each line is a
 * separate JSON game object. We request the `moves` field in UCI format and
 * reconstruct SAN + FEN locally via chess.js.
 */
export async function fetchLichessGames(username: string): Promise<ChessGame[]> {
  const cleanUsername = username.trim().toLowerCase();
  if (cleanUsername === '') return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const url = `https://lichess.org/api/games/user/${encodeURIComponent(cleanUsername)}?max=50&pgnInJson=false`;
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
  const dateRaw = g.createdAt != null ? new Date(g.createdAt) : new Date();

  const whiteName = g.players?.white?.user?.name ?? 'White';
  const blackName = g.players?.black?.user?.name ?? 'Black';
  const whiteRating = g.players?.white?.rating;
  const blackRating = g.players?.black?.rating;

  const result = resolveResult(g);

  // Lichess gives us UCI moves as a space-separated string — convert to SAN + FEN via chess.js
  const uciMoves = g.moves ?? '';
  const moves = parseUciMoves(uciMoves, g.initialFen);
  const pgn = buildPgn(whiteName, blackName, whiteRating, blackRating, dateRaw, result, moves);

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
 * Parse a UCI move string (e.g. "e2e4 g8f6") into AnalyzedMove[] by
 * replaying each move through chess.js to get SAN, from, to, and FEN.
 */
function parseUciMoves(uciString: string, initialFen?: string): AnalyzedMove[] {
  if (uciString === '') return [];
  const chess = new Chess(initialFen || undefined);
  const tokens = uciString.split(/\s+/).filter(t => t.length >= 4);
  const moves: AnalyzedMove[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const uci = tokens[i];
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;

    try {
      const moveResult = chess.move({
        from,
        to,
        promotion,
      });
      if (!moveResult) break;

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
 * Build a minimal PGN string from parsed data so the rest of the app can
 * display and hash it identically to Chess.com or pasted PGNs.
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
