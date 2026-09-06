// @ts-nocheck - TODO: remove when TS 5.8/zustand v5 type inference issue resolved
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Zap,
  AlertTriangle,
  History,
  Activity,
  Award,
  FileText,
  ArrowLeft,
  Trophy,
  BookOpen,
  ChevronDown,
  RotateCcw,
  Keyboard,
  Maximize,
  Focus,
  Pause,
  Play,
  Rewind,
  Heart,
  Share2,
  GitBranch,
  X,
} from 'lucide-react';
import { useGameStore, getRecentGames } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import { hashPgn, getPriorAnalyses, engineLabel } from '../lib/analysisCache';
import type { AnalysisRunMeta } from '../lib/analysisCache';
import { shortIdFromKey } from '../lib/shortId';
import type { ChessGame } from '../types';
import { STARTING_FEN } from '../types';
import { useSettingsStore } from '../stores/settingsStore';
import { useUIStore } from '../stores/uiStore';
import { isValidUsername } from '../lib/validator';
import { isValidPgn } from '../lib/validator';
import { useFullscreen } from '../hooks/useFullscreen';
import Chessboard from '../components/board/Chessboard';
import EvalBar from '../components/eval/EvalBar';
import PlayerAvatar from '../components/PlayerAvatar';
import { classificationImages, classificationColours, classificationNames, classificationBadgeStyles } from '../constants/classifications';
import { getTopEngineLine } from '../lib/engine';
import { useSound, getSoundTypeFromSan } from '../hooks/useSound';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { SkeletonGameGrid, SkeletonBoard, SkeletonMoveList } from '../components/Skeleton';
import AnalysisReport from '../components/AnalysisReport';
import CoachPanel from '../components/CoachPanel';
import { buildCoachNotes } from '../lib/reporter/coach';
import type { CoachNote } from '../lib/reporter/coach';

type SavedGame = {
  id: string;
  shortId?: string;
  date?: string;
  white?: { username?: string; avatar?: string; rating?: number };
  black?: { username?: string; avatar?: string; rating?: number };
  result?: string;
  accuracy?: { white?: number; black?: number };
  userSaved?: boolean;
};

// Compact badge for the what-if (hypothesis) classification: mate is solid
// red/white, everything else follows the shared classificationBadgeStyles.
function HypothesisClassificationBadge({ classification }: { classification: string }) {
  const style = classificationBadgeStyles[classification];
  if (!style) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
      style={{ color: style.color, backgroundColor: style.bg, border: `1px solid ${style.border}` }}
    >
      {style.label}
    </span>
  );
}

type PlayerBarProps = {
  player?: { username?: string; rating?: number; avatar?: string };
  side: 'w' | 'b';
  result?: string;
  accuracy?: { white?: number; black?: number };
};

// Chess.com-style single-line player bar that hugs the board: avatar,
// username, rating chip, and a subtle winner/draw indicator.
function PlayerBar({ player, side, result, accuracy }: PlayerBarProps) {
  const isWhite = side === 'w';
  const winner = result === '1-0' ? 'w' : result === '0-1' ? 'b' : undefined;
  const isDraw = result === '1/2-1/2' || result === '½-½';
  const isWinner = winner === side;
  const playerAcc = isWhite ? accuracy?.white : accuracy?.black;

  return (
    <div
      id={`player-bar-${side}`}
      className={`w-full flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors ${
        isWinner
          ? 'border-[#f5c542]/70 bg-[color-mix(in_srgb,var(--color-surface)_93%,#f5c542_7%)] shadow-[0_0_14px_rgba(245,197,66,0.18)]'
          : 'border-[var(--color-border)] bg-[var(--color-surface)]'
      }`}
    >
      {player?.avatar ? (
        <img
          src={player.avatar}
          alt=""
          loading="lazy"
          className={`w-[32px] h-[32px] rounded-[10px] object-cover shrink-0 border ${
            isWhite ? 'border-[var(--color-text-muted)]' : 'border-[var(--color-border)]'
          }`}
        />
      ) : (
        <span
          className={`w-[32px] h-[32px] rounded-[10px] shrink-0 block border border-[var(--color-text-muted)] ${
            isWhite ? 'bg-white' : 'bg-[var(--color-surface)]'
          }`}
        />
      )}

      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-sm font-bold text-white truncate">
          {player?.username ?? (isWhite ? 'White' : 'Black')}
        </span>
        <span
          className="shrink-0 text-[11px] font-mono font-bold text-white bg-[var(--color-background)] border border-[var(--color-border)] rounded-md px-1.5 py-px leading-4"
          title={player?.rating != null ? 'Rating' : 'Rating not available'}
        >
          {player?.rating ?? '—'}
        </span>
      </div>

      {playerAcc != null && (
        <span
          className="shrink-0 inline-flex items-center rounded-md bg-[var(--color-background)] border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--color-accent)]"
          title="Accuracy"
        >
          {playerAcc}%
        </span>
      )}

      {isDraw ? (
        <span className="shrink-0 text-[10px] font-bold text-[var(--color-text-muted)] border border-[var(--color-border)] rounded-md px-1.5 py-px" title="Draw">
          ½–½
        </span>
      ) : isWinner ? (
        <span
          className="shrink-0 flex items-center justify-center w-[22px] h-[22px] rounded-md bg-[#f5c542] text-black border border-[#f5c542] shadow-[0_0_10px_rgba(245,197,66,0.35)]"
          title="Winner"
        >
          <Trophy className="w-3 h-3" />
        </span>
      ) : null}
    </div>
  );
}

export default function Analysis() {
  const {
    games: storeGames,
    selectedGame,
    currentMoveIndex,
    analyzing,
    analysisProgress,
    importError,
    loadingGames,
    analysisCache,
    analyzedPgnHashes,
    linkedGames,
    linkedLoading,
    linkedAnalyzing,
    linkedAnalysisProgress,
    hypothesisActive,
    hypothesisMoves,
    hypothesisBaseIndex,
    hypothesisSearching,
    hypothesisError,
    hypothesisLines,
    hypothesisDepth,
    hypothesisClassification,
    importChessComGames,
    importLichessGames,
    selectGame,
    setCurrentMoveIndex,
    importPgnDirectly,
    triggerEvaluationPipeline,
    loadPriorAnalysis,
    setGames,
    clearGames,
    fetchLinkedUserGames,
    loadUserGames,
    loadGameByShortId,
    enterHypothesisMode,
    exitHypothesisMode,
    playHypothesisMove,
    undoHypothesisMove,
    clearHypothesisMoves,
  } = useGameStore();
  const games = storeGames;

  const { user: authUser } = useAuthStore();

  const { settings, updateSettings } = useSettingsStore();
  const { focusMode, fullscreenMode, toggleFocusMode } = useUIStore();
  const { toggleFullscreen } = useFullscreen();
  const { play, playFromSan, playGameEnd } = useSound();

  const { gameId: urlGameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Post-game flow: the tools lane lands here via /game/:id?post=1 once a match
  // finishes. Gates the auto-start and the match-finished options panel below.
  const isPostFlow = searchParams.get('post') === '1';

  const [usernameInput, setUsernameInput] = useState('');
  const [pgnInput, setPgnInput] = useState('');
  const [importMode, setImportMode] = useState<'chesscom' | 'lichess' | 'pgn'>('chesscom');
  const [notificationDismissed, setNotificationDismissed] = useState(false);
  const [showGameList, setShowGameList] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const [savedGameIds, setSavedGameIds] = useState<Set<string>>(new Set());
  const [favoriteGames, setFavoriteGames] = useState<SavedGame[]>([]);
  const [showShare, setShowShare] = useState(false);
  const [priorAnalyses, setPriorAnalyses] = useState<AnalysisRunMeta[]>([]);
  const [showPriorAnalyses, setShowPriorAnalyses] = useState(false);
  const [copied, setCopied] = useState(false);
  const [urlGameNotFound, setUrlGameNotFound] = useState(false);
  const [rightClickedSquares, setRightClickedSquares] = useState<string[]>([]);
  // What-if navigation: which hypothesis move's position the board is showing
  // (-1 = the base position before the line). It stays pinned to the tip whenever
  // the line changes, and is stepped with the arrow keys while in what-if mode.
  const [hypViewIndex, setHypViewIndex] = useState(-1);
  // Regular vs Advanced split of the page chrome. Regular strips the page to a
  // bare analysis surface (board, engine picker, move log); Advanced keeps all
  // the extras (tabs, coach, what-if, report, favorites, opening name, banner).
  // Default 'regular' opens on a stripped-down analysis surface; Advanced is one
  // tap away for the full chrome. Only rendering changes — the shared board,
  // what-if state and analysisProgress live untouched in the store.
  const [analysisMode, setAnalysisMode] = useState<'regular' | 'advanced'>('regular');
  // Rewind-on-analyze: refs only (no re-renders needed — the engine's progress
  // ticks already re-render the page while analyzing). `rewindArmedRef` is set
  // when Analyze is pressed from the final position; `prevAnalyzingRef` detects
  // the analyzing true→false edge so the board can snap on completion.
  const rewindArmedRef = React.useRef(false);
  const prevAnalyzingRef = React.useRef(false);
  // POST-GAME PANEL state. `postPanelConsumedRef` latches the moment the user
  // dismisses the panel or re-analyzes, so later runs can never resurface it;
  // `prevPostAnalyzingRef` detects the analyzing true→false edge for the reveal.
  const [postPanelVisible, setPostPanelVisible] = useState(false);
  const [postStrength, setPostStrength] = useState<'weaker' | 'same' | 'stronger'>('same');
  const postPanelConsumedRef = React.useRef(false);
  const prevPostAnalyzingRef = React.useRef(false);
  const [vpW, setVpW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const onResize = () => { setVpW(window.innerWidth); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); };
  }, []);

  // Switching to Regular strips the what-if UI away, so any active hypothesis
  // line is exited cleanly first (the store keeps its own what-if state).
  const handleModeChange = React.useCallback((mode: 'regular' | 'advanced') => {
    setAnalysisMode(mode);
    if (mode === 'regular' && useGameStore.getState().hypothesisActive) {
      exitHypothesisMode();
    }
  }, [exitHypothesisMode]);

const isInAnalysis = !!selectedGame;
const legendaryData = checkLegendaryStatus();
const currentMove = selectedGame?.moves[currentMoveIndex];
// The book prefix is contiguous from the start, so the first move carrying an
// `opening` value is the game's opening. Derive it once so it persists across
// all moves of the analysis instead of vanishing past the book prefix.
const openingName = selectedGame?.moves.find(m => m.opening)?.opening ?? null;
const coachNotes = React.useMemo(() => (selectedGame ? buildCoachNotes(selectedGame) : []), [selectedGame]);

function formatDuration(ms: number | undefined): string {
  if (!ms || ms <= 0) return '';
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const min = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${min}m ${sec}s`;
}

  useEffect(() => {
    if (urlGameId) {
      setUrlGameNotFound(false);
      loadGameByShortId(urlGameId).then(game => {
        if (!game) {
          setUrlGameNotFound(true);
          useToastStore.getState().addToast({
            type: 'error',
            message: 'Game not found. It may not have been saved yet.',
          });
        }
      });
    }
  }, [urlGameId]);

  useEffect(() => {
    if (selectedGame?.shortId && selectedGame.shortId !== urlGameId) {
      navigate(`/game/${selectedGame.shortId}`, { replace: true });
    } else if (selectedGame && !selectedGame.shortId && !urlGameId) {
      const shortId = shortIdFromKey(selectedGame.id);
      useGameStore.setState(s => ({
        games: s.games.map(g => g.id === selectedGame.id ? { ...g, shortId } : g),
        selectedGame: s.selectedGame?.id === selectedGame.id ? { ...s.selectedGame, shortId } : s.selectedGame,
      }));
      navigate(`/game/${shortId}`, { replace: true });
    }
  }, [selectedGame?.id]);

  useEffect(() => {
    if (authUser && (authUser.authProvider === 'google' || authUser.authProvider === 'anonymous')) {
      loadUserGames();
    }
  }, [authUser?.id]);

  useEffect(() => {
    if (authUser?.chessComUsername) {
      fetchLinkedUserGames();
    }
  }, [authUser?.chessComUsername]);

  // Refresh games list when tab becomes visible (user returns from other tabs)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        const u = useAuthStore.getState().user;
        if (u && (u.authProvider === 'google' || u.authProvider === 'anonymous')) {
          void loadUserGames();
        }
        if (u?.chessComUsername) {
          void fetchLinkedUserGames();
        }
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  // Auto-show game list when import just completed
  const importJustCompleted = useGameStore(s => s.importJustCompleted);
  useEffect(() => {
    if (importJustCompleted) {
      setShowGameList(true);
      useGameStore.getState().consumeImportFlag();
    }
  }, [importJustCompleted]);

  const prevMoveIndexRef = React.useRef(currentMoveIndex);
  React.useEffect(() => {
    if (!selectedGame) return;
    if (prevMoveIndexRef.current !== currentMoveIndex) {
      prevMoveIndexRef.current = currentMoveIndex;
      if (currentMoveIndex >= 0 && selectedGame.moves[currentMoveIndex]) {
        playFromSan(selectedGame.moves[currentMoveIndex].san);
      }
    }
  }, [currentMoveIndex, selectedGame, playFromSan]);

  const prevProgressRef = React.useRef(analysisProgress);
  React.useEffect(() => {
    if (prevProgressRef.current < 100 && analysisProgress >= 100) {
      play('notification');
    }
    prevProgressRef.current = analysisProgress;
  }, [analysisProgress, play]);

  const prevLegendaryRef = React.useRef(false);
  React.useEffect(() => {
    const nowLegendary = !!legendaryData;
    if (nowLegendary && !prevLegendaryRef.current) {
      play('achievement');
    }
    prevLegendaryRef.current = nowLegendary;
  }, [legendaryData, play]);

  // What-if view sync: the board follows the tip whenever the line changes
  // structurally (play / undo / reset), and falls back to the base position
  // outside what-if mode. Same-length updates (e.g. a finished search attaching
  // analysis to the tip) deliberately leave the user's navigation alone.
  React.useEffect(() => {
    setHypViewIndex(hypothesisMoves.length - 1);
  }, [hypothesisMoves.length]);
  React.useEffect(() => {
    if (!hypothesisActive) setHypViewIndex(-1);
  }, [hypothesisActive]);

  // Entering the match always shows the FINAL position (the store starts at -1),
  // so pressing Analyze visibly rewinds the pieces back to the start. useLayoutEffect
  // avoids a one-frame flash of the starting position right after selection.
  React.useLayoutEffect(() => {
    if (!selectedGame || selectedGame.moves.length === 0) return;
    setCurrentMoveIndex(selectedGame.moves.length - 1);
  }, [selectedGame?.id, setCurrentMoveIndex]);

  // REWIND-ON-ANALYZE: while the engine runs, drive currentMoveIndex backward in
  // lockstep with analysisProgress (throttled 1→90 ticks) so the pieces return to
  // the start just as the analysis finishes. Idempotent per progress value — only
  // steps when the target differs from the freshly-read store index, so throttle
  // gaps and StrictMode double-runs can never fight the board.
  React.useEffect(() => {
    if (!rewindArmedRef.current) return;
    if (hypothesisActive) return;
    if (!selectedGame || selectedGame.moves.length === 0) return;
    if (!analyzing || analysisProgress < 1 || analysisProgress > 95) return;
    const total = selectedGame.moves.length;
    const progress = Math.min(analysisProgress, 90); // clamp late ticks so a missed 90 still lands on -1
    const target = Math.max(-1, total - 1 - Math.floor((progress / 90) * total));
    const current = useGameStore.getState().currentMoveIndex;
    if (current !== target) {
      setCurrentMoveIndex(target);
    }
  }, [analyzing, analysisProgress, hypothesisActive, selectedGame, setCurrentMoveIndex]);

  // On completion (analyzing true→false) the rewind is disarmed. A finished run
  // ALWAYS returns the pieces to the start position (the state before the match
  // began) — whether or not the rewind was armed (auto-analysis on load, or
  // Analyze pressed mid-game) — while a failed/aborted run restores the final
  // position the user was looking at before pressing Analyze.
  React.useEffect(() => {
    if (prevAnalyzingRef.current && !analyzing) {
      const fresh = useGameStore.getState();
      const finished = fresh.analysisProgress >= 100;
      if (finished) {
        rewindArmedRef.current = false;
        if (fresh.currentMoveIndex !== -1) {
          setCurrentMoveIndex(-1);
        }
      } else if (rewindArmedRef.current) {
        rewindArmedRef.current = false;
        const target = Math.max(-1, (fresh.selectedGame?.moves.length || 0) - 1);
        if (fresh.currentMoveIndex !== target) {
          setCurrentMoveIndex(target);
        }
      }
    }
    prevAnalyzingRef.current = analyzing;
  }, [analyzing, setCurrentMoveIndex]);

  // POST-GAME FLOW — AUTO-START. Arriving via /game/:id?post=1 guarantees an
  // analysis runs: if the import already kicked one off (autoAnalyzeGame),
  // triggerEvaluationPipeline joins its pending promise and surfaces the same
  // analyzing/progress tracking as the Analyze button; otherwise it starts fresh.
  // The store's own guards (analyzing/hypothesisActive) make StrictMode re-runs
  // and repeated kicks no-ops, and this path skips the cache, so it always runs
  // from scratch like the import flow.
  React.useEffect(() => {
    if (!isPostFlow) return;
    const state = useGameStore.getState();
    if (!state.selectedGame || state.selectedGame.moves.length === 0) return;
    if (state.analyzing || state.hypothesisActive) return;
    void triggerEvaluationPipeline();
  }, [isPostFlow, triggerEvaluationPipeline, selectedGame?.id]);

  // POST-GAME FLOW — PANEL REVEAL. When the analysis completes (analyzing
  // true→false and progress reached 100) while post=1 is present, show the
  // match-finished options. Dismissing or re-analyzing consumes the panel for
  // the rest of the visit, so a later run can never bring it back.
  React.useEffect(() => {
    if (prevPostAnalyzingRef.current && !analyzing) {
      if (isPostFlow && !postPanelConsumedRef.current) {
        const fresh = useGameStore.getState();
        if (fresh.analysisProgress >= 100) {
          setPostPanelVisible(true);
        }
      }
    }
    prevPostAnalyzingRef.current = analyzing;
  }, [analyzing, isPostFlow]);

  // POST-GAME FLOW — ACTIONS. Dismissal and Re-analyze both consume the panel;
  // Play new match heads back to the tools page for the next game.
  const dismissPostPanel = React.useCallback(() => {
    postPanelConsumedRef.current = true;
    setPostPanelVisible(false);
  }, []);

  const handlePostReanalyze = React.useCallback(() => {
    postPanelConsumedRef.current = true;
    setPostPanelVisible(false);
    const depth = postStrength === 'weaker' ? 8 : postStrength === 'stronger' ? 18 : 15;
    void triggerEvaluationPipeline(depth);
  }, [postStrength, triggerEvaluationPipeline]);

  const handlePlayNewMatch = React.useCallback(() => {
    navigate('/tools');
  }, [navigate]);

  const toggleOrientation = React.useCallback(() => {
    updateSettings({ boardOrientation: settings.boardOrientation === 'white' ? 'black' : 'white' });
  }, [settings.boardOrientation, updateSettings]);

  React.useEffect(() => {
    if (!autoplay || !selectedGame) return;
    const interval = setInterval(() => {
      const current = useGameStore.getState().currentMoveIndex;
      const next = current + 1;
      if (next >= selectedGame.moves.length) {
        setAutoplay(false);
      } else {
        setCurrentMoveIndex(next);
      }
    }, 1000);
    return () => { clearInterval(interval); };
  }, [autoplay, selectedGame]);

  const refreshFavorites = React.useCallback(() => {
    if (!authUser || (authUser.authProvider !== 'google' && authUser.authProvider !== 'anonymous')) {
      setSavedGameIds(new Set());
      setFavoriteGames([]);
      return;
    }
    import('../lib/firebase').then(({ fetchUserFavorites }) => {
      fetchUserFavorites(authUser.id).then(games => {
        const favs = (games as SavedGame[]).filter(g => g.userSaved === true);
        setSavedGameIds(new Set(favs.map(g => g.id)));
        setFavoriteGames(favs);
      });
    });
  }, [authUser?.id, authUser?.authProvider]);

  const handleSaveGame = React.useCallback(() => {
    if (!selectedGame || !authUser || (authUser.authProvider !== 'google' && authUser.authProvider !== 'anonymous')) return;
    const gameId = selectedGame.id;
    const isSaved = savedGameIds.has(gameId);
    const revert = () => {
      // Undo the optimistic flip so the button reflects reality again.
      setSavedGameIds(prev => {
        const next = new Set(prev);
        if (isSaved) next.add(gameId); else next.delete(gameId);
        return next;
      });
      useToastStore.getState().addToast({
        type: 'error',
        message: isSaved ? 'Could not remove from favorites' : 'Could not save to favorites',
      });
    };
    // Optimistic: flip the button color instantly and persist in the background.
    // refreshFavorites() only refreshes the list — it never gates the button UI.
    setSavedGameIds(prev => {
      const next = new Set(prev);
      if (isSaved) next.delete(gameId); else next.add(gameId);
      return next;
    });
    useToastStore.getState().addToast({ type: 'success', message: isSaved ? 'Removed from favorites' : 'Added to favorites' });
    import('../lib/firebase').then(({ saveUserGame, deleteUserGame }) => {
      const gameForFirestore = {
        ...selectedGame,
        moves: JSON.parse(JSON.stringify(selectedGame.moves)),
        userSaved: true,
      };
      const op = isSaved
        ? deleteUserGame(authUser.id, gameId)
        : saveUserGame(authUser.id, gameId, gameForFirestore);
      return op
        .then(() => { refreshFavorites(); })
        .catch(() => { revert(); });
    }).catch(() => { revert(); });
  }, [selectedGame, authUser, savedGameIds, refreshFavorites]);

  React.useEffect(() => {
    if (!authUser || (authUser.authProvider !== 'google' && authUser.authProvider !== 'anonymous')) {
      setSavedGameIds(new Set());
      setFavoriteGames([]);
      return;
    }
    let cancelled = false;
    import('../lib/firebase').then(({ fetchUserFavorites }) => {
      fetchUserFavorites(authUser.id).then(games => {
        if (cancelled) return;
        const favs = (games as SavedGame[]).filter((g: any) => g.userSaved);
        setSavedGameIds(new Set(favs.map(g => g.id)));
        setFavoriteGames(favs);
      });
    });
    return () => { cancelled = true; };
  }, [authUser?.id, authUser?.authProvider]);

  React.useEffect(() => {
    if (!selectedGame || !selectedGame.pgn) {
      setPriorAnalyses([]);
      return;
    }
    let cancelled = false;
    getPriorAnalyses(selectedGame.pgn)
      .then(list => { if (!cancelled) setPriorAnalyses(list); })
      .catch(() => { if (!cancelled) setPriorAnalyses([]); });
    return () => { cancelled = true; };
  }, [selectedGame?.id]);

  React.useEffect(() => {
    const cb = () => { setShowShortcuts(true); };
    window.addEventListener('open-shortcuts', cb);
    return () => { window.removeEventListener('open-shortcuts', cb); };
  }, []);

  useKeyboardShortcuts([
    {
      key: 'f',
      description: 'Flip board',
      handler: () => { toggleOrientation(); },
    },
    {
      key: 'a',
      description: 'Analyze game',
      handler: () => { handleAnalyzePress(); },
    },
    {
      key: 'ArrowRight',
      description: 'Next move',
      handler: () => {
        if (hypothesisActive) {
          // Step the what-if line toward the tip (from the base position at -1).
          if (hypothesisMoves.length > 0) setHypViewIndex(prev => Math.min(prev + 1, hypothesisMoves.length - 1));
          return;
        }
        if (selectedGame) setCurrentMoveIndex(currentMoveIndex + 1);
      },
    },
    {
      key: 'ArrowLeft',
      description: 'Previous move',
      handler: () => {
        if (hypothesisActive) {
          // Step the what-if line back toward the base position; -1 stays put.
          if (hypothesisMoves.length > 0) setHypViewIndex(prev => Math.max(prev - 1, -1));
          return;
        }
        if (selectedGame) setCurrentMoveIndex(currentMoveIndex - 1);
      },
    },
    {
      key: 'Home',
      description: 'First move',
      handler: () => { setCurrentMoveIndex(-1); },
    },
    {
      key: 'End',
      description: 'Last move',
      handler: () => {
        if (selectedGame) setCurrentMoveIndex(selectedGame.moves.length - 1);
      },
    },
    {
      key: '?',
      description: 'Show keyboard shortcuts',
      handler: () => { setShowShortcuts(true); },
    },
    {
      key: 'z',
      description: 'Toggle focus mode',
      handler: () => { toggleFocusMode(); },
    },
    {
      key: 'F11',
      description: 'Toggle fullscreen',
      handler: () => toggleFullscreen(),
    },
    {
      key: ' ',
      description: 'Play/Pause autoplay',
      handler: () => {
        if (selectedGame) setAutoplay(!autoplay);
      },
    },
    {
      key: 'Backspace',
      description: 'Undo what-if move',
      handler: () => {
        if (hypothesisActive && hypothesisMoves.length) undoHypothesisMove();
      },
    },
    {
      key: 'Escape',
      description: 'Exit what-if mode',
      handler: () => {
        if (hypothesisActive) exitHypothesisMode();
      },
    },
  ]);

  const handleChessComSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidUsername(usernameInput.trim())) {
      useToastStore.getState().addToast({ type: 'error', message: 'Invalid username. Use 1-30 alphanumeric characters, underscores, or hyphens.' });
      return;
    }
    importChessComGames(usernameInput.trim());
    setShowGameList(true);
  };

  const handleLichessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidUsername(usernameInput.trim())) {
      useToastStore.getState().addToast({ type: 'error', message: 'Invalid username. Use 1-30 alphanumeric characters, underscores, or hyphens.' });
      return;
    }
    importLichessGames(usernameInput.trim());
    setShowGameList(true);
  };

  const handlePgnImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPgn(pgnInput.trim())) {
      useToastStore.getState().addToast({ type: 'error', message: 'Invalid PGN. Make sure it contains valid chess moves.' });
      return;
    }
    importPgnDirectly(pgnInput.trim());
    setPgnInput('');
  };

  const handleBackToStart = () => { setCurrentMoveIndex(-1); };
  const handlePrevMove = () => { setCurrentMoveIndex(currentMoveIndex - 1); };
  const handleNextMove = () => { setCurrentMoveIndex(currentMoveIndex + 1); };
  const handleEndMove = () => { setCurrentMoveIndex((selectedGame?.moves.length || 0) - 1); };

  // Shared entry point for the Analyze button and the 'a' shortcut. When the board
  // shows the final position the rewind is armed, so the pieces step back in time
  // with the engine's progress; otherwise the run proceeds without touching the
  // board (mid-game analysis). Autoplay is stopped when armed so its 1s ticker
  // can't fight the rewind loop for the board position.
  const handleAnalyzePress = React.useCallback(() => {
    const fresh = useGameStore.getState();
    const game = fresh.selectedGame;
    if (!game || game.moves.length === 0 || fresh.analyzing) return;
    // In Regular, analyzing while exploring a deviation would be refused by the
    // pipeline guard anyway — exit cleanly first so the run proceeds normally.
    if (fresh.hypothesisActive) exitHypothesisMode();
    rewindArmedRef.current = fresh.currentMoveIndex === game.moves.length - 1;
    if (rewindArmedRef.current) setAutoplay(false);
    triggerEvaluationPipeline(settings.engineDepth);
  }, [settings.engineDepth, triggerEvaluationPipeline, setAutoplay, exitHypothesisMode]);

  // Replay the engine's recommendation for a flagged move: jump to the position
  // before it, enter what-if mode, and play the engine's best move there so the
  // user sees the better line side by side with what they actually played.
  const handleTryCoachMove = async (note: CoachNote) => {
    if (!selectedGame) return;
    if (hypothesisActive) exitHypothesisMode();
    setCurrentMoveIndex(note.moveIndex - 1);
    enterHypothesisMode();
    // Zustand set is synchronous, so the store now holds the new base position.
    // Read it back fresh instead of relying on stale render-closure values.
    const fresh = useGameStore.getState();
    const baseFen = fresh.hypothesisMoves.length > 0
      ? fresh.hypothesisMoves[fresh.hypothesisMoves.length - 1].fen
      : fresh.hypothesisBaseIndex >= 0 && fresh.selectedGame?.moves[fresh.hypothesisBaseIndex]
        ? fresh.selectedGame.moves[fresh.hypothesisBaseIndex].fen
        : STARTING_FEN;
    try {
      const Chess = (await import('chess.js')).Chess;
      const board = new Chess(baseFen);
      const mv = board.moves({ verbose: true }).find(m => m.san === note.bestSan);
      // Guard: if the engine move isn't legal here (e.g. the user is viewing a
      // different position than the one the note was built from), do nothing.
      if (mv) {
        playHypothesisMove(mv.from, mv.to);
      }
    } catch {
      // Invalid FEN or engine move — ignore silently.
    }
  };

  const handleBackToImport = () => {
    selectGame('');
    setNotificationDismissed(false);
    navigate('/', { replace: true });
  };

  const handleSelectGame = (gameId: string) => {
    selectGame(gameId);
    let game = useGameStore.getState().games.find(g => g.id === gameId);
    if (!game?.shortId) {
      const shortId = shortIdFromKey(gameId);
      useGameStore.setState(s => ({
        games: s.games.map(g => g.id === gameId ? { ...g, shortId } : g),
        selectedGame: s.selectedGame?.id === gameId ? { ...s.selectedGame, shortId } : s.selectedGame,
      }));
      game = { ...game!, shortId };
      navigate(`/game/${shortId}`, { replace: true });
      const uid = useAuthStore.getState().user?.id;
      if (uid) {
        import('../lib/firebase').then(({ saveUserGame }) => {
          saveUserGame(uid, game!.id, { ...game!, shortId });
        }).catch(() => { /* fire-and-forget: the games list is the source of truth */ });
      }
    } else {
      navigate(`/game/${game.shortId}`, { replace: true });
    }
  };

  // The hypothesis move whose position the board shows while in what-if mode:
  // -1 = the base position, otherwise an index into hypothesisMoves. Clamped to
  // the live line so a stale hypViewIndex can never index out of bounds.
  const effHypViewIndex = hypothesisActive && hypothesisMoves.length > 0
    ? (hypViewIndex >= 0 ? Math.min(hypViewIndex, hypothesisMoves.length - 1) : -1)
    : -1;

  const getCurrentFen = () => {
    if (hypothesisActive) {
      if (effHypViewIndex >= 0) return hypothesisMoves[effHypViewIndex].fen;
      // Base position of the what-if line.
      if (selectedGame && hypothesisBaseIndex >= 0 && selectedGame.moves[hypothesisBaseIndex]) {
        return selectedGame.moves[hypothesisBaseIndex].fen;
      }
      return STARTING_FEN;
    }
    if (!selectedGame || currentMoveIndex === -1) {
      return STARTING_FEN;
    }
    return selectedGame.moves[currentMoveIndex]?.fen || STARTING_FEN;
  };

  const getMoveHighlight = () => {
    if (hypothesisActive) {
      // Highlight the move that produced the displayed position. Its
      // classification rides along so the Chessboard draws the symbol over the
      // destination square (undefined → plain from/to highlight, no badge).
      if (effHypViewIndex >= 0) {
        const m = hypothesisMoves[effHypViewIndex];
        return { from: m.from, to: m.to, classification: m.classification };
      }
      return undefined;
    }
    if (!selectedGame || currentMoveIndex === -1) return undefined;
    const m = selectedGame.moves[currentMoveIndex];
    return { from: m.from, to: m.to, classification: m.classification };
  };

  const getBestMoveArrow = () => {
    if (hypothesisActive) {
      // The arrow reflects the viewed position: every hypothesis move carries
      // its own engine lines (analyzed when it was the tip). Before that search
      // finishes there are none, so a stale arrow from the previous position is
      // never shown on an unanalyzed position.
      if (effHypViewIndex >= 0) {
        const viewLines = hypothesisMoves[effHypViewIndex].engineLines;
        if (viewLines?.length) {
          const topLine = getTopEngineLine(viewLines);
          if (topLine?.moves?.length) {
            const uci = topLine.moves[0].uci;
            if (uci.length >= 4) return { from: uci.slice(0, 2), to: uci.slice(2, 4) };
          }
        }
      }
      return undefined;
    }
    if (!selectedGame || currentMoveIndex === -1) return undefined;
    const m = selectedGame.moves[currentMoveIndex];
    if (!m.engineLines || m.engineLines.length === 0) return undefined;
    const topLine = getTopEngineLine(m.engineLines);
    if (!topLine?.moves.length) return undefined;
    const uci = topLine.moves[0].uci;
    if (uci.length < 4) return undefined;
    return { from: uci.slice(0, 2), to: uci.slice(2, 4) };
  };

  function checkLegendaryStatus() {
    if (!selectedGame || analyzing || analysisProgress < 100) return null;
    const accuracy = selectedGame.accuracy;
    const classificationCounts = selectedGame.classificationCounts;
    if (!accuracy || !classificationCounts) return null;
    const hasBrilliant =
      (classificationCounts.white?.brilliant || 0) > 0 ||
      (classificationCounts.black?.brilliant || 0) > 0;
    const hasHighAccuracy = (accuracy.white > 90) || (accuracy.black > 90);
    if (hasBrilliant || hasHighAccuracy) {
      return {
        hasBrilliant,
        hasHighAccuracy,
        whiteAcc: accuracy.white,
        blackAcc: accuracy.black,
        brilliantsWhite: classificationCounts.white?.brilliant || 0,
        brilliantsBlack: classificationCounts.black?.brilliant || 0,
      };
    }
    return null;
  }

  if (!isInAnalysis) {
    // Games matching the active import tab, newest first, capped at 3.
    const recentGames = getRecentGames(games, importMode, 3);
    const platformLabel = importMode === 'chesscom' ? 'Chess.com' : importMode === 'lichess' ? 'Lichess' : 'PGN';
    const handleClearHistory = (): void => {
      if (window.confirm('Clear all match history?')) {
        clearGames();
      }
    };
    return (
      <div className="max-w-2xl mx-auto space-y-6" id="analysis-import-view">

        {urlGameNotFound && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-2xl p-6 text-center space-y-2 relative">
            <button
              onClick={() => { setUrlGameNotFound(false); }}
              className="absolute top-3 right-3 text-red-400 hover:text-white text-xl leading-none w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-700/30"
              aria-label="Dismiss error"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
            <AlertTriangle className="w-8 h-8 mx-auto text-red-400" />
            <h2 className="text-lg font-bold text-white">Game Not Found</h2>
            <p className="text-sm text-red-200">
              This game hasn't been saved yet. The analysis may still be in progress on the original browser, or the game was shared before saving completed.
            </p>
            <p className="text-xs text-red-300 mt-2">
              Try again in a few seconds, or import the game below.
            </p>
          </div>
        )}

        <div className="text-center space-y-2 mb-2">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Analyze a Chess Game
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Import from Chess.com or paste a PGN to start analyzing with Stockfish 18 Lite.
          </p>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6" id="analysis-settings-card">
          <div className="flex border-b border-[var(--color-border)] mb-4 overflow-x-auto">
            <button
              onClick={() => { setImportMode('chesscom'); }}
              className={`pb-3 px-2.5 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap flex-shrink-0 ${
                importMode === 'chesscom'
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-text-muted)]'
              }`}
            >
              <img src="/img/icons/chesscom.svg" alt="" className="w-5 h-5 inline mr-1" />
              Chess.com Username
            </button>
            <button
              onClick={() => { setImportMode('lichess'); }}
              className={`pb-3 px-2.5 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap flex-shrink-0 ${
                importMode === 'lichess'
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-text-muted)]'
              }`}
            >
              <img src="/img/icons/lichess.svg" alt="" className="w-5 h-5 inline mr-1" />
              Lichess Username
            </button>
            <button
              onClick={() => { setImportMode('pgn'); }}
              className={`pb-3 px-2.5 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap flex-shrink-0 ${
                importMode === 'pgn'
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-text-muted)]'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-1" />
              Paste PGN
            </button>
          </div>

          {importMode === 'chesscom' || importMode === 'lichess' ? (
            <form onSubmit={importMode === 'lichess' ? handleLichessSubmit : handleChessComSubmit} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => { setUsernameInput(e.target.value); }}
                placeholder={importMode === 'lichess' ? 'e.g. DrNykterstein' : 'e.g. Hikaru'}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm text-white placeholder-[var(--color-text-muted)] flex-1 min-w-0"
                id="chesscom-user-input"
              />
              <button
                type="submit"
                disabled={loadingGames}
                className="bg-[var(--color-primary)] text-white text-sm px-5 py-2.5 rounded-lg font-bold disabled:opacity-50 flex-shrink-0"
                id="api-fetch-submit"
              >
                {loadingGames ? 'Searching...' : 'Fetch Games'}
              </button>
            </form>
          ) : (
            <form onSubmit={handlePgnImportSubmit} className="flex flex-col gap-2">
              <textarea
                value={pgnInput}
                onChange={(e) => { setPgnInput(e.target.value); }}
                placeholder="Paste PGN here..."
                rows={3}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3 text-xs font-mono text-white placeholder-[var(--color-text-muted)]"
                id="pgn-textarea-input"
              />
              <button
                type="submit"
                className="bg-[var(--color-primary)] text-white font-bold text-sm py-2.5 rounded-lg self-end px-6"
                id="pgn-import-submit"
              >
                Analyze PGN
              </button>
            </form>
          )}

          {importError && (
            <div className="flex items-center space-x-2 text-xs bg-[var(--color-surface)] text-[var(--color-accent)] p-2.5 rounded-lg mt-3" id="import-error-banner">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{importError}</span>
            </div>
          )}
        </div>

        {showGameList && loadingGames && games.length === 0 && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5" id="games-archive-card-loading">
            <div className="h-4 w-32 bg-[var(--color-border)] rounded animate-pulse mb-4" />
            <SkeletonGameGrid count={6} />
          </div>
        )}
        {(showGameList || games.length > 0) && !loadingGames && games.length > 0 && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5" id="games-archive-card">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-[var(--color-accent)]" />
              <span>Recent Games ({recentGames.length})</span>
              <button
                onClick={handleClearHistory}
                className="ml-auto text-[11px] font-bold text-[var(--color-primary)] border border-[var(--color-primary)] px-3 py-1 rounded-lg disabled:opacity-50"
              >
                Clear History
              </button>
            </h3>
            {recentGames.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 {recentGames.map((g) => {
                    const isSel = selectedGame?.id === g.id;
                  const isAnalyzed = !!analysisCache[g.id]?.analyzedAt || !!analyzedPgnHashes[hashPgn(g.pgn)];
                  let borderClass = 'border-[var(--color-border)]';
                  if (isSel) borderClass = 'border-[var(--color-primary)]';
                  else if (isAnalyzed) borderClass = 'border-green-600';
                  return (
                    <button
                      key={g.id}
                      onClick={() => { handleSelectGame(g.id); }}
                      className={`text-left p-4 rounded-xl border flex flex-col justify-between min-h-[136px] bg-[var(--color-surface)] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/25 transition-all ${borderClass}`}
                      id={`game-selector-${g.id}`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-[var(--color-text-muted)] font-semibold truncate">{g.date}</span>
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-white shrink-0">{g.result}</span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <PlayerAvatar name={g.white.username} avatar={g.white.avatar} size={22} />
                            <span className="text-xs font-bold text-white truncate">{g.white.username}</span>
                          </div>
                          <div className="flex items-center gap-2 min-w-0">
                            <PlayerAvatar name={g.black.username} avatar={g.black.avatar} size={22} />
                            <span className="text-xs font-bold text-white truncate">{g.black.username}</span>
                          </div>
                        </div>
                        <div className="text-[10px] text-[var(--color-text-muted)] font-medium pt-0.5">
                          {g.white.rating && `White: ${g.white.rating}`}{g.white.rating && g.black.rating && ' | '}{g.black.rating && `Black: ${g.black.rating}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-start mt-2">
                        {isAnalyzed && (
                          <span className="text-[10px] font-bold text-green-500">&#x2713; Analyzed{formatDuration(analysisCache[g.id]?.analysisDurationMs) && ` (${formatDuration(analysisCache[g.id]?.analysisDurationMs)})`}</span>
                        )}
                        {savedGameIds.has(g.id) && (
                          <Heart className="w-3 h-3 text-[var(--color-accent)] fill-current ml-auto" />
                        )}
                      </div>
                    </button>
                  );
               })}
            </div>
            ) : (
              <p className="text-xs text-[var(--color-text-muted)] italic py-4 text-center">
                No {platformLabel} matches yet — fetch your games above.
              </p>
            )}
          </div>
        )}

        {(authUser?.chessComUsername || authUser?.lichessUsername) && linkedLoading && linkedGames.length === 0 && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5">
            <div className="h-4 w-40 bg-[var(--color-border)] rounded animate-pulse mb-4" />
            <SkeletonGameGrid count={3} />
          </div>
        )}
        {(authUser?.chessComUsername || authUser?.lichessUsername) && !linkedLoading && linkedGames.length > 0 && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-[var(--color-accent)]" />
                <span>
                  {authUser?.chessComUsername && authUser?.lichessUsername
                    ? 'Linked Recent Games'
                    : authUser?.lichessUsername
                      ? `${authUser.lichessUsername}&apos;s Recent Games`
                      : `${authUser?.chessComUsername}&apos;s Recent Games`}
                </span>
              </h3>
              <button
                onClick={fetchLinkedUserGames}
                disabled={linkedLoading}
                className="text-[11px] font-bold text-[var(--color-primary)] border border-[var(--color-primary)] px-3 py-1 rounded-lg disabled:opacity-50"
              >
                {linkedLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            {linkedAnalyzing && linkedAnalysisProgress && (
              <div className="text-[11px] text-[var(--color-accent)] font-semibold mb-3">
                {linkedAnalysisProgress}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {getRecentGames(linkedGames, 'all', 3).map((g) => {
                const isAnalyzed = !!analysisCache[g.id]?.analyzedAt || !!analyzedPgnHashes[hashPgn(g.pgn)];
                return (
                  <button
                    key={g.id}
                    onClick={() => { handleSelectGame(g.id); }}
                    className={`text-left p-4 rounded-xl border flex flex-col justify-between min-h-[136px] bg-[var(--color-surface)] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/25 transition-all ${
                      isAnalyzed ? 'border-green-600' : 'border-[var(--color-border)]'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-[var(--color-text-muted)] font-semibold truncate">{g.date}</span>
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-white shrink-0">{g.result}</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <PlayerAvatar name={g.white.username} avatar={g.white.avatar} size={22} />
                          <span className="text-xs font-bold text-white truncate">{g.white.username}</span>
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <PlayerAvatar name={g.black.username} avatar={g.black.avatar} size={22} />
                          <span className="text-xs font-bold text-white truncate">{g.black.username}</span>
                        </div>
                      </div>
                      <div className="text-[10px] text-[var(--color-text-muted)] font-medium pt-0.5">
                        {g.white.rating && `White: ${g.white.rating}`}{g.white.rating && g.black.rating && ' | '}{g.black.rating && `Black: ${g.black.rating}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-start mt-2">
                      {isAnalyzed && (
                        <span className="text-[10px] font-bold text-green-500">&#x2713; Analyzed{formatDuration(analysisCache[g.id]?.analysisDurationMs) && ` (${formatDuration(analysisCache[g.id]?.analysisDurationMs)})`}</span>
                      )}
                      {savedGameIds.has(g.id) && (
                        <Heart className="w-3 h-3 text-[var(--color-accent)] fill-current ml-auto" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  const pad = 16;
  // On phones give the board the full available width; the eval bar moves below it.
  const desiredW = focusMode ? 720 : fullscreenMode ? 700 : vpW < 640 ? vpW - pad : 600;
  const boardWidth = Math.min(desiredW, vpW - pad);

  const isLastMove = selectedGame ? currentMoveIndex >= selectedGame.moves.length - 1 : false;

  // Rewind window: while the engine is running (and not in what-if mode) the
  // nav buttons are locked so the stepping loop and the user can't fight over
  // the position. Mirrors how hypothesisActive locks the same buttons.
  const rewindActive = analyzing && !hypothesisActive && analysisProgress >= 1 && analysisProgress <= 95;
  const navLocked = rewindActive && rewindArmedRef.current;

  // Face the account holder / analyst: when they're one of the two players, their
  // side is shown at the bottom. When their name isn't linked to the game, keep
  // the user's boardOrientation setting (no automatic change).
  const boardOrientation = (() => {
    const holders = [authUser?.chessComUsername, authUser?.username].filter(Boolean);
    if (!holders.length || !selectedGame) return settings.boardOrientation;
    const norm = (s: string) => (s || '').trim().toLowerCase();
    const base = (s: string) => norm(s).split(/[_-]/)[0];
    const matches = (name: string) => {
      const n = norm(name);
      if (n.length < 3) return false;
      const b = base(name);
      return holders.some(h => {
        const hn = norm(h);
        if (hn.length < 3) return false;
        return hn === n || hn === b || base(h) === n || base(h) === b;
      });
    };
    if (matches(selectedGame.white?.username ?? '')) return 'white';
    if (matches(selectedGame.black?.username ?? '')) return 'black';
    return settings.boardOrientation;
  })();
  let winnerSide: 'w' | 'b' | undefined;
  let checkmateSide: 'w' | 'b' | undefined;
  if (selectedGame && isLastMove) {
    if (selectedGame.result === '1-0') { winnerSide = 'w'; checkmateSide = 'b'; }
    else if (selectedGame.result === '0-1') { winnerSide = 'b'; checkmateSide = 'w'; }
  }
  const isCheckmate = checkmateSide ? (() => {
    try { return new Chess(getCurrentFen()).isCheckmate(); } catch { return false; }
  })() : false;

  const boardEl = (
    <Chessboard
      // Force a clean remount when toggling hypothesis mode so the internal
      // piece map resets — without this, react-chessboard can confuse pieces
      // across unrelated fen jumps (entering/exiting what-if) and leave them
      // at opacity 0 mid-slide.
      key={hypothesisActive ? `hyp-${hypothesisBaseIndex}` : undefined}
      fen={getCurrentFen()}
      playable={analysisMode === 'regular'
        ? !!selectedGame && !(analyzing && rewindArmedRef.current)
        : hypothesisActive}
      premoveEnabled={false}
      onMove={(from, to) => {
        // Advanced: the what-if flow is gone, so the board is read-only there.
        if (analysisMode === 'advanced') return false;
        const fresh = useGameStore.getState();
        // Already exploring a deviation → keep extending that line.
        if (fresh.hypothesisActive) {
          const ok = playHypothesisMove(from, to);
          if (ok) {
            const moves = useGameStore.getState().hypothesisMoves;
            if (moves.length > 0) playFromSan(moves[moves.length - 1].san);
          }
          return ok;
        }
        const game = fresh.selectedGame;
        if (!game) return false;
        // On the real game line: if the dragged move IS the game's next ply it's
        // plain navigation — advance the index, no hypothesis, no analysis.
        const idx = fresh.currentMoveIndex;
        const nextReal = game.moves[idx + 1];
        if (nextReal && nextReal.from === from && nextReal.to === to) {
          setCurrentMoveIndex(idx + 1);
          return true;
        }
        // Deviation → silently start exploring this position. The store refuses
        // while a main analysis is running, so during a run only real-line moves
        // are accepted.
        if (!fresh.analyzing) {
          enterHypothesisMode();
          const ok = playHypothesisMove(from, to);
          if (ok) {
            const moves = useGameStore.getState().hypothesisMoves;
            if (moves.length > 0) playFromSan(moves[moves.length - 1].san);
          }
          return ok;
        }
        return false;
      }}
      orientation={boardOrientation}
      highlightSquares={getMoveHighlight()}
      bestMoveArrow={getBestMoveArrow()}
      rightClickedSquares={rightClickedSquares}
      onSquareRightClick={(sq) => {
        setRightClickedSquares(prev =>
          prev.includes(sq) ? [] : [...prev, sq]
        );
      }}
      onLeftClick={() => { setRightClickedSquares([]); }}
      winnerOverlay={isCheckmate && !!winnerSide}
      winnerSide={winnerSide}
      checkmateOverlay={isCheckmate && !!checkmateSide}
      checkmateSide={checkmateSide}
      animationDurationInMs={vpW < 640 ? 450 : 300}
    />
  );

  const evalScore = currentMove?.evaluation?.score ?? null;
  const evalMate = currentMove?.evaluation?.mateIn ?? null;

  const hypothesisEvalScore = hypothesisActive && hypothesisLines?.length
    ? (() => {
        const topLine = getTopEngineLine(hypothesisLines);
        if (!topLine?.evaluation) return null;
        if (topLine.evaluation.type === 'mate') return null;
        return topLine.evaluation.value / 100;
      })()
    : null;
  const hypothesisEvalMate = hypothesisActive && hypothesisLines?.length
    ? (() => {
        const topLine = getTopEngineLine(hypothesisLines);
        if (!topLine?.evaluation) return null;
        if (topLine.evaluation.type === 'mate') return topLine.evaluation.value;
        return null;
      })()
    : null;

  // While stepping the what-if line, the eval bar mirrors the position on the
  // board: each hypothesis move was analyzed with its own evaluation when it was
  // the tip. The base view shows the main-game eval of the base move, and the
  // tip keeps the shared hypothesisLines eval so the bar stays live during a
  // re-search instead of blinking to neutral.
  const isHypStepView = hypothesisActive && effHypViewIndex >= 0 && effHypViewIndex < hypothesisMoves.length - 1;
  const isHypBaseView = hypothesisActive && hypothesisMoves.length > 0 && effHypViewIndex === -1;
  const hypStepEval = isHypStepView ? hypothesisMoves[effHypViewIndex].evaluation : null;
  const hypStepEvalScore = hypStepEval && !hypStepEval.isMate ? hypStepEval.score : null;
  const hypStepEvalMate = hypStepEval && hypStepEval.isMate ? hypStepEval.mateIn ?? 0 : null;

  const displayScore = isHypStepView
    ? hypStepEvalScore
    : isHypBaseView
      ? evalScore
      : (hypothesisActive && hypothesisMoves.length > 0 && hypothesisLines?.length ? hypothesisEvalScore : evalScore);
  const displayMate = isHypStepView
    ? hypStepEvalMate
    : isHypBaseView
      ? evalMate
      : (hypothesisActive && hypothesisMoves.length > 0 && hypothesisLines?.length ? hypothesisEvalMate : evalMate);

  // Chess.com-style player bars: the bar above the board shows whoever sits at
  // the top (black when unflipped), the bar below shows the bottom side.
  const topPlayer = boardOrientation === 'white' ? selectedGame.black : selectedGame.white;
  const topSide: 'w' | 'b' = boardOrientation === 'white' ? 'b' : 'w';
  const bottomPlayer = boardOrientation === 'white' ? selectedGame.white : selectedGame.black;
  const bottomSide: 'w' | 'b' = boardOrientation === 'white' ? 'w' : 'b';

  // Navigation console — board controls. Rendered below the board in Advanced
  // and below the move log in Regular (defined once, placed twice). The favorite
  // heart here is Advanced-only; Regular keeps a single heart in the utility row.
  const navConsole = (
    <div className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl" id="game-controls-console" style={{ maxWidth: boardWidth }}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 sm:px-3 py-2">
        <div className="flex items-center space-x-1">
          <button onClick={handleBackToStart} disabled={currentMoveIndex === -1 || hypothesisActive || navLocked} className="p-2 bg-[var(--color-surface)] text-[var(--color-text-muted)] rounded-lg disabled:opacity-30" title="First Move" aria-label="Go to first move">
            <ChevronsLeft className="w-5 h-5" />
          </button>
          <button onClick={handlePrevMove} disabled={currentMoveIndex === -1 || hypothesisActive || navLocked} className="p-2 bg-[var(--color-surface)] text-[var(--color-text-muted)] rounded-lg disabled:opacity-30" title="Previous Move" aria-label="Go to previous move">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => { setAutoplay(!autoplay); }}
            disabled={currentMoveIndex === selectedGame.moves.length - 1 || hypothesisActive || navLocked}
            className={`p-1.5 ${autoplay ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}
            title={autoplay ? 'Pause (Space)' : 'Play (Space)'}
            aria-label={autoplay ? 'Pause autoplay' : 'Start autoplay'}
          >
            {autoplay ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          <button onClick={handleNextMove} disabled={currentMoveIndex === selectedGame.moves.length - 1 || hypothesisActive || navLocked} className="p-2 bg-[var(--color-surface)] text-[var(--color-text-muted)] rounded-lg disabled:opacity-30" title="Next Move" aria-label="Go to next move">
            <ChevronRight className="w-5 h-5" />
          </button>
          <button onClick={handleEndMove} disabled={currentMoveIndex === selectedGame.moves.length - 1 || hypothesisActive || navLocked} className="p-2 bg-[var(--color-surface)] text-[var(--color-text-muted)] rounded-lg disabled:opacity-30" title="Last Move" aria-label="Go to last move">
            <ChevronsRight className="w-5 h-5" />
          </button>
        </div>
        <span className="text-xs text-[var(--color-text-muted)] font-mono font-bold uppercase tracking-wider" id="nav-move-indicator">
          {currentMoveIndex + 1}/{selectedGame.moves.length}
        </span>
        <div className="flex items-center gap-1 flex-wrap">
          {analysisMode === 'advanced' && authUser && (authUser.authProvider === 'google' || authUser.authProvider === 'anonymous') && (
            <button
              onClick={handleSaveGame}
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                savedGameIds.has(selectedGame.id)
                  ? 'bg-[var(--color-accent)] text-black border border-[var(--color-accent)]'
                  : 'bg-[var(--color-surface)] border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-black'
              }`}
              title={savedGameIds.has(selectedGame.id) ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart className={`w-3.5 h-3.5 ${savedGameIds.has(selectedGame.id) ? 'fill-current' : ''}`} />
              <span className="hidden xs:inline">{savedGameIds.has(selectedGame.id) ? 'Favorited' : 'Favorite'}</span>
            </button>
          )}
          <button
            onClick={() => {
              const blob = new Blob([selectedGame.pgn], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${selectedGame.white.username}-vs-${selectedGame.black.username}.pgn`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[11px] text-[var(--color-text-muted)] hover:text-white"
            title="Download PGN"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">PGN</span>
          </button>
          <button
            onClick={() => { setShowShare(true); }}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[11px] text-[var(--color-text-muted)] hover:text-white"
            title="Share game"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Share</span>
          </button>
        </div>
      </div>
    </div>
  );

  // Utility strip — Flip / Shortcuts / Focus / Fullscreen. In Regular this is the
  // home of the single favorite heart (Advanced keeps its heart in the console).
  const utilityRow = (
    <div className="w-full flex items-center gap-1.5 sm:gap-2 flex-wrap" style={{ maxWidth: boardWidth }}>
      <button
        onClick={toggleOrientation}
        className="flex items-center gap-1 sm:gap-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] px-2.5 sm:px-3 py-2 rounded-lg text-xs text-[var(--color-text-muted)]"
        title="Flip board (F)"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span className="hidden xs:inline">Flip</span>
      </button>
      <div className="flex-1" />
      {vpW >= 1024 && (
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('open-shortcuts'))}
        className="flex items-center gap-1 sm:gap-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] px-2.5 sm:px-3 py-2 rounded-lg text-xs text-[var(--color-text-muted)]"
        title="Keyboard shortcuts (?)"
      >
        <Keyboard className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Shortcuts</span>
      </button>
      )}
      <button
        onClick={toggleFocusMode}
        className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg text-xs font-bold border ${
          focusMode
            ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
            : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)]'
        }`}
        title="Toggle focus mode (Z)"
      >
        <Focus className="w-3.5 h-3.5" />
        <span className="hidden xs:inline">Focus</span>
      </button>
      <button
        onClick={toggleFullscreen}
        className="flex items-center gap-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 rounded-lg text-xs text-[var(--color-text-muted)]"
        title="Toggle fullscreen (F11)"
      >
        <Maximize className="w-3.5 h-3.5" />
      </button>
      {analysisMode === 'regular' && authUser && (authUser.authProvider === 'google' || authUser.authProvider === 'anonymous') && (
        <button
          onClick={handleSaveGame}
          className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
            savedGameIds.has(selectedGame.id)
              ? 'bg-[var(--color-accent)] text-black border border-[var(--color-accent)]'
              : 'bg-[var(--color-surface)] border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-black'
          }`}
          title={savedGameIds.has(selectedGame.id) ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart className={`w-3.5 h-3.5 ${savedGameIds.has(selectedGame.id) ? 'fill-current' : ''}`} />
          <span className="hidden xs:inline">{savedGameIds.has(selectedGame.id) ? 'Favorited' : 'Favorite'}</span>
        </button>
      )}
    </div>
  );

  // Engine panel — depth picker, Analyze, pre-analyzed history. Rendered below
  // the board in Advanced and below the move log in Regular. The layout is fully
  // fluid: header + controls wrap independently so nothing cramps or overflows
  // on narrow screens, and every control keeps a comfortable touch target.
  const enginePanel = (
    <>{!(focusMode && fullscreenMode) && (
      <div className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 sm:p-3.5" id="engine-controls-panel" style={{ maxWidth: boardWidth }}>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
          <h3 className="min-w-0 flex items-center gap-2 text-sm font-bold text-white">
            <Zap className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
            <span className="truncate">Stockfish 18 Lite</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={settings.engineDepth}
              onChange={(e) => { updateSettings({ engineDepth: parseInt(e.target.value, 10) }); }}
              className="min-h-[36px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2.5 py-2 text-xs text-white"
              id="depth-picker"
            >
              <option value={6}>Depth 6</option>
              <option value={8}>Depth 8</option>
              <option value={10}>Depth 10</option>
              <option value={12}>Depth 12</option>
              <option value={15}>Depth 15</option>
              <option value={18}>Depth 18</option>
            </select>
            <button
              onClick={handleAnalyzePress}
              disabled={analyzing}
              className={`min-h-[36px] px-3.5 sm:px-4 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 ${
                analyzing
                  ? 'bg-[var(--color-primary)] opacity-70 cursor-wait'
                  : 'bg-[var(--color-primary)]'
              }`}
              id="analyze-game-button"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>{analyzing ? 'Analyzing...' : 'Analyze'}</span>
            </button>
            {priorAnalyses.length > 0 && !analyzing && (
              <button
                onClick={() => { setShowPriorAnalyses(true); }}
                className="min-h-[36px] px-3 py-2 rounded-lg text-xs font-bold text-green-500 border border-green-600 hover:bg-green-600 hover:text-white transition-all flex items-center gap-1.5"
                id="pre-analyzed-button"
                title="This match was analyzed before. Load a saved analysis instead of re-analyzing."
              >
                <History className="w-3.5 h-3.5" />
                <span>Pre-analyzed</span>
              </button>
            )}
          </div>
        </div>
      </div>
    )}</>
  );

  return (
    <div className="space-y-5" id="analysis-viewport">
      {!focusMode && (
        <button
          onClick={handleBackToImport}
          className="flex items-center space-x-1.5 text-xs text-[var(--color-accent)] mb-1"
          id="back-to-import-btn"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Import</span>
        </button>
      )}

      {/* Regular / Advanced mode split — plain backgroundless text buttons,
          always visible above the arena. Active mode: white bold text with a
          subtle accent underline; inactive: muted text. */}
      <div className="w-full flex items-center justify-center gap-0" id="analysis-mode-toggle">
        <button
          onClick={() => { handleModeChange('regular'); }}
          aria-pressed={analysisMode === 'regular'}
          className={`relative py-0.5 pr-2 text-sm transition-colors ${
            analysisMode === 'regular'
              ? 'text-white font-bold'
              : 'text-[var(--color-text-muted)] font-semibold hover:text-white'
          }`}
        >
          Regular
          {analysisMode === 'regular' && (
            <span className="absolute left-0 right-2 -bottom-[2px] h-[2px] rounded-full bg-[var(--color-accent)]" />
          )}
        </button>
        <span className="w-px h-3.5 bg-[var(--color-border)] mx-1" aria-hidden="true" />
        <button
          onClick={() => { handleModeChange('advanced'); }}
          aria-pressed={analysisMode === 'advanced'}
          className={`relative py-0.5 pl-2 text-sm transition-colors ${
            analysisMode === 'advanced'
              ? 'text-white font-bold'
              : 'text-[var(--color-text-muted)] font-semibold hover:text-white'
          }`}
        >
          Advanced
          {analysisMode === 'advanced' && (
            <span className="absolute left-2 right-0 -bottom-[2px] h-[2px] rounded-full bg-[var(--color-accent)]" />
          )}
        </button>
      </div>

      {/* Post-game match-finished options — only in the ?post=1 flow, after the
          analysis completes. Inline so it never blocks the page, gold-accented to
          echo the winner treatment, and consumed by X / Later / Re-analyze. */}
      {isPostFlow && postPanelVisible && (
        <div className="w-full fade-in" id="post-analysis-panel">
          <div className="w-full bg-[var(--color-surface)] border border-[#f5c542]/40 rounded-xl p-4 relative">
            <button
              onClick={dismissPostPanel}
              className="absolute top-2.5 right-2.5 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-background)] transition-colors"
              aria-label="Dismiss match options"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5 pr-8">
              <div className="w-8 h-8 rounded-lg bg-[#f5c542]/15 text-[#f5c542] flex items-center justify-center shrink-0">
                <Trophy className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white leading-tight">Match analyzed</h3>
                <p className="text-xs text-[var(--color-text-muted)] leading-snug mt-0.5">
                  Your result is in. Rematch at this strength, tune it, or start a new game.
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div
                className="flex items-center gap-1 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-1"
                role="group"
                aria-label="Analysis strength"
              >
                {([
                  ['weaker', 'Weaker', 'd8'],
                  ['same', 'Same', 'd15'],
                  ['stronger', 'Stronger', 'd18'],
                ] as const).map(([key, label, depthLabel]) => (
                  <button
                    key={key}
                    onClick={() => { setPostStrength(key); }}
                    aria-pressed={postStrength === key}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors ${
                      postStrength === key
                        ? 'bg-[var(--color-accent)] text-black'
                        : 'text-[var(--color-text-muted)] hover:text-white'
                    }`}
                  >
                    {label} <span className="opacity-70">{depthLabel}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handlePostReanalyze}
                  className="min-h-[34px] px-3.5 py-1.5 rounded-lg text-xs font-bold text-black bg-[var(--color-accent)] hover:brightness-110 transition-all"
                >
                  Re-analyze
                </button>
                <button
                  onClick={handlePlayNewMatch}
                  className="min-h-[34px] px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-[var(--color-primary)] hover:opacity-90 transition-opacity"
                >
                  Play new match
                </button>
                <button
                  onClick={dismissPostPanel}
                  className="min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--color-text-muted)] hover:text-white transition-colors"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`fade-in ${
        focusMode
          ? 'flex flex-row justify-center items-center gap-6'
          : 'grid grid-cols-1 gap-5 lg:grid-cols-12'}
      `.trim()} id="game-arena-grid">
        <div className={`space-y-4 flex flex-col items-center ${focusMode ? '' : 'lg:col-span-7 xl:col-span-8'}`}>
          {/* Opening name — Advanced only. A small, plain, backgroundless line
              (the old amber card and the big heart beside it are gone; the
              console/utility hearts remain the single favorite). */}
          {analysisMode === 'advanced' && (
          <div className="w-full" style={{ maxWidth: boardWidth }}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]/70">
              Opening
            </div>
            <h2 className={`text-base sm:text-lg font-semibold truncate leading-tight min-h-[1.5rem] ${
              openingName ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'
            }`} title={openingName}>
              {openingName || '—'}
            </h2>
          </div>
          )}
          {/* Top player bar — hugs the board, chess.com style */}
          <div className="w-full" style={{ maxWidth: boardWidth }} id="player-bar-top">
            <PlayerBar player={topPlayer} side={topSide} result={selectedGame.result} accuracy={selectedGame.accuracy} />
          </div>
          {/* Single board, reordered with CSS grid: phones get a horizontal eval
              bar below, desktop gets a vertical bar on the left. Rendering the
              board twice (hidden via display:none) made react-chessboard's piece
              animation read a 0-width square and throw 'Square width not found'. */}
          <div className="w-full grid grid-cols-1 lg:grid-cols-[min-content_1fr] lg:items-stretch" style={{ maxWidth: boardWidth }} id="board-single-layout">
            <div className="hidden lg:flex lg:self-stretch lg:min-h-[300px]">
              <EvalBar score={displayScore} mate={displayMate} flipped={false} />
            </div>
            <div className="w-full min-w-0 relative">
              {boardEl}
              {hypothesisActive && hypothesisSearching && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 rounded-lg backdrop-blur-[2px]">
                  <div className="flex items-center gap-2.5 bg-[var(--color-surface)]/95 border border-[var(--color-accent)]/40 rounded-xl px-4 py-2.5 shadow-lg">
                    <Activity className="w-4 h-4 text-[var(--color-accent)] animate-pulse" />
                    <span className="text-xs font-bold text-[var(--color-accent)]">Analyzing what-if…</span>
                  </div>
                </div>
              )}
            </div>
            <div className="lg:hidden w-full h-[30px]">
              <EvalBar score={displayScore} mate={displayMate} flipped={false} horizontal />
            </div>
          </div>

          {/* Bottom player bar — hugs the board, chess.com style */}
          <div className="w-full" style={{ maxWidth: boardWidth }} id="player-bar-bottom">
            <PlayerBar player={bottomPlayer} side={bottomSide} result={selectedGame.result} accuracy={selectedGame.accuracy} />
          </div>

          {/* Analysis time + depth — slim, subtle strip below the board on BOTH
              pages (the Regular engine subtitle that used to carry it was
              removed in the cleanup). Appears once the game has been analyzed. */}
          {selectedGame.analyzedAt && (
            <div className="w-full flex justify-center" style={{ maxWidth: boardWidth }}>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-background)]/70 px-3 py-1 text-[10px] sm:text-[11px] font-semibold text-[var(--color-text-muted)]">
                <span className="text-green-500 font-bold leading-none">&#x2713;</span>
                <span>
                  Analyzed{formatDuration(selectedGame.analysisDurationMs) && <> in {formatDuration(selectedGame.analysisDurationMs)}</>}
                </span>
                {selectedGame.analysisDepth != null && (
                  <span className="flex items-center gap-1.5">
                    <span className="text-[var(--color-border)]">&middot;</span>
                    <span>Depth {selectedGame.analysisDepth}</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {(analysisMode === 'advanced' || focusMode || vpW < 1024) && (<>{navConsole}</>)}

          {/* Rewind-on-analyze indicator — shown while the pieces are stepping
              back to the start in lockstep with the engine's progress. */}
          {rewindActive && rewindArmedRef.current && (
            <div className="w-full flex justify-center" style={{ maxWidth: boardWidth }}>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/40 bg-[var(--color-surface)] px-3 py-1 text-[10px] sm:text-[11px] font-bold text-[var(--color-accent)] fade-in">
                <Rewind className="w-3.5 h-3.5 animate-pulse" />
                <span>Rewinding to start…</span>
              </div>
            </div>
          )}

          {(analysisMode === 'advanced' || focusMode) && (<>{utilityRow}</>)}

      {(analysisMode === 'advanced' || focusMode) && (<>{enginePanel}</>)}

        </div>

        {!focusMode && (
        <div className="lg:col-span-5 xl:col-span-4 space-y-4 flex flex-col h-auto min-h-[400px]">
          {analysisMode === 'advanced' && (
          <>
          {legendaryData && !notificationDismissed && (
            <div className="bg-[var(--color-surface)] border border-[var(--color-accent)] rounded-xl p-4 text-[var(--color-accent)] relative" id="legendary-achievement-banner">
              <button
                className="absolute top-2 right-2 text-[var(--color-accent)] text-sm font-bold w-5 h-5 rounded-full flex items-center justify-center bg-[var(--color-border)]"
                onClick={() => { setNotificationDismissed(true); }}
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-start space-x-3">
                <div className="bg-[var(--color-accent)] text-white p-1.5 rounded-lg shrink-0 mt-0.5">
                  <Award className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="font-extrabold text-[var(--color-accent)] tracking-tight uppercase text-xs flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    Legendary Game!
                  </h4>
                  <p className="text-xs text-[var(--color-text)] mt-1 pr-6 leading-relaxed">
                    {legendaryData.hasBrilliant && `Brilliant moves: ${legendaryData.brilliantsWhite} by White, ${legendaryData.brilliantsBlack} by Black. `}
                    {legendaryData.hasHighAccuracy && `Accuracy: White ${legendaryData.whiteAcc}%, Black ${legendaryData.blackAcc}%.`}
                  </p>
                </div>
              </div>
            </div>
          )}

          <CoachPanel
            notes={coachNotes}
            activeMoveIndex={currentMoveIndex}
            onTryMove={handleTryCoachMove}
          />
          </>
          )}
          {vpW >= 1024 && (
          <div className="fade-in flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 flex flex-col overflow-clip max-h-[min(420px,55vh)] min-h-[220px]">
            <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
              <History className="w-4 h-4 text-[var(--color-accent)]" />
              <span>Move Log</span>
            </h3>
            <div className="flex-1 overflow-y-auto pr-1 space-y-1 scrollbar-thin scrollbar-track-[#2a2a2a] scrollbar-thumb-[#4a4a4a] overscroll-contain" id="moves-log-container" style={{ WebkitOverflowScrolling: 'touch' }}>
              {selectedGame.moves?.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-1.5 text-center text-xs text-[var(--color-text-muted)] italic p-6">
                  <span>No moves recorded for this game.</span>
                  <span className="text-[var(--color-text-muted)]/80">Import a PGN with moves to use the move list.</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1 text-sm font-mono">
                  {Array.from({ length: Math.ceil((selectedGame.moves ?? []).length / 2) }).map((_, rowIndex) => {
                    const whiteMove = (selectedGame.moves ?? [])[rowIndex * 2];
                    const blackMove = (selectedGame.moves ?? [])[rowIndex * 2 + 1];
                    const turnNum = rowIndex + 1;
                    return (
                      <div key={rowIndex} className="col-span-2 grid grid-cols-12 py-1.5 px-2 rounded-lg bg-transparent items-center">
                        <div className="col-span-2 text-xs text-[var(--color-text-muted)] font-bold">{turnNum}.</div>
                        <button
                          onClick={(e) => {
                            if (hypothesisActive) exitHypothesisMode();
                            setCurrentMoveIndex(whiteMove.index);
                            e.currentTarget.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                          }}
                          className={`col-span-5 text-left font-semibold px-2 py-0.5 rounded flex items-center gap-1.5 cursor-pointer ${
                            currentMoveIndex === whiteMove.index
                              ? 'bg-[var(--color-surface)] text-[var(--color-primary)]'
                              : 'text-[var(--color-text)]'
                          }`}
                          id={`move-${whiteMove.index}`}
                        >
                          <span className="truncate min-w-0">{whiteMove.san}</span>
                          {whiteMove.classification && classificationImages[whiteMove.classification] && (
                            <img src={classificationImages[whiteMove.classification]} alt={whiteMove.classification} width={22} height={22} className="inline-block shrink-0 opacity-85 pointer-events-none" />
                          )}
                        </button>
                        {blackMove ? (
                          <button
                            onClick={(e) => {
                              if (hypothesisActive) exitHypothesisMode();
                              setCurrentMoveIndex(blackMove.index);
                              e.currentTarget.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                            }}
                            className={`col-span-5 text-left font-semibold px-2 py-0.5 rounded flex items-center gap-1.5 cursor-pointer ${
                              currentMoveIndex === blackMove.index
                                ? 'bg-[var(--color-surface)] text-[var(--color-primary)]'
                                : 'text-[var(--color-text)]'
                            }`}
                            id={`move-${blackMove.index}`}
                          >
                            <span className="truncate min-w-0">{blackMove.san}</span>
                            {blackMove.classification && classificationImages[blackMove.classification] && (
                              <img src={classificationImages[blackMove.classification]} alt={blackMove.classification} width={22} height={22} className="inline-block shrink-0 opacity-85 pointer-events-none" />
                            )}
                          </button>
                        ) : (
                          <div className="col-span-5" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          )}
          {analysisMode === 'regular' && (
          <>
          {vpW >= 1024 && (<>{navConsole}</>)}
          {utilityRow}
          {enginePanel}
          {hypothesisActive && (
            <div className="w-full" style={{ maxWidth: boardWidth }}>
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs font-semibold text-amber-300 fade-in" id="deviation-warning">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>You've left the game line — exploring this position.</span>
              </div>
            </div>
          )}
          </>
          )}
          {analysisMode === 'advanced' && (
          <>
          <div className="fade-in bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 flex-shrink-0" id="positional-evaluation-box">
            <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <Activity className="w-4 h-4 text-[var(--color-accent)]" />
              <span>Engine Diagnosis</span>
            </h3>
            {hypothesisActive ? (
              hypothesisSearching ? (
                <div className="flex items-center gap-2 text-xs text-[var(--color-accent)] italic leading-relaxed py-2">
                  <Activity className="w-3.5 h-3.5 animate-pulse" />
                  <span>Analyzing what-if...</span>
                </div>
              ) : hypothesisError && hypothesisMoves.length > 0 ? (
                <div className="flex items-start gap-2 text-xs text-amber-400 leading-relaxed py-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>Engine search failed. Try undoing and replaying the move.</span>
                </div>
              ) : hypothesisMoves.length === 0 ? (
                <div className="text-xs text-[var(--color-text-muted)] italic leading-relaxed py-2">
                  Play a move to explore the line.
                </div>
              ) : (
                <div className="space-y-2">
                  {/* What-if Header */}
                  <div className="text-[10px] text-[var(--color-accent)] font-semibold pb-1.5 border-b border-[var(--color-accent)]/30 flex items-center gap-1.5">
                    <GitBranch className="w-3 h-3" />
                    <span>What-if line</span>
                    <span className="text-[var(--color-text-muted)]">depth={hypothesisDepth}</span>
                    <span>|</span>
                    <span>Stockfish 18 Lite</span>
                    {hypothesisLines && hypothesisLines.length > 1 && (
                      <span className="ml-auto text-[var(--color-text-muted)]">({hypothesisLines.length} PV)</span>
                    )}
                  </div>
                  {/* Last hypothesis move SAN */}
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-[var(--color-accent)] flex items-center gap-2 min-w-0">
                      {(() => {
                        const lastMove = hypothesisMoves[hypothesisMoves.length - 1];
                        const lastIcon = lastMove?.classification ? classificationImages[lastMove.classification] : undefined;
                        return lastIcon ? (
                          <img src={lastIcon} alt="" width={18} height={18} className="shrink-0 opacity-85" />
                        ) : null;
                      })()}
                      <span className="truncate">{hypothesisMoves[hypothesisMoves.length - 1]?.san}</span>
                      {hypothesisClassification != null && (
                        <HypothesisClassificationBadge classification={hypothesisClassification} />
                      )}
                    </span>
                    {hypothesisLines?.length > 0 && (() => {
                      const topLine = getTopEngineLine(hypothesisLines);
                      if (!topLine?.evaluation) return null;
                      const evalStr = topLine.evaluation.type === 'mate'
                        ? `#${topLine.evaluation.value}`
                        : topLine.evaluation.value > 0
                          ? `+${(topLine.evaluation.value / 100).toFixed(2)}`
                          : (topLine.evaluation.value / 100).toFixed(2);
                      return (
                        <span className={`text-xs font-mono font-bold ${
                          topLine.evaluation.type === 'mate' || topLine.evaluation.value > 0
                            ? 'text-[var(--color-primary)]' : 'text-white'
                        }`}>{evalStr}</span>
                      );
                    })()}
                  </div>
                  {/* Variation Lines */}
                  {hypothesisLines && hypothesisLines.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {hypothesisLines.slice(0, 4).map((line, i) => {
                        let lineEval = '';
                        if (line.evaluation.type === 'mate') {
                          lineEval = `#${line.evaluation.value}`;
                        } else {
                          const val = line.evaluation.value / 100;
                          lineEval = val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2);
                        }
                        const lineMoves = line.moves.map(m => m.san).join(' ');
                        return (
                          <div key={i} className="flex items-start gap-2 text-[11px] bg-[var(--color-surface)] p-1.5 rounded border border-[var(--color-accent)]/30">
                            <span className={`font-mono font-bold shrink-0 w-[5ch] ${
                              line.evaluation.type === 'mate' || line.evaluation.value > 0
                                ? 'text-[var(--color-primary)]' : 'text-white'
                            }`}>{lineEval}</span>
                            <span className="text-white font-mono truncate">{lineMoves}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )
            ) : currentMoveIndex === -1 ? (
              <div className="text-xs text-[var(--color-text-muted)] italic leading-relaxed py-2">
                Starting position. Browse moves or click 'Analyze' to compute.
              </div>
            ) : currentMove ? (
              <div className="space-y-2">
                {/* Engine Header */}
                <div className="text-[10px] text-[var(--color-text-muted)] font-semibold pb-1.5 border-b border-[var(--color-border)] flex items-center gap-1.5">
                  <span>Analysis</span>
                  <span className="text-[var(--color-primary)]">depth={
                    currentMove.engineLines?.[0]?.depth ?? currentMove.evaluation?.depthReached ?? '?'
                  }</span>
                  <span>|</span>
                  <span>Stockfish 18 Lite</span>
                  {currentMove.engineLines && currentMove.engineLines.length > 1 && (
                    <span className="ml-auto text-[var(--color-text-muted)]">({currentMove.engineLines.length} PV)</span>
                  )}
                </div>
                {/* Current Move with Classification */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm" style={{ color: currentMove.classification ? classificationColours[currentMove.classification] : '#606c38' }}>
                      {currentMove.san}
                    </span>
                    {currentMove.classification && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{
                          color: classificationColours[currentMove.classification],
                          backgroundColor: classificationColours[currentMove.classification] + '22',
                        }}
                      >
                        {classificationNames[currentMove.classification] || currentMove.classification.toUpperCase()}
                      </span>
                    )}
                  </div>
                  {currentMove.evaluation && (
                    <span className={`text-xs font-mono font-bold ${
                      (currentMove.evaluation.score ?? 0) > 0 && !currentMove.evaluation.isMate
                        ? 'text-[var(--color-primary)]' : 'text-white'
                    }`}>
                      {currentMove.evaluation.isMate
                        ? `#${currentMove.evaluation.mateIn}`
                        : currentMove.evaluation.score > 0
                          ? `+${currentMove.evaluation.score.toFixed(2)}`
                          : currentMove.evaluation.score.toFixed(2)
                      }
                    </span>
                  )}
                </div>
                {/* Variation Lines */}
                {currentMove.engineLines && currentMove.engineLines.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {currentMove.engineLines.slice(0, 4).map((line, i) => {
                      let lineEval = '';
                      if (line.evaluation.type === 'mate') {
                        lineEval = `#${line.evaluation.value}`;
                      } else {
                        const val = line.evaluation.value / 100;
                        lineEval = val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2);
                      }
                      const lineMoves = line.moves.map(m => m.san).join(' ');
                      return (
                        <div key={i} className="flex items-start gap-2 text-[11px] bg-[var(--color-surface)] p-1.5 rounded border border-[var(--color-border)]">
                          <span className={`font-mono font-bold shrink-0 w-[5ch] ${
                            line.evaluation.type === 'mate' || line.evaluation.value > 0
                              ? 'text-[var(--color-primary)]' : 'text-white'
                          }`}>{lineEval}</span>
                          <span className="text-white font-mono truncate">{lineMoves}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Opening Name */}
                {currentMove.opening && (
                  <div className="flex items-center gap-1.5 text-xs text-[var(--color-accent)] font-semibold pt-1.5 border-t border-[var(--color-border)]">
                    <BookOpen className="w-3 h-3 shrink-0" />
                    <span className="truncate">{currentMove.opening}</span>
                  </div>
                )}
              </div>
            ) : null}
          </div>
          </>
          )}
          {analysisMode === 'advanced' && (
          <>
          {favoriteGames.length > 0 && (
          <div className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 flex-shrink-0" id="favorites-box">
            <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
              <Heart className="w-4 h-4 text-[var(--color-accent)]" />
              <span>Favorites</span>
              <span className="text-[10px] font-bold text-[var(--color-text-muted)] ml-auto">{favoriteGames.length}</span>
            </h3>
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1 scrollbar-thin overscroll-contain">
              {favoriteGames.map((g) => (
                <button
                  key={g.id}
                  onClick={() => { handleSelectGame(g.id); }}
                  className="w-full text-left p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/25 transition-all"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] text-[var(--color-text-muted)] font-semibold truncate">{g.date}</span>
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-white shrink-0">{g.result}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <PlayerAvatar name={g.white?.username} avatar={g.white?.avatar} size={20} />
                    <span className="text-xs font-bold text-white truncate">{g.white?.username ?? 'White'}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0 mt-1">
                    <PlayerAvatar name={g.black?.username} avatar={g.black?.avatar} size={20} />
                    <span className="text-xs font-bold text-white truncate">{g.black?.username ?? 'Black'}</span>
                  </div>
                  {g.accuracy != null && (
                    <div className="text-[10px] text-green-500 font-semibold mt-1.5">
                      W: {g.accuracy.white}% &middot; B: {g.accuracy.black}%
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
          )}
          </>
          )}
        </div>
        )}

      </div>

      {!focusMode && selectedGame && analysisMode === 'advanced' && (
        <div className="fade-in">
          <AnalysisReport game={selectedGame} />
        </div>
      )}

      {!focusMode && (
      <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setShowGameList(!showGameList); }}
          className="flex items-center space-x-1.5 text-xs text-[var(--color-text-muted)]"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Game library ({games.length})</span>
          <ChevronDown className={`w-3 h-3 ${showGameList ? 'rotate-180' : ''}`} />
        </button>
        <button
          onClick={() => {
            const u = useAuthStore.getState().user;
            if (u && (u.authProvider === 'google' || u.authProvider === 'anonymous')) {
              void loadUserGames();
            }
            if (u?.chessComUsername) {
              void fetchLinkedUserGames();
            }
          }}
          className="text-[10px] font-bold text-[var(--color-primary)] border border-[var(--color-primary)] px-2 py-0.5 rounded hover:bg-[var(--color-primary)] hover:text-white transition-all"
          title="Refresh game list"
        >
          Refresh
        </button>
      </div>

      {showGameList && (
        <div className="fade-in bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5" id="games-archive-card">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {games.map((g) => {
              const isSel = selectedGame?.id === g.id;
              const isAnalyzed = !!analysisCache[g.id]?.analyzedAt || !!analyzedPgnHashes[hashPgn(g.pgn)];
              let borderClass = 'border-[var(--color-border)]';
              if (isSel) borderClass = 'border-[var(--color-primary)]';
              else if (isAnalyzed) borderClass = 'border-green-600';
              return (
              <button
                key={g.id}
                onClick={() => { handleSelectGame(g.id); }}
                className={`text-left p-4 rounded-xl border flex flex-col justify-between min-h-[136px] bg-[var(--color-surface)] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/25 transition-all ${borderClass}`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-[var(--color-text-muted)] font-semibold truncate">{g.date}</span>
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-white shrink-0">{g.result}</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <PlayerAvatar name={g.white?.username} avatar={g.white?.avatar} size={22} />
                      <span className="text-xs font-bold text-white truncate">{g.white?.username ?? 'White'}</span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <PlayerAvatar name={g.black?.username} avatar={g.black?.avatar} size={22} />
                      <span className="text-xs font-bold text-white truncate">{g.black?.username ?? 'Black'}</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-[var(--color-text-muted)] font-medium pt-0.5">
                    {g.white?.rating && `White: ${g.white.rating}`}{g.white?.rating && g.black?.rating && ' | '}{g.black?.rating && `Black: ${g.black.rating}`}
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start mt-2">
                  {isSel && (
                    <span className="text-[10px] font-bold text-white bg-[var(--color-primary)] px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                  {isAnalyzed && (
                    <span className="text-[10px] font-bold text-green-500">&#x2713; Analyzed{formatDuration(analysisCache[g.id]?.analysisDurationMs) && ` (${formatDuration(analysisCache[g.id]?.analysisDurationMs)})`}</span>
                  )}
                  {savedGameIds.has(g.id) && (
                    <Heart className="w-3 h-3 text-[var(--color-accent)] fill-current ml-auto" />
                  )}
                </div>
              </button>
              );
            })}
          </div>
        </div>
      )}
      </>
      )}

      {showShortcuts && vpW >= 1024 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => { setShowShortcuts(false); }} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 max-w-md w-full mx-4" onClick={e => { e.stopPropagation(); }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-[var(--color-primary)]" />
                Keyboard Shortcuts
              </h2>
              <button onClick={() => { setShowShortcuts(false); }} className="text-[var(--color-text-muted)] text-xl leading-none"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm py-1.5 border-b border-[var(--color-border)]">
                <span className="text-white">Flip board</span>
                <span className="text-[var(--color-text-muted)] font-mono text-xs bg-[var(--color-surface)] px-2 py-0.5 rounded">F</span>
              </div>
              <div className="flex justify-between text-sm py-1.5 border-b border-[var(--color-border)]">
                <span className="text-white">Analyze game</span>
                <span className="text-[var(--color-text-muted)] font-mono text-xs bg-[var(--color-surface)] px-2 py-0.5 rounded">A</span>
              </div>
              <div className="flex justify-between text-sm py-1.5 border-b border-[var(--color-border)]">
                <span className="text-white">Next move</span>
                <span className="text-[var(--color-text-muted)] font-mono text-xs bg-[var(--color-surface)] px-2 py-0.5 rounded">&rarr;</span>
              </div>
              <div className="flex justify-between text-sm py-1.5 border-b border-[var(--color-border)]">
                <span className="text-white">Previous move</span>
                <span className="text-[var(--color-text-muted)] font-mono text-xs bg-[var(--color-surface)] px-2 py-0.5 rounded">&larr;</span>
              </div>
              <div className="flex justify-between text-sm py-1.5 border-b border-[var(--color-border)]">
                <span className="text-white">First move</span>
                <span className="text-[var(--color-text-muted)] font-mono text-xs bg-[var(--color-surface)] px-2 py-0.5 rounded">Home</span>
              </div>
              <div className="flex justify-between text-sm py-1.5 border-b border-[var(--color-border)]">
                <span className="text-white">Last move</span>
                <span className="text-[var(--color-text-muted)] font-mono text-xs bg-[var(--color-surface)] px-2 py-0.5 rounded">End</span>
              </div>
              <div className="flex justify-between text-sm py-1.5">
                <span className="text-white">Show shortcuts</span>
                <span className="text-[var(--color-text-muted)] font-mono text-xs bg-[var(--color-surface)] px-2 py-0.5 rounded">?</span>
              </div>
              <div className="flex justify-between text-sm py-1.5 border-t border-[var(--color-border)] pt-3 mt-1">
                <span className="text-[var(--color-primary)] font-bold text-xs">Display</span>
                <span />
              </div>
              <div className="flex justify-between text-sm py-1.5 border-b border-[var(--color-border)]">
                <span className="text-white">Toggle focus mode</span>
                <span className="text-[var(--color-text-muted)] font-mono text-xs bg-[var(--color-surface)] px-2 py-0.5 rounded">Z</span>
              </div>
              <div className="flex justify-between text-sm py-1.5 border-b border-[var(--color-border)]">
                <span className="text-white">Toggle fullscreen</span>
                <span className="text-[var(--color-text-muted)] font-mono text-xs bg-[var(--color-surface)] px-2 py-0.5 rounded">F11</span>
              </div>
              <div className="flex justify-between text-sm py-1.5 border-t border-[var(--color-border)] pt-3 mt-1">
                <span className="text-[var(--color-accent)] font-bold text-xs">Exploration</span>
                <span />
              </div>
              <div className="flex justify-between text-sm py-1.5 border-b border-[var(--color-border)]">
                <span className="text-white">Undo explored move</span>
                <span className="text-[var(--color-text-muted)] font-mono text-xs bg-[var(--color-surface)] px-2 py-0.5 rounded">Backspace</span>
              </div>
              <div className="flex justify-between text-sm py-1.5">
                <span className="text-white">Exit exploration</span>
                <span className="text-[var(--color-text-muted)] font-mono text-xs bg-[var(--color-surface)] px-2 py-0.5 rounded">Esc</span>
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-4 text-center">Shortcuts can be disabled in Profile settings.</p>
          </div>
        </div>
      )}

      {showPriorAnalyses && selectedGame && priorAnalyses.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => { setShowPriorAnalyses(false); }} role="dialog" aria-modal="true" aria-label="Pre-analyzed games">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => { e.stopPropagation(); }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-[var(--color-primary)]" />
                Pre-analyzed
              </h2>
              <button onClick={() => { setShowPriorAnalyses(false); }} className="text-[var(--color-text-muted)] text-xl leading-none"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mb-3 leading-relaxed">
              This match was analyzed before. Pick a saved analysis to enter it directly — no need to re-analyze.
            </p>
            <div className="space-y-2">
              {priorAnalyses.map((run, i) => (
                <button
                  key={`${run.engine}-${run.depth}-${i}`}
                  onClick={async () => {
                    const ok = await loadPriorAnalysis(run.depth, run.engine);
                    if (ok) {
                      setShowPriorAnalyses(false);
                      useToastStore.getState().addToast({
                        type: 'success',
                        message: `Loaded pre-analyzed game (${engineLabel(run.engine)})`,
                      });
                    }
                  }}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] hover:border-[var(--color-primary)] transition-all text-left"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Activity className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
                    <span className="text-xs font-bold text-white truncate">{engineLabel(run.engine)}</span>
                    <span className="text-[10px] font-mono bg-[var(--color-surface)] px-2 py-0.5 rounded text-[var(--color-accent)] shrink-0">depth {run.depth}</span>
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">
                    {run.analyzedAt ? `Analyzed ${run.analyzedAt.slice(0, 10)}` : 'Analyzed'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showShare && selectedGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => { setShowShare(false); }} role="dialog" aria-modal="true" aria-label="Share game">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => { e.stopPropagation(); }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Share2 className="w-5 h-5 text-[var(--color-primary)]" />
                Share Game
              </h2>
              <button onClick={() => { setShowShare(false); }} className="text-[var(--color-text-muted)] text-xl leading-none"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold mb-1 block">Game URL</label>
                <div className="flex gap-2">
                  <input readOnly value={`${window.location.origin}/game/${selectedGame.shortId || selectedGame.id}`} className="flex-1 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-white font-mono" onClick={e => { (e.target as HTMLInputElement).select(); }} />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/game/${selectedGame.shortId || selectedGame.id}`);
                      setCopied(true);
                      setTimeout(() => { setCopied(false); }, 1500);
                    }}
                    className={`shrink-0 text-[11px] font-bold px-3 py-2 rounded-lg transition-all duration-150 active:scale-90 hover:scale-105 ${
                      copied
                        ? 'bg-green-600 text-white'
                        : 'bg-[var(--color-primary)] text-white'
                    }`}
                  >{copied ? 'Copied!' : 'Copy'}</button>
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold mb-1 block">Current Position (FEN)</label>
                <input readOnly value={getCurrentFen()} className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-white font-mono" onClick={e => { (e.target as HTMLInputElement).select(); }} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold mb-1 block">PGN</label>
                <textarea readOnly rows={6} value={selectedGame.pgn} className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-white font-mono resize-none" onClick={e => { (e.target as HTMLTextAreaElement).select(); }} />
              </div>
              <button
                onClick={() => {
                  const blob = new Blob([selectedGame.pgn], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${selectedGame.white.username}-vs-${selectedGame.black.username}.pgn`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="w-full bg-[var(--color-primary)] text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 active:scale-[0.98] hover:brightness-110 transition-all duration-150"
              >
                <FileText className="w-3.5 h-3.5" />
                Download PGN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
