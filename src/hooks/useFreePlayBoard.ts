import { useCallback, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { EngineLine } from '../types';
import { STARTING_FEN } from '../types';
import { evaluateLiveMove } from '../lib/reporter/liveCoach';
import { useSettingsStore } from '../stores/settingsStore';

export type FreePlayEval = {
  score: number;
  isMate: boolean;
};

export type FreePlayMove = {
  san: string;
  from: string;
  to: string;
  classification: string | null;
  note: string | null;
};

/**
 * Free-play board: the user makes moves from the starting position and each
 * move is analyzed immediately, with the classification attached to the move
 * once the engine finishes. Never throws — illegal moves leave the board
 * untouched and return false.
 *
 * The board keeps a single live chess.js instance: undo() only works against
 * a real move history, so we never reconstruct from a FEN (load()+undo() is a
 * silent no-op in chess.js).
 */
export function useFreePlayBoard() {
  const [fen, setFen] = useState(STARTING_FEN);
  const [moves, setMoves] = useState<FreePlayMove[]>([]);
  const [evalResult, setEvalResult] = useState<FreePlayEval | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const boardRef = useRef(new Chess(STARTING_FEN));
  const moveCountRef = useRef(0);
  // Shared engine-line cache across every move of the session.
  const cacheRef = useRef(new Map<string, EngineLine[]>());
  // Guards against stale async evaluations after undo/reset/new moves.
  const seqRef = useRef(0);

  const onMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    const settings = useSettingsStore.getState().settings;
    const board = boardRef.current;
    const prevFen = board.fen();
    let move;
    try {
      move = board.move({ from, to, promotion });
    } catch {
      return false; // Illegal move — board untouched.
    }
    const currFen = board.fen();
    const san = move.san;
    const color = move.color;
    const ply = moveCountRef.current + 1;
    const moveIndex = moveCountRef.current;
    moveCountRef.current += 1;
    const seq = ++seqRef.current;
    const entry: FreePlayMove = {
      san,
      from: move.from,
      to: move.to,
      classification: null,
      note: null,
    };

    setFen(currFen);
    setMoves(prev => [...prev, entry]);
    setEvaluating(true);

    void evaluateLiveMove({
      prevFen,
      currFen,
      san,
      color,
      ply,
      moveIndex,
      depth: 12,
      engineVersion: settings.engineVersion,
      cache: cacheRef.current,
    }).then(note => {
      if (seq !== seqRef.current) return;
      setEvalResult({
        score: note.toEval ?? 0,
        isMate: Math.abs(note.toEval ?? 0) >= 15,
      });
      setMoves(prev => {
        const next = prev.slice();
        const last = next[next.length - 1];
        if (last) {
          last.classification = note.classification;
          last.note = note.note;
        }
        return next;
      });
      setEvaluating(false);
    });

    return true;
  }, []);

  const undo = useCallback(() => {
    const board = boardRef.current;
    if (!board.undo()) return; // No moves to undo.
    seqRef.current++;
    moveCountRef.current = Math.max(0, moveCountRef.current - 1);
    setFen(board.fen());
    setMoves(prev => prev.slice(0, -1));
    setEvalResult(null);
    setEvaluating(false);
  }, []);

  const reset = useCallback(() => {
    seqRef.current++;
    moveCountRef.current = 0;
    boardRef.current = new Chess(STARTING_FEN);
    setFen(STARTING_FEN);
    setMoves([]);
    setEvalResult(null);
    setEvaluating(false);
  }, []);

  return { fen, moves, evaluating, eval: evalResult, onMove, undo, reset };
}