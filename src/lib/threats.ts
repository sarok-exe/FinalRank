/**
 * Headless, pure threat-detection module for the "danger review" feature.
 *
 * Given a FEN, computes which pieces of the side to move are attacked by enemy
 * pieces. Attack detection is exact: for each enemy piece we generate its legal
 * moves via chess.js and collect the union of target squares. Pawns therefore
 * only "attack" via captures, pinned pieces cannot attack through their own
 * king, and the king's moves are its legal moves.
 *
 * Pure functions only — no React, no stores, no localStorage, no app imports.
 */

import { Chess } from 'chess.js';

export type ThreatInfo = {
  square: string;        // e.g. 'e5' — the threatened piece's square
  piece: string;         // e.g. 'wQ' — chess.js piece type+color of the threatened piece
  attackers: string[];   // enemy squares attacking it, e.g. ['d6', 'f6']
  exploitable: boolean;  // true when the enemy's best move (from engine analysis) captures/targets this piece
};

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Pieces of the SIDE TO MOVE that are attacked by enemy pieces in the given FEN.
 *
 * @param fen          the position to inspect
 * @param bestMoveSan  optional — the opponent's best move for this position
 *                     (e.g. the bestSan of the next move in the game). When its
 *                     destination square (last 2 chars) equals a threatened
 *                     piece's square, that piece is marked `exploitable: true`.
 */
export function computeThreats(fen: string, bestMoveSan?: string): ThreatInfo[] {
  const chess = new Chess(fen);
  const sideToMove = chess.turn();
  const enemy = sideToMove === 'w' ? 'b' : 'w';

  // chess.js only generates moves for the side to move, so flip the turn on a
  // clone to enumerate the enemy's attacks. The piece layout is unchanged.
  const attackBoard = new Chess(fen);
  attackBoard.setTurn(enemy);

  // target square -> squares of enemy pieces that can legally move there
  const attacks = new Map<string, string[]>();
  const board = attackBoard.board();
  for (const row of board) {
    for (const sq of row) {
      if (sq == null || sq.color !== enemy) continue;
      const moves = attackBoard.moves({ square: sq.square, verbose: true });
      for (const m of moves) {
        const list = attacks.get(m.to);
        if (list) list.push(sq.square);
        else attacks.set(m.to, [sq.square]);
      }
    }
  }

  const bestDest = bestMoveSan ? bestMoveSan.slice(-2) : '';

  const threats: ThreatInfo[] = [];
  for (const row of board) {
    for (const sq of row) {
      if (sq == null || sq.color !== sideToMove) continue;
      const attackers = attacks.get(sq.square);
      if (attackers == null || attackers.length === 0) continue;
      threats.push({
        square: sq.square,
        piece: sq.color + sq.type.toUpperCase(),
        attackers,
        exploitable: bestDest !== '' && bestDest === sq.square,
      });
    }
  }
  return threats;
}

/**
 * Threats for every position of a game, parallel to `moves`:
 * result[i] = threats in the position AFTER move i.
 *
 * When a move lacks `fen`, it is reconstructed by replaying its `san` from the
 * previous position (or from `initialFen`, defaulting to the standard start).
 * Each position's `bestMoveSan` is the opponent's reply — `moves[i + 1]?.bestSan`
 * — when available.
 */
export function computeGameThreats(
  moves: { fen?: string; san?: string; bestSan?: string }[],
  initialFen?: string,
): ThreatInfo[][] {
  const chess = new Chess(initialFen ?? START_FEN);
  const results: ThreatInfo[][] = [];

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    if (move.fen != null) {
      chess.load(move.fen);
    } else if (move.san != null) {
      try {
        chess.move(move.san);
      } catch {
        // Illegal/unparseable move — leave the board as-is (best-effort).
      }
    }
    results.push(computeThreats(chess.fen(), moves[i + 1]?.bestSan));
  }
  return results;
}