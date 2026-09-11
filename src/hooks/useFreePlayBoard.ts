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

/**
 * Free-play board: the user makes moves from the starting position and each
 * move is analyzed immediately. Never throws — illegal moves and engine
 * failures leave the board untouched.
 */
export function useFreePlayBoard() {
  const [fen, setFen] = useState(STARTING_FEN);
  const [history, setHistory] = useState<string[]>([]);
  const [evalResult, setEvalResult] = useState<FreePlayEval | null>(null);
  const [classification, setClassification] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  // Shared engine-line cache across every move of the session.
  const cacheRef = useRef(new Map<string, EngineLine[]>());
  // Guards against stale async evaluations after undo/reset/new moves.
  const seqRef = useRef(0);

  const onMove = useCallback((from: string, to: string, promotion?: string) => {
    const settings = useSettingsStore.getState().settings;
    try {
      const board = new Chess(STARTING_FEN);
      board.load(fen);
      const move = board.move({ from, to, promotion });
      const prevFen = fen;
      const currFen = board.fen();
      const san = move.san;
      const color = move.color;
      const ply = history.length + 1;
      const moveIndex = history.length;
      const seq = ++seqRef.current;

      setFen(currFen);
      setHistory(prev => [...prev, san]);
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
        setClassification(note.classification);
        setNote(note.note);
        setEvaluating(false);
      });
    } catch {
      // Illegal move or engine failure — leave the board untouched.
    }
  }, [fen, history.length]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    seqRef.current++;
    try {
      const board = new Chess(STARTING_FEN);
      board.load(fen);
      board.undo();
      setFen(board.fen());
      setHistory(prev => prev.slice(0, -1));
    } catch {
      // Invalid FEN — ignore.
    }
    setEvalResult(null);
    setClassification(null);
    setNote(null);
    setEvaluating(false);
  }, [fen, history.length]);

  const reset = useCallback(() => {
    seqRef.current++;
    setFen(STARTING_FEN);
    setHistory([]);
    setEvalResult(null);
    setClassification(null);
    setNote(null);
    setEvaluating(false);
  }, []);

  return { fen, history, evaluating, eval: evalResult, classification, note, onMove, undo, reset };
}