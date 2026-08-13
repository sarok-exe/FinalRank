import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import {
  Flame,
  ChevronRight,
  RotateCcw,
  SkipForward,
  Sparkles,
  Loader2,
  AlertTriangle,
  Layers,
  Lightbulb,
  Target,
  Trophy,
  Hash,
  Circle,
} from 'lucide-react';
import Chessboard from '../components/board/Chessboard';
import { fetchPuzzles, type Puzzle } from '../lib/puzzles';
import { getStreakTier } from '../components/StreakFlame';
import { useSound, getSoundTypeFromSan } from '../hooks/useSound';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const SETTINGS_KEY = 'finalrank-training-settings';
const STATS_KEY = 'finalrank-training-stats';

const DEFAULT_SETTINGS: TrainingSettings = { min: 400, max: 2000 };
const DEFAULT_STATS: TrainingStats = { solved: 0, streak: 0, bestStreak: 0 };

const INITIAL_BATCH = 10;
const REFILL_EVERY = 5;
const REFILL_COUNT = 5;

// Auto-advance to the next puzzle after a puzzle is completed. The failed delay
// is longer so the player gets a moment to read the correct solution.
const AUTO_ADVANCE_DELAY_MS = { solved: 1500, failed: 3000 } as const;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function Training() {
  const [settings, setSettings] = useState<TrainingSettings>(() => loadJSON(SETTINGS_KEY, DEFAULT_SETTINGS));
  const [stats, setStats] = useState<TrainingStats>(() => loadJSON(STATS_KEY, DEFAULT_STATS));

  const [queue, setQueue] = useState<Puzzle[]>([]);
  const [active, setActive] = useState<ActivePuzzle | null>(null);
  const [sessionSolved, setSessionSolved] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /* Hint state — one hint per puzzle */
  const [hint, setHint] = useState<{ from: string; to: string } | null>(null);

  const queueRef = useRef(queue);
  queueRef.current = queue;
  const activeRef = useRef(active);
  activeRef.current = active;
  const solvedSinceRefill = useRef(0);

  const { play } = useSound();

  /* -------------------------------------------------------------------------- */
  /*  Stats persistence                                                          */
  /* -------------------------------------------------------------------------- */

  const persistStats = useCallback((next: TrainingStats) => {
    setStats(next);
    localStorage.setItem(STATS_KEY, JSON.stringify(next));
  }, []);

  /* -------------------------------------------------------------------------- */
  /*  Puzzle start                                                               */
  /* -------------------------------------------------------------------------- */

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

  /* -------------------------------------------------------------------------- */
  /*  Fetch & queue management                                                   */
  /* -------------------------------------------------------------------------- */

  const fetchIntoQueue = useCallback(async (count: number, fresh = false) => {
    try {
      if (fresh) { setLoading(true); setError(null); }
      const { puzzles } = await fetchPuzzles({ count, min: settings.min, max: settings.max });
      if (puzzles && puzzles.length > 0) {
        const startNow = activeRef.current === null;
        const remaining = startNow ? puzzles.slice(1) : puzzles;
        setQueue(q => (fresh ? remaining : [...q, ...remaining]));
        if (startNow) setActive(startPuzzle(puzzles[0]));
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

  /* -------------------------------------------------------------------------- */
  /*  Mark solved                                                                */
  /* -------------------------------------------------------------------------- */

  const markSolved = useCallback(() => {
    play('puzzle-correct-2');
    const next = {
      solved: stats.solved + 1,
      streak: stats.streak + 1,
      bestStreak: Math.max(stats.bestStreak, stats.streak + 1),
    };
    persistStats(next);
    setSessionSolved(n => n + 1);

    solvedSinceRefill.current += 1;
    if (solvedSinceRefill.current % REFILL_EVERY === 0) {
      void fetchIntoQueue(REFILL_COUNT);
    }
  }, [stats, persistStats, fetchIntoQueue, play]);

  /* -------------------------------------------------------------------------- */
  /*  Advance to next puzzle                                                     */
  /* -------------------------------------------------------------------------- */

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
    setHint(null);
  }, [startPuzzle, fetchIntoQueue]);

  /* -------------------------------------------------------------------------- */
  /*  Handle board move                                                          */
  /* -------------------------------------------------------------------------- */

  const handleMove = useCallback((from: string, to: string): boolean => {
    if (!active || active.status !== 'playing') return false;
    const moves = active.puzzle.moves.split(' ');
    const expected = moves[active.moveIdx];
    if (!expected) return false;

    const matched = expected.slice(0, 4) === `${from}${to}`;
    if (!matched) {
      play('puzzle-wrong');
      setActive({ ...active, status: 'failed', wrongMove: `${from}${to}` });
      return false;
    }

    const game = active.game;
    let san: string;
    try {
      san = game.move(uciToMove(expected)).san;
    } catch {
      play('puzzle-wrong');
      setActive({ ...active, status: 'failed', wrongMove: `${from}${to}` });
      return false;
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
      setHint(null);
      return true;
    }

    try {
      game.move(uciToMove(moves[moveIdx]));
      moveIdx += 1;
    } catch {
      /* ignore opponent reply errors */
    }

    play(getSoundTypeFromSan(san));
    setActive({
      ...active,
      game,
      moveIdx,
      lastMove: { from: expected.slice(0, 2), to: expected.slice(2, 4) },
    });
    setHint(null);
    return true;
  }, [active, markSolved, play]);

  /* -------------------------------------------------------------------------- */
  /*  Retry / skip / fresh batch / range                                         */
  /* -------------------------------------------------------------------------- */

  const retry = useCallback(() => {
    if (!active) return;
    setHint(null);
    setActive(startPuzzle(active.puzzle));
  }, [active, startPuzzle]);

  const skip = useCallback(() => {
    const next = { ...stats, streak: 0 };
    persistStats(next);
    setHint(null);
    advance();
  }, [stats, persistStats, advance]);

  const freshBatch = useCallback(() => {
    setRefreshing(true);
    setQueue([]);
    setActive(null);
    setSessionSolved(0);
    solvedSinceRefill.current = 0;
    setHint(null);
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

  /* -------------------------------------------------------------------------- */
  /*  Hint handler                                                               */
  /* -------------------------------------------------------------------------- */

  const handleHint = useCallback(() => {
    if (!active || active.status !== 'playing') return;
    play('click');
    const expected = active.puzzle.moves.split(' ')[active.moveIdx];
    if (expected) {
      setHint({ from: expected.slice(0, 2), to: expected.slice(2, 4) });
    }
  }, [active, play]);

  /* -------------------------------------------------------------------------- */
  /*  Auto-advance after completing a puzzle                                     */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    if (!active) return;
    if (active.status === 'solved') {
      const t = setTimeout(() => advance(), AUTO_ADVANCE_DELAY_MS.solved);
      return () => clearTimeout(t);
    }
    if (active.status === 'failed') {
      // Failing should break the streak, same as pressing "Skip".
      const t = setTimeout(() => skip(), AUTO_ADVANCE_DELAY_MS.failed);
      return () => clearTimeout(t);
    }
  }, [active, advance, skip]);

  /* -------------------------------------------------------------------------- */
  /*  Derived values                                                             */
  /* -------------------------------------------------------------------------- */

  const streakTier = getStreakTier(stats.streak);

  /* -------------------------------------------------------------------------- */
  /*  Loading state                                                              */
  /* -------------------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
        <p className="text-sm text-[var(--color-text-muted)]">Fetching puzzles from lichess...</p>
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /*  Error state                                                                */
  /* -------------------------------------------------------------------------- */

  if (error && !active) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-4">
        <AlertTriangle className="w-10 h-10 text-[var(--color-accent)]" />
        <p className="text-sm text-[var(--color-text-muted)] text-center max-w-xs">{error}</p>
        <button
          onClick={() => { play('click'); freshBatch(); }}
          className="bg-[var(--color-primary)] text-white px-6 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2"
        >
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Try again
        </button>
      </div>
    );
  }

  if (!active) return null;

  /* -------------------------------------------------------------------------- */
  /*  Derived values (post-active check)                                         */
  /* -------------------------------------------------------------------------- */

  const playerLabel = active.playerColor === 'w' ? 'White' : 'Black';
  const remaining = active.puzzle.moves.split(' ').filter(Boolean).length;
  const playerMoves = Math.ceil((remaining - 1) / 2);
  const playerMovesDone = active.moveIdx > 1 ? Math.ceil((active.moveIdx - 1) / 2) : 0;
  const playerSolution = active.solutionSan.filter((_, i) => i % 2 === 1);
  const progressPct = playerMoves > 0 ? Math.min((playerMovesDone / playerMoves) * 100, 100) : 0;
  const canHint = active.status === 'playing';
  const isSolved = active.status === 'solved';
  const isFailed = active.status === 'failed';

  /* -------------------------------------------------------------------------- */
  /*  Render                                                                     */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="w-full max-w-[1100px] mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 page-enter" id="training-page">

      {/* ── Desktop: two-column  /  Mobile: stacked ── */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-5">

        {/* ════════════════════════════════════════════════════
            LEFT — Board
            ════════════════════════════════════════════════════ */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 lg:gap-4">

          {/* Rating badge + queue count (mobile top bar) */}
          <div className="flex items-center justify-between gap-2 lg:hidden">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30">
              <Sparkles className="w-3.5 h-3.5" />
              Rating {active.puzzle.rating}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
              <Layers className="w-3.5 h-3.5" />
              {queue.length} queued
            </span>
          </div>

          {/* Board card */}
          <div className="w-full max-w-[550px] mx-auto rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-2 sm:p-3">
            <Chessboard
              fen={active.game.fen()}
              onMove={handleMove}
              playable={active.status === 'playing'}
              orientation={active.playerColor === 'w' ? 'white' : 'black'}
              highlightSquares={active.lastMove}
              hintSquare={hint?.from}
              animationDurationInMs={300}
            />
          </div>

          {/* Status line below board */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold">
              {active.status === 'playing' && (
                <>Find the best move for <span className="text-[var(--color-accent)]">{playerLabel}</span> ({playerMovesDone}/{playerMoves})</>
              )}
              {active.status === 'solved' && (
                <span className="text-emerald-400">Solved! Well played.</span>
              )}
              {active.status === 'failed' && (
                <span className="text-rose-400">Incorrect. {playerLabel} had a better move.</span>
              )}
            </p>
            <button
              onClick={() => { play('click'); freshBatch(); }}
              className="flex items-center gap-1 text-xs font-bold text-[var(--color-text-muted)] hover:text-white transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {refreshing ? 'Loading...' : 'New batch'}
            </button>
          </div>

          {/* ── Result panels (mobile — also shown below sidebar on desktop for completeness) ── */}
          {isSolved && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 lg:hidden">
              <p className="text-xs text-emerald-400 mb-2 font-bold uppercase tracking-wider">Solution</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {playerSolution.map((san, i) => (
                  <span key={i} className="px-2 py-1 rounded-md text-xs font-bold bg-[var(--color-surface)] border border-emerald-500/20 text-emerald-300">
                    {i + 1}. {san}
                  </span>
                ))}
              </div>
              <button
                onClick={() => { play('click'); advance(); }}
                className="w-full flex items-center justify-center gap-1.5 bg-[var(--color-primary)] text-white px-6 py-2.5 rounded-lg font-bold text-sm"
              >
                Next puzzle <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {isFailed && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 lg:hidden">
              <p className="text-xs text-rose-400 mb-2 font-bold uppercase tracking-wider">Solution ({playerLabel})</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {playerSolution.map((san, i) => (
                  <span key={i} className="px-2 py-1 rounded-md text-xs font-bold bg-[var(--color-surface)] border border-rose-500/20 text-rose-300">
                    {i + 1}. {san}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { play('click'); retry(); }}
                  className="flex items-center justify-center gap-1.5 bg-[var(--color-primary)] text-white px-4 py-2.5 rounded-lg font-bold text-sm hover:brightness-110 active:scale-[0.97] transition-all"
                >
                  <RotateCcw className="w-4 h-4" /> Retry
                </button>
                <button
                  onClick={() => { play('click'); skip(); }}
                  className="flex items-center justify-center gap-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] text-white px-4 py-2.5 rounded-lg font-bold text-sm"
                >
                  <SkipForward className="w-4 h-4" /> Skip
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════
            RIGHT — Sidebar
            ════════════════════════════════════════════════════ */}
        <div className="w-full lg:w-[320px] shrink-0 flex flex-col gap-3">

          {/* ── Turn indicator + Rating ── */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Circle
                  className="w-3 h-3"
                  fill={active.playerColor === 'w' ? '#ffffff' : '#333333'}
                  stroke={active.playerColor === 'w' ? '#ffffff' : '#666666'}
                />
                <span className="text-sm font-bold">
                  You play <span className="text-[var(--color-accent)]">{playerLabel}</span>
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30">
                <Sparkles className="w-3 h-3" />
                {active.puzzle.rating}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-[var(--color-background)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${progressPct}%`,
                  background: isSolved
                    ? 'var(--color-primary)'
                    : isFailed
                      ? '#ef4444'
                      : 'var(--color-accent)',
                }}
              />
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5 text-right">
              {playerMovesDone} of {playerMoves} moves
            </p>
          </div>

          {/* ── Stats cards ── */}
          <div className="grid grid-cols-2 gap-2">
            {/* Streak */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 flex flex-col items-center gap-1">
              <div className="flex items-center gap-1.5">
                <Flame
                  className="w-4 h-4"
                  style={{
                    color: streakTier.color,
                    filter: `drop-shadow(0 0 6px ${streakTier.glow})`,
                  }}
                />
                <span
                  className="text-lg font-extrabold"
                  style={{
                    color: streakTier.color,
                    textShadow: `0 0 12px ${streakTier.glow}`,
                  }}
                >
                  {stats.streak}
                </span>
              </div>
              <span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Streak</span>
            </div>

            {/* Best streak */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 flex flex-col items-center gap-1">
              <div className="flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-[var(--color-accent)]" />
                <span className="text-lg font-extrabold text-[var(--color-accent)]">{stats.bestStreak}</span>
              </div>
              <span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Best</span>
            </div>

            {/* Solved this session */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 flex flex-col items-center gap-1">
              <div className="flex items-center gap-1.5">
                <Target className="w-4 h-4 text-[var(--color-primary)]" />
                <span className="text-lg font-extrabold text-[var(--color-primary)]">{sessionSolved}</span>
              </div>
              <span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Solved</span>
            </div>

            {/* Queue */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 flex flex-col items-center gap-1">
              <div className="flex items-center gap-1.5">
                <Hash className="w-4 h-4 text-[var(--color-text-muted)]" />
                <span className="text-lg font-extrabold text-[var(--color-text-muted)]">{queue.length}</span>
              </div>
              <span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Queued</span>
            </div>
          </div>

          {/* ── Action buttons ── */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleHint}
              disabled={!canHint}
              className="flex items-center justify-center gap-1.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 px-4 py-2.5 rounded-xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-500/25 active:scale-[0.97] transition-all"
            >
              <Lightbulb className="w-4 h-4" /> Hint
            </button>

            {isFailed && (
              <button
                onClick={() => { play('click'); retry(); }}
                className="flex items-center justify-center gap-1.5 bg-[var(--color-primary)] text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:brightness-110 active:scale-[0.97] transition-all"
              >
                <RotateCcw className="w-4 h-4" /> Retry
              </button>
            )}

            {isFailed && (
              <button
                onClick={() => { play('click'); skip(); }}
                className="col-span-2 flex items-center justify-center gap-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:border-[var(--color-text-muted)] active:scale-[0.97] transition-all"
              >
                <SkipForward className="w-4 h-4" /> Skip puzzle
              </button>
            )}

            {isSolved && (
              <button
                onClick={() => { play('click'); advance(); }}
                className="col-span-2 flex items-center justify-center gap-1.5 bg-[var(--color-primary)] text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:brightness-110 active:scale-[0.97] transition-all"
              >
                Next puzzle <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* ── Solution panel (solved) ── */}
          {isSolved && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4">
              <p className="text-xs text-emerald-400 mb-2 font-bold uppercase tracking-wider">Solution</p>
              <div className="flex flex-wrap gap-1.5">
                {playerSolution.map((san, i) => (
                  <span key={i} className="px-2 py-1 rounded-md text-xs font-bold bg-[var(--color-surface)] border border-emerald-500/20 text-emerald-300">
                    {i + 1}. {san}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Solution panel (failed) ── */}
          {isFailed && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4">
              <p className="text-xs text-rose-400 mb-2 font-bold uppercase tracking-wider">Correct solution ({playerLabel})</p>
              <div className="flex flex-wrap gap-1.5">
                {playerSolution.map((san, i) => (
                  <span key={i} className={`px-2 py-1 rounded-md text-xs font-bold bg-[var(--color-surface)] border ${i === 0 ? 'border-rose-400 text-rose-300 ring-1 ring-rose-400/30' : 'border-rose-500/20 text-rose-300'}`}>
                    {i + 1}. {san}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Rating range settings ── */}
          <form onSubmit={applyRange} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4">
            <p className="text-xs text-[var(--color-text-muted)] mb-3 font-bold uppercase tracking-wider">Puzzle range</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-[var(--color-text-muted)]">Min rating</span>
                <input
                  type="number"
                  min={0}
                  max={3500}
                  value={settings.min}
                  onChange={e => updateRange(parseInt(e.target.value, 10) || 0, settings.max)}
                  className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm w-full text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
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
                  className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm w-full text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </label>
            </div>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white hover:border-[var(--color-text-muted)] px-4 py-2 rounded-lg font-bold text-xs active:scale-[0.97] transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reload with range
            </button>
          </form>

          {/* ── Puzzle ID ── */}
          <p className="text-[10px] text-[var(--color-text-muted)] text-center">
            Puzzle #{active.puzzle.id}
          </p>
        </div>
      </div>
    </div>
  );
}
