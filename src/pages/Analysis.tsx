// @ts-nocheck - TODO: remove when TS 5.8/zustand v5 type inference issue resolved
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Zap,
  TrendingUp,
  AlertTriangle,
  History,
  Activity,
  Award,
  Search,
  FileText,
  ArrowLeft,
  BookOpen,
  ChevronDown,
  RotateCcw,
  Keyboard,
  Maximize,
  Focus,
  Save,
  Share2,
} from 'lucide-react';
import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import { hashPgn } from '../lib/tursoCache';
import { generateShortId } from '../lib/shortId';
import type { ChessGame } from '../types';
import { useSettingsStore } from '../stores/settingsStore';
import { useUIStore } from '../stores/uiStore';
import { useFullscreen } from '../hooks/useFullscreen';
import Chessboard from '../components/board/Chessboard';
import EvalBar from '../components/eval/EvalBar';
import { classificationImages, classificationColours, classificationNames } from '../constants/classifications';
import { getTopEngineLine } from '../lib/engine';
import { useSound, getSoundTypeFromSan } from '../hooks/useSound';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { SkeletonGameGrid, SkeletonBoard, SkeletonMoveList } from '../components/Skeleton';
import AnalysisReport from '../components/AnalysisReport';

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
    importChessComGames,
    selectGame,
    setCurrentMoveIndex,
    importPgnDirectly,
    triggerEvaluationPipeline,
    setGames,
    fetchLinkedUserGames,
    loadUserGames,
    loadGameByShortId,
  } = useGameStore();
  const games = storeGames;

  const { user: authUser } = useAuthStore();

  const { settings, updateSettings } = useSettingsStore();
  const { focusMode, fullscreenMode, toggleFocusMode } = useUIStore();
  const { toggleFullscreen } = useFullscreen();
  const { play, playFromSan, playGameEnd } = useSound();

  const { gameId: urlGameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();

  const [usernameInput, setUsernameInput] = useState('');
  const [pgnInput, setPgnInput] = useState('');
  const [importMode, setImportMode] = useState<'chesscom' | 'pgn'>('chesscom');
  const [notificationDismissed, setNotificationDismissed] = useState(false);
  const [showGameList, setShowGameList] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const [savedGameIds, setSavedGameIds] = useState<Set<string>>(new Set());
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [urlGameNotFound, setUrlGameNotFound] = useState(false);
  const [rightClickedSquares, setRightClickedSquares] = useState<string[]>([]);
  const [vpW, setVpW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const onResize = () => { setVpW(window.innerWidth); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); };
  }, []);

const isInAnalysis = !!selectedGame;
const legendaryData = checkLegendaryStatus();
const currentMove = selectedGame?.moves[currentMoveIndex];

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
      const shortId = generateShortId();
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

  const handleSaveGame = React.useCallback(() => {
    if (!selectedGame || !authUser || (authUser.authProvider !== 'google' && authUser.authProvider !== 'anonymous')) return;
    const isSaved = savedGameIds.has(selectedGame.id);
    import('../lib/firebase').then(({ saveUserGame, deleteUserGame }) => {
      if (isSaved) {
        deleteUserGame(authUser.id, selectedGame.id);
        setSavedGameIds(prev => { const next = new Set(prev); next.delete(selectedGame.id); return next; });
      } else {
        const gameForFirestore = {
          ...selectedGame,
          moves: JSON.parse(JSON.stringify(selectedGame.moves)),
          userSaved: true,
        };
        saveUserGame(authUser.id, selectedGame.id, gameForFirestore);
        setSavedGameIds(prev => { const next = new Set(prev); next.add(selectedGame.id); return next; });
      }
    });
  }, [selectedGame, authUser, savedGameIds]);

  React.useEffect(() => {
    if (!authUser || (authUser.authProvider !== 'google' && authUser.authProvider !== 'anonymous')) {
      setSavedGameIds(new Set());
      return;
    }
    import('../lib/firebase').then(({ fetchUserGames }) => {
      fetchUserGames(authUser.id).then(games => {
        const ids = new Set(games.filter((g: any) => g.userSaved).map((g: any) => g.id));
        setSavedGameIds(ids);
      });
    });
  }, [authUser?.id, authUser?.authProvider]);

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
      handler: () => {
        if (!selectedGame || analyzing) return;
        triggerEvaluationPipeline(settings.engineDepth);
      },
    },
    {
      key: 'ArrowRight',
      description: 'Next move',
      handler: () => {
        if (selectedGame) setCurrentMoveIndex(currentMoveIndex + 1);
      },
    },
    {
      key: 'ArrowLeft',
      description: 'Previous move',
      handler: () => {
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
  ]);

  const handleChessComSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput.trim()) {
      importChessComGames(usernameInput.trim());
      setShowGameList(true);
    }
  };

  const handlePgnImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pgnInput.trim()) {
      importPgnDirectly(pgnInput.trim());
      setPgnInput('');
    }
  };

  const handleBackToStart = () => { setCurrentMoveIndex(-1); };
  const handlePrevMove = () => { setCurrentMoveIndex(currentMoveIndex - 1); };
  const handleNextMove = () => { setCurrentMoveIndex(currentMoveIndex + 1); };
  const handleEndMove = () => { setCurrentMoveIndex((selectedGame?.moves.length || 0) - 1); };

  const handleBackToImport = () => {
    selectGame('');
    setNotificationDismissed(false);
    navigate('/', { replace: true });
  };

  const handleSelectGame = (gameId: string) => {
    selectGame(gameId);
    let game = useGameStore.getState().games.find(g => g.id === gameId);
    if (!game?.shortId) {
      const shortId = generateShortId();
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
        });
      }
    } else {
      navigate(`/game/${game.shortId}`, { replace: true });
    }
  };

  const getCurrentFen = () => {
    if (!selectedGame || currentMoveIndex === -1) {
      return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    }
    return selectedGame.moves[currentMoveIndex]?.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  };

  const getMoveHighlight = () => {
    if (!selectedGame || currentMoveIndex === -1) return undefined;
    const m = selectedGame.moves[currentMoveIndex];
    return { from: m.from, to: m.to, classification: m.classification };
  };

  const getBestMoveArrow = () => {
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
              ×
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
            Import from Chess.com or paste a PGN to start analyzing with Stockfish 17.
          </p>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6" id="analysis-settings-card">
          <div className="flex border-b border-[var(--color-border)] mb-4">
            <button
              onClick={() => { setImportMode('chesscom'); }}
              className={`pb-3 px-4 text-sm font-semibold border-b-2 ${
                importMode === 'chesscom'
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-text-muted)]'
              }`}
            >
              <Search className="w-4 h-4 inline mr-1" />
              Chess.com Username
            </button>
            <button
              onClick={() => { setImportMode('pgn'); }}
              className={`pb-3 px-4 text-sm font-semibold border-b-2 ${
                importMode === 'pgn'
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-text-muted)]'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-1" />
              Paste PGN
            </button>
          </div>

          {importMode === 'chesscom' ? (
            <form onSubmit={handleChessComSubmit} className="flex gap-2">
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => { setUsernameInput(e.target.value); }}
                placeholder="e.g. Hikaru"
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm text-white placeholder-[var(--color-text-muted)] flex-1"
                id="chesscom-user-input"
              />
              <button
                type="submit"
                disabled={loadingGames}
                className="bg-[var(--color-primary)] text-white text-sm px-5 py-2.5 rounded-lg font-bold disabled:opacity-50"
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
        {showGameList && !loadingGames && games.length > 0 && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5" id="games-archive-card">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-[var(--color-accent)]" />
              <span>Recent Games ({games.length})</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      className={`text-left p-4 rounded-xl border flex flex-col justify-between h-32 bg-[var(--color-surface)] hover:scale-[1.02] ${borderClass}`}
                      id={`game-selector-${g.id}`}
                    >
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)] font-semibold mb-1">
                          <span>{g.date}</span>
                          <span className="font-mono bg-[var(--color-surface)] px-1.5 py-0.5 rounded text-white">{g.result}</span>
                        </div>
                        <div className="text-xs font-bold text-white truncate">
                          {g.white.username} vs {g.black.username}
                        </div>
                        <div className="text-[10px] text-[var(--color-text-muted)] mt-1">
                          {g.white.rating && `White: ${g.white.rating}`}{g.white.rating && g.black.rating && ' | '}{g.black.rating && `Black: ${g.black.rating}`}
                        </div>
                      </div>
                      {isAnalyzed && (
                        <span className="text-[10px] font-bold text-green-500 self-start mt-2">&#x2713; Analyzed{formatDuration(analysisCache[g.id]?.analysisDurationMs) && ` (${formatDuration(analysisCache[g.id]?.analysisDurationMs)})`}</span>
                      )}
                    </button>
                  );
               })}
            </div>
          </div>
        )}

        {authUser?.chessComUsername && linkedLoading && linkedGames.length === 0 && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5">
            <div className="h-4 w-40 bg-[var(--color-border)] rounded animate-pulse mb-4" />
            <SkeletonGameGrid count={3} />
          </div>
        )}
        {authUser?.chessComUsername && !linkedLoading && linkedGames.length > 0 && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-[var(--color-accent)]" />
                <span>{authUser.chessComUsername}&apos;s Recent Games</span>
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
              {linkedGames.map((g) => {
                const isAnalyzed = !!analysisCache[g.id]?.analyzedAt || !!analyzedPgnHashes[hashPgn(g.pgn)];
                return (
                  <button
                    key={g.id}
                    onClick={() => { handleSelectGame(g.id); }}
                    className={`text-left p-4 rounded-xl border flex flex-col justify-between h-32 bg-[var(--color-surface)] hover:scale-[1.02] ${
                      isAnalyzed ? 'border-green-600' : 'border-[var(--color-border)]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)] font-semibold mb-1">
                        <span>{g.date}</span>
                        <span className="font-mono bg-[var(--color-surface)] px-1.5 py-0.5 rounded text-white">{g.result}</span>
                      </div>
                      <div className="text-xs font-bold text-white truncate">
                        {g.white.username} vs {g.black.username}
                      </div>
                    </div>
                    {isAnalyzed && (
                      <span className="text-[10px] font-bold text-green-500 self-start mt-2">&#x2713; Analyzed{formatDuration(analysisCache[g.id]?.analysisDurationMs) && ` (${formatDuration(analysisCache[g.id]?.analysisDurationMs)})`}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  const pad = 32;
  const desiredW = focusMode ? 700 : fullscreenMode ? 660 : 550;
  const boardWidth = Math.min(desiredW, vpW - pad);

  return (
    <div className="space-y-5" id="analysis-viewport">
      {!focusMode && (
        <button
          onClick={handleBackToImport}
          className="flex items-center space-x-1.5 text-xs text-[var(--color-accent)] mb-1"
          id="back-to-import-btn"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to import</span>
        </button>
      )}

      <div className={`fade-in ${
        focusMode
          ? 'flex flex-row justify-center items-center gap-6'
          : 'grid grid-cols-1 gap-5 lg:grid-cols-12'}
      `.trim()} id="game-arena-grid">
        {focusMode && selectedGame && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 flex flex-col items-center gap-3" id="focus-players-panel">
          <div className="flex flex-col items-center gap-1.5">
            {selectedGame.black?.avatar ? (
              <img src={selectedGame.black.avatar} alt="" className="w-[34px] h-[34px] rounded-[10px] border border-[var(--color-text-muted)] flex-shrink-0" />
            ) : (
              <span className="w-[34px] h-[34px] rounded-[10px] bg-[var(--color-surface)] border border-[var(--color-text-muted)] flex-shrink-0 block" />
            )}
            <div className="text-sm font-bold text-white text-center truncate max-w-[160px] leading-tight">
              {selectedGame.black?.username ?? 'Black'}
              {selectedGame.black?.rating && <span className="text-[var(--color-text-muted)] ml-1">({selectedGame.black.rating})</span>}
            </div>
          </div>
          {selectedGame.accuracy && (
            <div className="text-center -mt-1">
              <div className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase">Accuracy</div>
              <div className="text-xs font-bold text-white">{selectedGame.accuracy.black}%</div>
            </div>
          )}
          <div className="text-xs text-[var(--color-primary)] font-bold uppercase tracking-widest">VS</div>
          {selectedGame.accuracy && (
            <div className="text-center -mt-1">
              <div className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase">Accuracy</div>
              <div className="text-xs font-bold text-white">{selectedGame.accuracy.white}%</div>
            </div>
          )}
          <div className="flex flex-col items-center gap-1.5 mt-[10px]">
            {selectedGame.white?.avatar ? (
              <img src={selectedGame.white.avatar} alt="" className="w-[34px] h-[34px] rounded-[10px] border border-[var(--color-text-muted)] flex-shrink-0" />
            ) : (
              <span className="w-[34px] h-[34px] rounded-[10px] bg-white border border-[var(--color-text-muted)] flex-shrink-0 block" />
            )}
            <div className="text-sm font-bold text-white text-center truncate max-w-[160px] leading-tight">
              {selectedGame.white?.username ?? 'White'}
              {selectedGame.white?.rating && <span className="text-[var(--color-text-muted)] ml-1">({selectedGame.white.rating})</span>}
            </div>
          </div>
          <div className="mt-2 pt-3 border-t border-[var(--color-border)] w-full text-center">
            <div className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase">Result</div>
            <div className="text-sm font-bold text-white font-mono">{selectedGame.result}</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">{selectedGame.date}</div>
          </div>
        </div>
        )}
        <div className={`space-y-4 flex flex-col items-center ${focusMode ? '' : 'lg:col-span-7'}`}>
          <div className="flex w-full gap-3" style={{ maxWidth: boardWidth }}>
            <div className="self-stretch min-h-[300px]">
                <EvalBar
                  score={currentMove?.evaluation?.score ?? null}
                  mate={currentMove?.evaluation?.mateIn ?? null}
                  flipped={false}
                />
            </div>
            <div className="flex-1">
              {(() => {
                const isLastMove = selectedGame && currentMoveIndex >= selectedGame.moves.length - 1;
                let winnerSide: 'w' | 'b' | undefined;
                let checkmateSide: 'w' | 'b' | undefined;
                if (selectedGame && isLastMove) {
                  if (selectedGame.result === '1-0') { winnerSide = 'w'; checkmateSide = 'b'; }
                  else if (selectedGame.result === '0-1') { winnerSide = 'b'; checkmateSide = 'w'; }
                }
                const isCheckmate = checkmateSide && (() => {
                  try { return new Chess(getCurrentFen()).isCheckmate(); } catch { return false; }
                })();
                return (
                  <Chessboard
                    fen={getCurrentFen()}
                    playable={false}
                    orientation={settings.boardOrientation}
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
                  />
                );
              })()}
            </div>
          </div>

          <div className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl" id="game-controls-console" style={{ maxWidth: boardWidth }}>
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center space-x-1">
                <button onClick={handleBackToStart} disabled={currentMoveIndex === -1} className="p-2 bg-[var(--color-surface)] text-[var(--color-text-muted)] rounded-lg disabled:opacity-30" title="First Move" aria-label="Go to first move">
                  <ChevronsLeft className="w-5 h-5" />
                </button>
                <button onClick={handlePrevMove} disabled={currentMoveIndex === -1} className="p-2 bg-[var(--color-surface)] text-[var(--color-text-muted)] rounded-lg disabled:opacity-30" title="Previous Move" aria-label="Go to previous move">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => { setAutoplay(!autoplay); }}
                  disabled={currentMoveIndex === selectedGame.moves.length - 1}
                  className={`p-0 ${autoplay ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}
                  title={autoplay ? 'Pause (Space)' : 'Play (Space)'}
                  aria-label={autoplay ? 'Pause autoplay' : 'Start autoplay'}
                >
                  <span className="text-lg">{autoplay ? '■' : '▶'}</span>
                </button>
                <button onClick={handleNextMove} disabled={currentMoveIndex === selectedGame.moves.length - 1} className="p-2 bg-[var(--color-surface)] text-[var(--color-text-muted)] rounded-lg disabled:opacity-30" title="Next Move" aria-label="Go to next move">
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button onClick={handleEndMove} disabled={currentMoveIndex === selectedGame.moves.length - 1} className="p-2 bg-[var(--color-surface)] text-[var(--color-text-muted)] rounded-lg disabled:opacity-30" title="Last Move" aria-label="Go to last move">
                  <ChevronsRight className="w-5 h-5" />
                </button>
              </div>
              <span className="text-xs text-[var(--color-text-muted)] font-mono font-bold uppercase tracking-wider" id="nav-move-indicator">
                {currentMoveIndex + 1}/{selectedGame.moves.length}
              </span>
              <div className="flex items-center space-x-1">
                {authUser && (authUser.authProvider === 'google' || authUser.authProvider === 'anonymous') && (
                  <button
                    onClick={handleSaveGame}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                      savedGameIds.has(selectedGame.id)
                        ? 'bg-[var(--color-accent)] text-black border border-[var(--color-accent)]'
                        : 'bg-[var(--color-surface)] border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-black'
                    }`}
                    title={savedGameIds.has(selectedGame.id) ? 'Remove save' : 'Save game'}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savedGameIds.has(selectedGame.id) ? 'Saved' : 'Save'}</span>
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
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[11px] text-[var(--color-text-muted)] hover:text-white"
                  title="Download PGN"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>PGN</span>
                </button>
                <button
                  onClick={() => { setShowShare(true); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[11px] text-[var(--color-text-muted)] hover:text-white"
                  title="Share game"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </button>
              </div>
            </div>
          </div>

          <div className="w-full flex items-center gap-2 flex-wrap" style={{ maxWidth: boardWidth }}>
            <button
              onClick={toggleOrientation}
              className="flex items-center gap-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 rounded-lg text-xs text-[var(--color-text-muted)]"
              title="Flip board (F)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Flip</span>
            </button>
            <div className="flex-1" />
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-shortcuts'))}
              className="flex items-center gap-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 rounded-lg text-xs text-[var(--color-text-muted)]"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>Shortcuts</span>
            </button>
            <button
              onClick={toggleFocusMode}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border ${
                focusMode
                  ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                  : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)]'
              }`}
              title="Toggle focus mode (Z)"
            >
              <Focus className="w-3.5 h-3.5" />
              <span>Focus</span>
            </button>
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 rounded-lg text-xs text-[var(--color-text-muted)]"
              title="Toggle fullscreen (F11)"
            >
              <Maximize className="w-3.5 h-3.5" />
            </button>
          </div>

      {!(focusMode && fullscreenMode) && (
          <div className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3.5 space-y-2.5" id="engine-controls-panel" style={{ maxWidth: boardWidth }}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-[var(--color-primary)]" />
                  <span>Stockfish 17</span>
                </h3>
                <p className="text-[11px] text-[var(--color-text-muted)]">Depth {settings.engineDepth} &middot; Non-blocking analysis{selectedGame.analysisDepth != null ? ` · Last analyzed at depth ${selectedGame.analysisDepth}` : ''}</p>
              </div>
              <div className="flex items-center space-x-2">
                <select
                  value={settings.engineDepth}
                  onChange={(e) => { updateSettings({ engineDepth: parseInt(e.target.value, 10) }); }}
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-white"
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
                  onClick={() => triggerEvaluationPipeline(settings.engineDepth)}
                  disabled={analyzing}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold text-white flex items-center space-x-1.5 ${
                    analyzing
                      ? 'bg-[var(--color-primary)] opacity-70 cursor-wait'
                      : 'bg-[var(--color-primary)]'
                  }`}
                  id="analyze-game-button"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>{analyzing ? 'Analyzing...' : 'Analyze'}</span>
                </button>
              </div>
            </div>
            {analyzing && (
              <div className="space-y-1" id="analysis-progressbar-group">
                <div className="flex items-center justify-between text-[11px] font-medium">
                  <span className="text-[var(--color-primary)]">Analyzing positions...</span>
                  <span className="text-[var(--color-primary)] font-bold">{analysisProgress}%</span>
                </div>
                <div className="w-full h-2 bg-[var(--color-surface)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-primary)] rounded-full"
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          )}

        </div>

        {!focusMode && (
        <div className="lg:col-span-5 space-y-4 flex flex-col h-auto min-h-[400px]">
          {legendaryData && !notificationDismissed && (
            <div className="bg-[var(--color-surface)] border border-[var(--color-accent)] rounded-xl p-4 text-[var(--color-accent)] relative" id="legendary-achievement-banner">
              <button
                className="absolute top-2 right-2 text-[var(--color-accent)] text-sm font-bold w-5 h-5 rounded-full flex items-center justify-center bg-[var(--color-border)]"
                onClick={() => { setNotificationDismissed(true); }}
              >
                &#x2715;
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

          {!focusMode && selectedGame && (
          <div className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3.5 flex items-start justify-between" id="game-info-card">
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] font-semibold">
                <TrendingUp className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                <span>Result: </span>
                <span className="text-white bg-[var(--color-surface)] px-1.5 py-0.5 rounded font-mono">{selectedGame.result}</span>
                <span className="mx-1">&bull;</span>
                <span className="truncate">{selectedGame.date}</span>
                {selectedGame.analyzedAt && (
                  <span className="text-[10px] text-green-500 font-bold ml-auto">
                    &#x2713; Analyzed at depth {selectedGame.analysisDepth ?? '?'}{formatDuration(selectedGame.analysisDurationMs) && ` (${formatDuration(selectedGame.analysisDurationMs)})`}
                  </span>
                )}
              </div>
              <div className="text-sm font-bold text-white flex flex-col gap-1">
                <div className="flex items-center space-x-2.5">
                  {selectedGame.white?.avatar ? (
                    <img src={selectedGame.white.avatar} alt="" className="w-[44px] h-[44px] rounded-[10px] border border-[var(--color-text-muted)] flex-shrink-0" />
                  ) : (
                    <span className="w-[44px] h-[44px] rounded-[10px] bg-white border border-[var(--color-text-muted)] flex-shrink-0 block" />
                  )}
                  <span className="truncate">{selectedGame.white?.username ?? 'White'} {selectedGame.white?.rating && <span className="text-[var(--color-text-muted)]">({selectedGame.white.rating})</span>}</span>
                </div>
                <div className="flex items-center space-x-2.5 mt-[3px]">
                  {selectedGame.black?.avatar ? (
                    <img src={selectedGame.black.avatar} alt="" className="w-[44px] h-[44px] rounded-[10px] border border-[var(--color-text-muted)] flex-shrink-0" />
                  ) : (
                    <span className="w-[44px] h-[44px] rounded-[10px] bg-[var(--color-surface)] border border-[var(--color-text-muted)] flex-shrink-0 block" />
                  )}
                  <span className="truncate">{selectedGame.black?.username ?? 'Black'} {selectedGame.black?.rating && <span className="text-[var(--color-text-muted)]">({selectedGame.black.rating})</span>}</span>
                </div>
              </div>
            </div>
            {selectedGame.accuracy && (
              <div className="flex items-center space-x-2 border-l border-[var(--color-border)] pl-3 ml-2 shrink-0">
                <div className="text-center">
                  <div className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase">W</div>
                  <div className="text-sm font-bold text-white">{selectedGame.accuracy.white}%</div>
                </div>
                <div className="text-center">
                  <div className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase">B</div>
                  <div className="text-sm font-bold text-white">{selectedGame.accuracy.black}%</div>
                </div>
              </div>
            )}
          </div>
          )}

          <div className="fade-in flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 flex flex-col overflow-hidden max-h-[420px] min-h-[220px]">
            <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
              <History className="w-4 h-4 text-[var(--color-accent)]" />
              <span>Move Log</span>
            </h3>
            <div className="flex-1 overflow-y-auto pr-1 space-y-1 scrollbar-thin scrollbar-track-[#2a2a2a] scrollbar-thumb-[#4a4a4a]" id="moves-log-container">
              {selectedGame.moves?.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-[var(--color-text-muted)] italic p-6">
                  Click 'Analyze' to evaluate positions.
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
                          onClick={() => { setCurrentMoveIndex(whiteMove.index); }}
                          className={`col-span-5 text-left font-semibold px-2 py-0.5 rounded flex items-center justify-between ${
                            currentMoveIndex === whiteMove.index
                              ? 'bg-[var(--color-surface)] text-[var(--color-primary)]'
                              : 'text-[var(--color-text)]'
                          }`}
                          id={`move-${whiteMove.index}`}
                        >
                          <span>{whiteMove.san}</span>
                          {whiteMove.classification && classificationImages[whiteMove.classification] && (
                            <img src={classificationImages[whiteMove.classification]} alt={whiteMove.classification} width={22} height={22} className="inline-block ml-1.5 opacity-85" />
                          )}
                        </button>
                        {blackMove ? (
                          <button
                            onClick={() => { setCurrentMoveIndex(blackMove.index); }}
                            className={`col-span-5 text-left font-semibold px-2 py-0.5 rounded flex items-center justify-between ${
                              currentMoveIndex === blackMove.index
                                ? 'bg-[var(--color-surface)] text-[var(--color-primary)]'
                                : 'text-[var(--color-text)]'
                            }`}
                            id={`move-${blackMove.index}`}
                          >
                            <span>{blackMove.san}</span>
                            {blackMove.classification && classificationImages[blackMove.classification] && (
                              <img src={classificationImages[blackMove.classification]} alt={blackMove.classification} width={22} height={22} className="inline-block ml-1.5 opacity-85" />
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

          <div className="fade-in bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 flex-shrink-0" id="positional-evaluation-box">
            <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <Activity className="w-4 h-4 text-[var(--color-accent)]" />
              <span>Engine Diagnosis</span>
            </h3>
            {currentMoveIndex === -1 ? (
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
        </div>
        )}

      </div>

      {!focusMode && selectedGame && (
        <AnalysisReport game={selectedGame} />
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
            void importChessComGames('');
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
                className={`text-left p-4 rounded-xl border flex flex-col justify-between h-32 bg-[var(--color-surface)] hover:scale-[1.02] ${borderClass}`}
              >
                <div>
                  <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)] font-semibold mb-1">
                    <span>{g.date}</span>
                    <span className="font-mono bg-[var(--color-surface)] px-1.5 py-0.5 rounded text-white">{g.result}</span>
                  </div>
                  <div className="text-xs font-bold text-white truncate">
                    {g.white?.username ?? 'White'} vs {g.black?.username ?? 'Black'}
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
                </div>
              </button>
              );
            })}
          </div>
        </div>
      )}
      </>
      )}

      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => { setShowShortcuts(false); }} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 max-w-md w-full mx-4" onClick={e => { e.stopPropagation(); }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-[var(--color-primary)]" />
                Keyboard Shortcuts
              </h2>
              <button onClick={() => { setShowShortcuts(false); }} className="text-[var(--color-text-muted)] text-xl leading-none">&times;</button>
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
              <div className="flex justify-between text-sm py-1.5">
                <span className="text-white">Toggle fullscreen</span>
                <span className="text-[var(--color-text-muted)] font-mono text-xs bg-[var(--color-surface)] px-2 py-0.5 rounded">F11</span>
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-4 text-center">Shortcuts can be disabled in Profile settings.</p>
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
              <button onClick={() => { setShowShare(false); }} className="text-[var(--color-text-muted)] text-xl leading-none">&times;</button>
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
