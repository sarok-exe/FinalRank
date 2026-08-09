import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Flame, ChevronRight, RotateCcw, SkipForward, Sparkles, Loader2, AlertTriangle, Layers } from 'lucide-react';
import Chessboard from '../components/board/Chessboard';
import { fetchPuzzles, type Puzzle } from '../lib/puzzles';
import { getStreakTier } from '../components/StreakFlame';

type PuzzleStatus = 'playing' | 'solved' | 'failed';

type ActivePuzzle = {
  puzzle: Puzzle;
  game: Chess;
  moveIdx: number;
  playerColor: 'w' | 'b';
  status: PuzzleStatus;
  wrongMove?: string;
  lastMove?: { from: string; to: string };
  solutionSan: string[];
};

type TrainingSettings = {
  min: number;
  max: number;
};

type TrainingStats = {
  solved: number;
  streak: number;
  bestStreak: number;
};

const SETTINGS_KEY = 'finalrank-training-settings';
const STATS_KEY = 'finalrank-training-stats';

const DEFAULT_SETTINGS: TrainingSettings = { min: 400, max: 2000 };
const DEFAULT_STATS: TrainingStats = { solved: 0, streak: 0, bestStreak: 0 };

const INITIAL_BATCH = 10;
const REFILL_EVERY = 5;
const REFILL_COUNT = 5;

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as T) };
  } catch {
    return fallback;
  }
}

function uciToMove(uci: string): { from: string; to: string; promotion?: string } {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci[4] : undefined,
  };
}

function solutionToSan(puzzle: Puzzle): string[] {
  const game = new Chess();
  try {
    game.load(puzzle.fen);
  } catch {
    return [];
  }
  const moves = puzzle.moves.split(' ');
  const san: string[] = [];
  for (const uci of moves) {
    try {
      const mv = game.move(uciToMove(uci));
      san.push(mv.san);
    } catch {
      break;
    }
  }
  return san;
}

export default function Training() {
  const [settings, setSettings] = useState<TrainingSettings>(() => loadJSON(SETTINGS_KEY, DEFAULT_SETTINGS));
  const [stats, setStats] = useState<TrainingStats>(() => loadJSON(STATS_KEY, DEFAULT_STATS));

  const [queue, setQueue] = useState<Puzzle[]>([]);
  const [active, setActive] = useState<ActivePuzzle | null>(null);
  const [sessionSolved, setSessionSolved] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const queueRef = useRef(queue);
  queueRef.current = queue;
  const activeRef = useRef(active);
  activeRef.current = active;
  const solvedSinceRefill = useRef(0);

  const persistStats = useCallback((next: TrainingStats) => {
    setStats(next);
    localStorage.setItem(STATS_KEY, JSON.stringify(next));
  }, []);

  const startPuzzle = useCallback((puzzle: Puzzle): ActivePuzzle => {
    const moves = puzzle.moves.split(' ').filter(Boolean);
    const game = new Chess();
    game.load(puzzle.fen);
    let moveIdx = 0;
    if (moves.length >= 2) {
      game.move(uciToMove(moves[0]));
      moveIdx = 1;
    }
    return {
      puzzle,
      game,
      moveIdx,
      playerColor: game.turn(),
      status: 'playing',
      solutionSan: solutionToSan(puzzle),
    };
  }, []);

  const fetchIntoQueue = useCallback(async (count: number, fresh = false) => {
    try {
      if (fresh) { setLoading(true); setError(null); }
      const { puzzles } = await fetchPuzzles({ count, min: settings.min, max: settings.max });
      if (puzzles && puzzles.length > 0) {
        setQueue(q => (fresh ? puzzles : [...q, ...puzzles]));
        if (activeRef.current === null) {
          setActive(startPuzzle(puzzles[0]));
        }
      } else if (fresh) {
        setError('No puzzles found for this rating range. Try widening it.');
      }
    } catch (err) {
      if (fresh) setError(err instanceof Error ? err.message : 'Failed to load puzzles');
    } finally {
      if (fresh) setLoading(false);
      setRefreshing(false);
    }
  }, [settings.min, settings.max, startPuzzle]);

  useEffect(() => {
    void fetchIntoQueue(INITIAL_BATCH, true);
  }, [fetchIntoQueue]);

  const markSolved = useCallback(() => {
    const next = {
      solved: stats.solved + 1,
      streak: stats.streak + 1,
      bestStreak: Math.max(stats.bestStreak, stats.streak + 1),
    };
    persistStats(next);
    setSessionSolved(n => n + 1);

    // Refill: every 5 solved puzzles, pull 5 more straight from the pool.
    solvedSinceRefill.current += 1;
    if (solvedSinceRefill.current % REFILL_EVERY === 0) {
      void fetchIntoQueue(REFILL_COUNT);
    }
  }, [stats, persistStats, fetchIntoQueue]);

  const advance = useCallback(() => {
    const q = queueRef.current;
    const [head, ...rest] = q;
    setQueue(rest);
    if (head) {
      setActive(startPuzzle(head));
    } else {
      setActive(null);
      void fetchIntoQueue(INITIAL_BATCH);
    }
  }, [startPuzzle, fetchIntoQueue]);

  const handleMove = useCallback((from: string, to: string) => {
    if (!active || active.status !== 'playing') return;
    const moves = active.puzzle.moves.split(' ');
    const expected = moves[active.moveIdx];
    if (!expected) return;

    const matched = expected.slice(0, 4) === `${from}${to}`;
    if (!matched) {
      setActive({ ...active, status: 'failed', wrongMove: `${from}${to}` });
      return;
    }

    const game = active.game;
    try {
      game.move(uciToMove(expected));
    } catch {
      setActive({ ...active, status: 'failed', wrongMove: `${from}${to}` });
      return;
    }

    let moveIdx = active.moveIdx + 1;
    if (moveIdx >= moves.length || game.isCheckmate()) {
      markSolved();
      setActive({
        ...active,
        game,
        moveIdx,
        status: 'solved',
        lastMove: { from: expected.slice(0, 2), to: expected.slice(2, 4) },
      });
      return;
    }

    try {
      game.move(uciToMove(moves[moveIdx]));
      moveIdx += 1;
    } catch {
      /* ignore opponent reply errors */
    }

    setActive({
      ...active,
      game,
      moveIdx,
      lastMove: { from: expected.slice(0, 2), to: expected.slice(2, 4) },
    });
  }, [active, markSolved]);

  const retry = useCallback(() => {
    if (!active) return;
    setActive(startPuzzle(active.puzzle));
  }, [active, startPuzzle]);

  const skip = useCallback(() => {
    const next = { ...stats, streak: 0 };
    persistStats(next);
    advance();
  }, [stats, persistStats, advance]);

  const freshBatch = useCallback(() => {
    setRefreshing(true);
    setQueue([]);
    setActive(null);
    setSessionSolved(0);
    solvedSinceRefill.current = 0;
    void fetchIntoQueue(INITIAL_BATCH, true);
  }, [fetchIntoQueue]);

  const updateRange = useCallback((min: number, max: number) => {
    const next = { min, max };
    setSettings(next);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  }, []);

  const applyRange = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    freshBatch();
  }, [freshBatch]);

  const streakTier = getStreakTier(stats.streak);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
        <p className="text-sm text-[var(--color-text-muted)]">Fetching puzzles from lichess…</p>
      </div>
    );
  }

  if (error && !active) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-4">
        <AlertTriangle className="w-10 h-10 text-[var(--color-accent)]" />
        <p className="text-sm text-[var(--color-text-muted)] text-center max-w-xs">{error}</p>
        <button
          onClick={freshBatch}
          className="bg-[var(--color-primary)] text-white px-6 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2"
        >
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Try again
        </button>
      </div>
    );
  }

  if (!active) return null;

  const playerLabel = active.playerColor === 'w' ? 'White' : 'Black';
  const remaining = active.puzzle.moves.split(' ').filter(Boolean).length;
  const playerMoves = Math.ceil((remaining - 1) / 2);
  const playerMovesDone = active.moveIdx > 1 ? Math.ceil((active.moveIdx - 1) / 2) : 0;
  const playerSolution = active.solutionSan.filter((_, i) => i % 2 === 1);

  return (
    <div className="max-w-[520px] mx-auto px-3 sm:px-4 py-4 sm:py-6 flex flex-col gap-4" id="training-page">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg font-extrabold" style={{ color: streakTier.color, textShadow: `0 0 12px ${streakTier.glow}` }}>
            {stats.streak}
          </span>
          <Flame className="w-5 h-5" style={{ color: streakTier.color }} />
          <span className="text-xs text-[var(--color-text-muted)] truncate">best {stats.bestStreak}</span>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--color-text-muted)]">
            Solved <span className="text-white font-bold">{sessionSolved}</span>
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)]">#{active.puzzle.id}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30">
          <Sparkles className="w-3.5 h-3.5" />
          Rating {active.puzzle.rating}
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
          <Layers className="w-3.5 h-3.5" />
          {queue.length} queued
        </span>
      </div>

      <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-3">
        <Chessboard
          fen={active.game.fen()}
          onMove={handleMove}
          playable={active.status === 'playing'}
          orientation={active.playerColor === 'w' ? 'white' : 'black'}
          highlightSquares={active.lastMove}
          animationDurationInMs={300}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold">
          {active.status === 'playing' && (
            <>Find the best move for <span className="text-[var(--color-accent)]">{playerLabel}</span> ({playerMovesDone}/{playerMoves})</>
          )}
          {active.status === 'solved' && (
            <span className="text-emerald-400">Solved! Well played.</span>
          )}
          {active.status === 'failed' && (
            <span className="text-rose-400">Incorrect — {playerLabel} had a better move.</span>
          )}
        </p>
        <button
          onClick={freshBatch}
          className="flex items-center gap-1 text-xs font-bold text-[var(--color-text-muted)] hover:text-white transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {refreshing ? 'Loading…' : 'New batch'}
        </button>
      </div>

      {active.status === 'solved' && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4">
          <p className="text-xs text-[var(--color-text-muted)] mb-2 font-bold">Solution</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {playerSolution.map((san, i) => (
              <span key={i} className="px-2 py-1 rounded-md text-xs font-bold bg-[var(--color-surface)] border border-[var(--color-border)]">
                {san}
              </span>
            ))}
          </div>
          <button
            onClick={advance}
            className="w-full flex items-center justify-center gap-1.5 bg-[var(--color-primary)] text-white px-6 py-2.5 rounded-lg font-bold text-sm"
          >
            Next puzzle <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {active.status === 'failed' && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4">
          <p className="text-xs text-[var(--color-text-muted)] mb-2 font-bold">Solution ({playerLabel})</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {playerSolution.map((san, i) => (
              <span key={i} className="px-2 py-1 rounded-md text-xs font-bold bg-[var(--color-surface)] border border-[var(--color-border)]">
                {san}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={retry}
              className="flex items-center justify-center gap-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] text-white px-4 py-2.5 rounded-lg font-bold text-sm"
            >
              <RotateCcw className="w-4 h-4" /> Retry
            </button>
            <button
              onClick={skip}
              className="flex items-center justify-center gap-1.5 bg-[var(--color-primary)] text-white px-4 py-2.5 rounded-lg font-bold text-sm"
            >
              <SkipForward className="w-4 h-4" /> Next
            </button>
          </div>
        </div>
      )}

      <form onSubmit={applyRange} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4">
        <p className="text-xs text-[var(--color-text-muted)] mb-3 font-bold">Puzzle range</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-[var(--color-text-muted)]">Min rating</span>
            <input
              type="number"
              min={0}
              max={3500}
              value={settings.min}
              onChange={e => updateRange(parseInt(e.target.value, 10) || 0, settings.max)}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-[var(--color-primary)]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-[var(--color-text-muted)]">Max rating</span>
            <input
              type="number"
              min={0}
              max={3500}
              value={settings.max}
              onChange={e => updateRange(settings.min, parseInt(e.target.value, 10) || 0)}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-[var(--color-primary)]"
            />
          </label>
        </div>
        <button
          type="submit"
          className="mt-3 w-full flex items-center justify-center gap-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] text-white px-4 py-2 rounded-lg font-bold text-xs"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reload with range
        </button>
      </form>
    </div>
  );
}
