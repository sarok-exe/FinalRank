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
 * Fetches the most recent game for a Lichess username via two public endpoints:
 *  1. GET /api/user/{username}/current-game → returns JSON with the game ID
 *  2. GET /game/export/{gameId}             → returns full PGN as plain text
 *
 * The PGN is wrapped in a LichessGameRaw and fed through the existing
 * parseLichessGame / buildPgn helpers so the rest of the app (gameStore etc.)
 * works unchanged.
 *
 * Requests are serialised with a short delay to respect Lichess rate limits.
 */
export async function fetchLichessGames(username: string): Promise<ChessGame[]> {
  const cleanUsername = username.trim().toLowerCase();
  if (cleanUsername === '') return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    // ── Step 1: get the current (most-recent) game ID ────────────────
    const currentGameUrl = `https://lichess.org/api/user/${encodeURIComponent(cleanUsername)}/current-game`;
    const currentGameRes = await fetch(currentGameUrl, {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    if (!currentGameRes.ok) {
      if (currentGameRes.status === 404) {
        throw new Error(`Lichess user "${username}" not found.`);
      }
      if (currentGameRes.status === 429) {
        throw new Error(`Lichess rate limit exceeded. Please wait a moment and try again.`);
      }
      throw new Error(`Lichess API error while looking up user (Status ${currentGameRes.status})`);
    }

    const currentGameData = await currentGameRes.json();
    const gameId: string | undefined = currentGameData.id;
    if (!gameId) {
      throw new Error(`No current game found for Lichess user "${username}".`);
    }

    // Brief pause so the second request doesn't get 429'd
    await new Promise(resolve => setTimeout(resolve, 500));

    // ── Step 2: fetch the full PGN for that game ─────────────────────
    const pgnUrl = `https://lichess.org/game/export/${gameId}`;
    const pgnRes = await fetch(pgnUrl, { signal: controller.signal });

    if (!pgnRes.ok) {
      if (pgnRes.status === 429) {
        throw new Error(`Lichess rate limit exceeded. Please wait a moment and try again.`);
      }
      throw new Error(`Lichess API error while fetching game PGN (Status ${pgnRes.status})`);
    }

    const pgnText = await pgnRes.text();
    if (!pgnText.trim()) {
      throw new Error(`Empty PGN received for game ${gameId}.`);
    }

    // ── Build a LichessGameRaw from the PGN headers + PGN text ───────
    const rawGame = buildRawGameFromPgn(pgnText, gameId);

    // Reuse the existing parser — returns a single-element array so the
    // existing importLichessGames → selectGame → autoAnalyzeGame flow
    // continues to work.
    return [parseLichessGame(rawGame, cleanUsername, 0)];
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parses PGN headers out of a PGN text block and returns a LichessGameRaw
 * so we can hand it to parseLichessGame without changing that function.
 */
function buildRawGameFromPgn(pgn: string, gameId: string): LichessGameRaw {
  const headerRe = /\[(\w+)\s+"([^"]*)"\]/g;
  const headers: Record<string, string> = {};
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(pgn)) !== null) {
    headers[m[1]] = m[2];
  }

  const whiteName = headers['White'];
  const blackName = headers['Black'];
  const whiteRating = headers['WhiteElo'] ? parseInt(headers['WhiteElo'], 10) : undefined;
  const blackRating = headers['BlackElo'] ? parseInt(headers['BlackElo'], 10) : undefined;

  let winner: 'white' | 'black' | null = null;
  if (headers['Result'] === '1-0') winner = 'white';
  else if (headers['Result'] === '0-1') winner = 'black';

  // Date may be "2024.01.15"
  let createdAt: number | undefined;
  if (headers['Date']) {
    const d = new Date(headers['Date'].replace(/\./g, '-'));
    if (!isNaN(d.getTime())) createdAt = d.getTime();
  }

  return {
    id: gameId,
    players: {
      white: {
        user: whiteName ? { name: whiteName } : undefined,
        rating: isNaN(whiteRating!) ? undefined : whiteRating,
      },
      black: {
        user: blackName ? { name: blackName } : undefined,
        rating: isNaN(blackRating!) ? undefined : blackRating,
      },
    },
    winner,
    createdAt,
    pgn,
  };
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
