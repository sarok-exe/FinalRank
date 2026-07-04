import type React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import {
  Play, Pause, RotateCcw, Clock, Cpu, Timer, Layers,
  Maximize, Focus, ChevronLeft, Users, FlipHorizontal,
} from 'lucide-react';
import { useClockStore } from '../stores/clockStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUIStore } from '../stores/uiStore';
import { useFullscreen } from '../hooks/useFullscreen';
import { analyzePositionLocally, destroyEngine } from '../lib/engine/legacy';
import Chessboard from '../components/board/Chessboard';
import EvalBar from '../components/eval/EvalBar';
import { useSound } from '../hooks/useSound';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import type { EngineGoMode, EvaluationResult } from '../types';
import { STARTING_FEN } from '../types';

type ActiveFeature = 'play-vs-computer' | 'player-vs-player' | 'chess-clock' | null;

type PresetCategory = {
  name: string;
  presets: { id: string; name: string }[];
}

const PRESET_CATEGORIES: PresetCategory[] = [
  {
    name: 'Bullet',
    presets: [
      { id: '1+0', name: '1+0' },
      { id: '1+1', name: '1+1' },
      { id: '2+1', name: '2+1' },
    ],
  },
  {
    name: 'Blitz',
    presets: [
      { id: '3+0', name: '3+0' },
      { id: '3+2', name: '3+2' },
      { id: '3+15', name: '3+15' },
      { id: '5+0', name: '5+0' },
    ],
  },
  {
    name: 'Rapid',
    presets: [
      { id: '10+0', name: '10+0' },
      { id: '10+5', name: '10+5' },
      { id: '15+10', name: '15+10' },
    ],
  },
  {
    name: 'Classic',
    presets: [
      { id: '30+0', name: '30+0' },
      { id: '30+20', name: '30+20' },
      { id: '60+0', name: '60+0' },
    ],
  },
  {
    name: 'Custom',
    presets: [],
  },
];

const ENGINE_DEPTH_PRESETS = [
  { id: 'beginner', name: 'Beginner', depth: 4 },
  { id: 'intermediate', name: 'Intermediate', depth: 8 },
  { id: 'advanced', name: 'Advanced', depth: 12 },
  { id: 'expert', name: 'Expert', depth: 18 },
];

// ── Feature Card ──────────────────────────────────────────
function FeatureCard(props: Readonly<{
  icon: React.ElementType;
  title: string;
  description: string;
  tags: string[];
  onClick(): void;
}>): React.ReactElement {
  const Icon = props.icon;
  const title = props.title;
  const description = props.description;
  const tags = props.tags;
  return (
    <button
      onClick={props.onClick}
      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-8 flex flex-col items-center text-center hover:border-[var(--color-primary)] transition-colors group aspect-square justify-center"
    >
      <div className="w-12 h-12 bg-[var(--color-surface)] rounded-xl flex items-center justify-center mb-5 group-hover:bg-[var(--color-primary)] transition-colors">
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-lg font-extrabold text-white mb-2">{title}</h3>
      <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-5">{description}</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {tags.map((t) => (
          <span key={t} className="text-xs font-bold text-[var(--color-accent)] bg-[var(--color-surface)] px-2.5 py-1 rounded">
            {t}
          </span>
        ))}
      </div>
    </button>
  );
}

// ── Landing / Card Grid ───────────────────────────────────
function ToolsLanding(props: Readonly<{ onSelect(f: ActiveFeature): void }>): React.ReactElement {
  return (
    <div className="max-w-5xl mx-auto space-y-8" id="tools-landing">
      <div className="text-center space-y-3 mb-2">
        <h1 className="text-4xl font-extrabold text-white tracking-tight">Tools</h1>
        <p className="text-base text-[var(--color-text-muted)]">
          Play against Stockfish, challenge a friend on the same device, or use the chess clock.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
        <FeatureCard
          icon={Cpu}
          title="Play Against Computer"
          description="Play a full game against Stockfish with configurable strength, depth, and time settings."
          tags={['Stockfish', 'Configurable']}
          onClick={() => { props.onSelect('play-vs-computer'); }}
        />
        <FeatureCard
          icon={Users}
          title="Player vs Player"
          description="Two players on the same device. Auto-flip rotates the board so each side always faces their pieces."
          tags={['Local Multiplayer', 'Auto-Flip']}
          onClick={() => { props.onSelect('player-vs-player'); }}
        />
        <FeatureCard
          icon={Clock}
          title="Chess Clock"
          description="A full-featured chess clock with increment support and presets for all time controls."
          tags={['Timer', 'Increment']}
          onClick={() => { props.onSelect('chess-clock'); }}
        />
      </div>
    </div>
  );
}

// ── Play vs Computer Feature ──────────────────────────────
function PlayVsComputerFeature(props: Readonly<{ onBack(): void }>): React.ReactElement {
  const uiStore = useUIStore();
  const { focusMode, fullscreenMode } = uiStore;
  const fullscreen = useFullscreen();
  const sound = useSound();

  const [gameStarted, setGameStarted] = useState(false);
  const [gameInstance, setGameInstance] = useState<Chess | null>(null);
  const [fen, setFen] = useState(STARTING_FEN);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [lastEval, setLastEval] = useState<EvaluationResult | null>(null);
  const [engineThinking, setEngineThinking] = useState(false);
  const [engineDepth, setEngineDepth] = useState(8);
  const [engineDepthPreset, setEngineDepthPreset] = useState('intermediate');
  const [engineGoMode, setEngineGoMode] = useState<EngineGoMode>('depth');
  const [engineThinkingTime, setEngineThinkingTime] = useState(2000);
  const [engineFeedback, setEngineFeedback] = useState('');
  const [rcSquares, setRcSquares] = useState<string[]>([]);

  const [vpW, setVpW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const onResize = (): void => { setVpW(window.innerWidth); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); };
  }, []);
  const pad = 32;
  let bW1Desired = 644;
  if (focusMode) bW1Desired = 819;
  else if (fullscreenMode) bW1Desired = 990;
  const boardWidth = Math.min(bW1Desired, vpW - pad);

  const announceGameEnd = useCallback((game: Chess) => {
    if (game.isCheckmate()) {
      setEngineFeedback('Checkmate!');
      sound.playGameEnd(game.turn() === 'w' ? '0-1' : '1-0');
    } else if (game.isDraw()) {
      setEngineFeedback('Draw!');
      sound.play('game-draw');
    } else {
      setEngineFeedback('Game over.');
      sound.play('gameend');
    }
  }, [sound]);

  const startNewGame = useCallback(() => {
    const fresh = new Chess();
    setGameInstance(fresh);
    setFen(fresh.fen());
    setMoveHistory([]);
    setLastEval(null);
    setEngineFeedback('Game started. Make your move.');
    setEngineThinking(false);
    setGameStarted(true);
    sound.play('game-start');
  }, [sound]);

  const handlePlayerMove = useCallback(async (from: string, to: string) => {
    if (!gameInstance || engineThinking) return;
    if (gameInstance.turn() === 'b') {
      setEngineFeedback("It's the engine's turn.");
      return;
    }
    try {
      const rawMove = gameInstance.move({ from, to, promotion: 'q' });
      setFen(gameInstance.fen());
      setMoveHistory(prev => [...prev, rawMove.san]);
      sound.playFromSan(rawMove.san);
      setEngineFeedback('Engine is thinking...');

      if (gameInstance.isGameOver()) {
        announceGameEnd(gameInstance);
        return;
      }

      setEngineThinking(true);
      const computedMoveResult = await analyzePositionLocally(gameInstance.fen(), {
        goMode: engineGoMode,
        depth: engineDepth,
        timeLimit: engineThinkingTime,
      });
      setLastEval(computedMoveResult);

      const legalMoves = gameInstance.moves({ verbose: true });
      if (legalMoves.length > 0) {
        const bestSan = computedMoveResult.bestMove;
        const bestVerbose = bestSan != null
          ? legalMoves.find(m => m.san === bestSan)
          : null;
        const selectedMove = bestVerbose ?? legalMoves[Math.floor(Math.random() * legalMoves.length)];
        gameInstance.move(selectedMove.san);
        setFen(gameInstance.fen());
        setMoveHistory(prev => [...prev, selectedMove.san]);
        sound.playFromSan(selectedMove.san);
        setEngineFeedback(`Engine plays ${selectedMove.san}. Your turn.`);

        if (gameInstance.isGameOver()) {
          announceGameEnd(gameInstance);
        }
      }
      setEngineThinking(false);
    } catch {
      setEngineFeedback('Illegal move.');
    }
  }, [gameInstance, engineThinking, engineGoMode, engineDepth, engineThinkingTime, sound, announceGameEnd]);

  const handleDepthPreset = (presetId: string, depth: number): void => {
    setEngineDepthPreset(presetId);
    setEngineDepth(depth);
  };

  return (
    <div className="space-y-4" id="play-vs-computer-feature">
      <div className="flex items-center justify-between">
        <button
          onClick={() => { destroyEngine(); onBack(); }}
          className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-text-muted)] hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Tools</span>
        </button>
        <div className="flex items-center gap-2">
          {gameStarted && (
            <>
              <button
                onClick={() => { uiStore.toggleFocusMode(); }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border ${
                  focusMode
                    ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                    : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)]'
                }`}
                title="Toggle focus mode (Z)"
              >
                <Focus className="w-3 h-3" />
                <span>Focus</span>
              </button>
              <button
                onClick={() => { void fullscreen.toggleFullscreen(); }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)]"
                title="Toggle fullscreen (F11)"
                aria-label="Toggle fullscreen"
              >
                <Maximize className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </div>

      {!gameStarted ? (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-8 flex flex-col items-center text-center space-y-4 max-w-md w-full">
            <Cpu className="w-14 h-14 text-[var(--color-accent)]" />
            <div>
              <h3 className="font-extrabold text-white text-lg">Play vs Stockfish</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Choose your engine strength and play against the local Stockfish 17 Lite engine.
              </p>
            </div>
            <button
              onClick={startNewGame}
              className="bg-[var(--color-primary)] text-white px-6 py-2.5 rounded-lg font-bold text-sm"
            >
              New Game
            </button>
          </div>
        </div>
      ) : (
        <div className={fullscreenMode ? 'flex justify-center items-center min-h-[80vh]' : ''}>
        <div className={focusMode ? 'flex flex-row justify-center items-center gap-6' : 'grid grid-cols-1 gap-5 lg:grid-cols-12'}>
          {/* Left: Board + Eval */}
          <div className={`space-y-4 flex flex-col items-center ${focusMode ? '' : 'lg:col-span-7'}`}>
            <div className="flex w-full gap-3" style={{ maxWidth: boardWidth }}>
              <div className="self-stretch min-h-[300px]">
                <EvalBar
                  score={lastEval?.score ?? null}
                  mate={lastEval?.mateIn ?? null}
                  flipped={false}
                />
              </div>
              <div className="flex-1">
                <Chessboard
                  fen={fen}
                  playable={!engineThinking}
                  onMove={(from, to) => { void handlePlayerMove(from, to); }}
                  rightClickedSquares={rcSquares}
                  onSquareRightClick={(sq) => {
                    setRcSquares(prev =>
                      prev.includes(sq) ? [] : [...prev, sq]
                    );
                  }}
                  onLeftClick={() => { setRcSquares([]); }}
                />
              </div>
            </div>
          </div>

          {/* Right: Controls */}
          {!focusMode && (
          <div className="lg:col-span-5 space-y-4 flex flex-col h-auto min-h-[400px]">
            <div className="grid grid-cols-2 gap-4 w-full">
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 space-y-2.5" id="engine-controls-panel">
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-[var(--color-accent)]" />
                  Engine Strength
                </h3>

                <div className="flex gap-1">
                  <button
                    onClick={() => { setEngineGoMode('depth'); }}
                    className={`flex items-center gap-1 text-[10px] py-1.5 px-3 rounded-lg font-bold border ${
                      engineGoMode === 'depth'
                        ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                        : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    <Layers className="w-3 h-3" />
                    Depth
                  </button>
                  <button
                    onClick={() => { setEngineGoMode('time'); }}
                    className={`flex items-center gap-1 text-[10px] py-1.5 px-3 rounded-lg font-bold border ${
                      engineGoMode === 'time'
                        ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                        : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    <Timer className="w-3 h-3" />
                    Time per move
                  </button>
                </div>

                {engineGoMode === 'depth' ? (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {ENGINE_DEPTH_PRESETS.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => { handleDepthPreset(p.id, p.depth); }}
                          className={`text-[10px] py-1.5 px-2.5 rounded-lg font-bold border ${
                            engineDepthPreset === p.id
                              ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                              : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)]'
                          }`}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
                      <span>Depth:</span>
                      <input
                        type="range" min={1} max={30}
                        value={engineDepth}
                        onChange={(e) => { setEngineDepth(parseInt(e.target.value, 10)); setEngineDepthPreset('custom'); }}
                        className="flex-1 accent-[var(--color-primary)] h-1 bg-[var(--color-surface)] rounded-lg cursor-pointer"
                      />
                      <span className="font-mono font-bold text-[var(--color-primary)] w-6 text-center">{engineDepth}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
                    <span>Time:</span>
                    <input
                      type="range" min={100} max={30000} step={100}
                      value={engineThinkingTime}
                      onChange={(e) => { setEngineThinkingTime(parseInt(e.target.value, 10)); }}
                      className="flex-1 accent-[var(--color-primary)] h-1 bg-[var(--color-surface)] rounded-lg cursor-pointer"
                    />
                    <span className="font-mono font-bold text-[var(--color-primary)] w-12 text-center">
                      {(engineThinkingTime / 1000).toFixed(1)}s
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 flex flex-col overflow-hidden min-h-[200px] max-h-[300px]" id="pvc-moves-panel">
                <span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider block mb-2">Moves</span>
                <div className="flex-1 overflow-y-auto font-mono text-xs text-white grid grid-cols-2 gap-y-1 content-start pr-1">
                  {moveHistory.length > 0 ? (
                    moveHistory.map((m, idx) => {
                      const isWhite = idx % 2 === 0;
                      const num = Math.floor(idx / 2) + 1;
                      return (
                        <div key={idx} className="flex space-x-1 justify-start">
                          {isWhite && <span className="text-[var(--color-text-muted)] font-bold">{num}.</span>}
                          <span className="font-semibold text-[var(--color-primary)]">{m}</span>
                        </div>
                      );
                    })
                  ) : (
                    <span className="text-[var(--color-text-muted)] text-[10px] col-span-2">Waiting for your first move...</span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-xs text-white bg-[var(--color-surface)] p-2.5 rounded-lg border border-[var(--color-border)] leading-relaxed text-center" id="engine-feedback-banner">
              {engineFeedback || 'Make your move.'}
            </div>

            <button onClick={startNewGame} className="w-full bg-[var(--color-surface)] text-white border border-[var(--color-border)] py-2 rounded-lg text-xs font-bold">
              New Game
            </button>
          </div>
          )}
        </div>
        </div>
      )}
    </div>
  );
}

// ── Player vs Player Feature ──────────────────────────────
function PlayerVsPlayerFeature({ onBack }: { onBack(this: void): void }): React.ReactElement {
  const uiStore = useUIStore();
  const { focusMode, fullscreenMode } = uiStore;
  const fullscreen = useFullscreen();
  const sound = useSound();
  const clockStore = useClockStore();
  const { whiteTime, blackTime, activeColor, isRunning, winner, reason, activePresetId } = clockStore;
  const initialWhiteTime = useClockStore(s => s.initialWhiteTime);
  const initialBlackTime = useClockStore(s => s.initialBlackTime);
  const { settings } = useSettingsStore();

  const [vpW2, setVpW2] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const onResize = (): void => { setVpW2(window.innerWidth); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); };
  }, []);

  const [rcSquares2, setRcSquares2] = useState<string[]>([]);
  const [fen, setFen] = useState(STARTING_FEN);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [autoFlip, setAutoFlip] = useState(false);
  const [perspective, setPerspective] = useState<'white' | 'black'>('white');
  const [gameOver, setGameOver] = useState<string | null>(null);
  const [clockCategory, setClockCategory] = useState(0);
  const [customWhiteMin, setCustomWhiteMin] = useState(5);
  const [customWhiteSec, setCustomWhiteSec] = useState(0);
  const [customBlackMin, setCustomBlackMin] = useState(5);
  const [customBlackSec, setCustomBlackSec] = useState(0);
  const [customInc, setCustomInc] = useState(0);
  const movePendingRef = useRef(false);
  const currentCategoryPresets = PRESET_CATEGORIES[clockCategory].presets;
  let boardWidthTarget = 385;
  if (focusMode) boardWidthTarget = 490;
  else if (fullscreenMode) boardWidthTarget = 593;
  const boardWidth = Math.min(boardWidthTarget, vpW2 - 32);

  // Spacebar for clock turn switching (like Chess Clock feature)
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (winner != null) return;
        if (!isRunning) {
          clockStore.startClock();
        } else if (activeColor) {
          clockStore.switchTurn(activeColor);
          sound.play('clock-tick');
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => { window.removeEventListener('keydown', handler); };
  }, [isRunning, activeColor, winner, clockStore, sound]);

  useEffect(() => {
    let lastTime = Date.now();
    let intervalId: ReturnType<typeof setInterval> | null = null;
    if (isRunning) {
      intervalId = setInterval(() => {
        const now = Date.now();
        const delta = now - lastTime;
        lastTime = now;
        clockStore.tick(delta);
      }, 50);
    }
    return () => { if (intervalId != null) clearInterval(intervalId); };
  }, [isRunning, clockStore]);

  const resetGame = useCallback(() => {
    setFen(STARTING_FEN);
    setMoveHistory([]);
    setPerspective('white');
    setGameOver(null);
    clockStore.resetClock();
  }, [clockStore]);

  const handleMove = useCallback((from: string, to: string) => {
    if (movePendingRef.current) return;
    movePendingRef.current = true;
    try {
      const fresh = new Chess(fen);
      const rawMove = fresh.move({ from, to, promotion: 'q' });
      setFen(fresh.fen());
      setMoveHistory(prev => [...prev, rawMove.san]);
      sound.playFromSan(rawMove.san);

      if (isRunning && activeColor) {
        clockStore.switchTurn(activeColor);
        sound.play('clock-tick');
      }

      if (fresh.isGameOver()) {
        let msg = '';
        if (fresh.isCheckmate()) msg = `Checkmate! ${fresh.turn() === 'w' ? 'Black' : 'White'} wins!`;
        else if (fresh.isDraw()) msg = 'Draw!';
        else if (fresh.isStalemate()) msg = 'Stalemate!';
        setGameOver(msg);
        sound.playGameEnd(msg);
        movePendingRef.current = false;
        return;
      }

      if (autoFlip) {
        setPerspective(fresh.turn() === 'w' ? 'white' : 'black');
      }
    } catch {
      console.warn('Invalid move');
    }
    movePendingRef.current = false;
  }, [fen, autoFlip, sound, isRunning, activeColor, clockStore]);

  const isInAlert = (timeMs: number): boolean =>
    settings.timeAlertEnabled && timeMs > 0 && timeMs <= settings.timeAlertThreshold * 1000;

  const formatClockTime = (timeMs: number): string => {
    const minutes = Math.floor(timeMs / 60000);
    const seconds = Math.floor((timeMs % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const renderWhiteClockClass = (): string => {
    if (isInAlert(whiteTime)) return 'bg-[#8b1a1a] border-[#ff4444]';
    if (activeColor === 'w' && isRunning) return 'bg-[var(--color-surface)] border-[var(--color-primary)]';
    return 'bg-[var(--color-surface)] border-[var(--color-border)]';
  };

  const renderBlackClockClass = (): string => {
    if (isInAlert(blackTime)) return 'bg-[#8b1a1a] border-[#ff4444]';
    if (activeColor === 'b' && isRunning) return 'bg-[var(--color-surface)] border-[var(--color-primary)]';
    return 'bg-[var(--color-surface)] border-[var(--color-border)]';
  };

  const handlePresetClick = (pId: string): void => {
    clockStore.selectPreset(pId);
    setClockCategory(PRESET_CATEGORIES.findIndex((cat) =>
      cat.presets.some((pp) => pp.id === pId)
    ));
  };

  return (
    <div className="space-y-4" id="player-vs-player-feature">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-text-muted)] hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Tools</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setAutoFlip(!autoFlip); }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border ${
              autoFlip
                ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)]'
            }`}
            title="Auto-flip board to the current player's perspective"
          >
            <FlipHorizontal className="w-3 h-3" />
            <span>Auto-Flip</span>
          </button>
          <button
            onClick={() => { uiStore.toggleFocusMode(); }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border ${
              focusMode
                ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)]'
            }`}
            title="Toggle focus mode (Z)"
          >
            <Focus className="w-3 h-3" />
            <span>Focus</span>
          </button>
          <button
            onClick={() => { void fullscreen.toggleFullscreen(); }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)]"
            title="Toggle fullscreen (F11)"
          >
            <Maximize className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className={fullscreenMode ? 'flex justify-center items-center min-h-[80vh]' : ''}>
      <div className={focusMode ? 'flex flex-row justify-center items-center gap-6' : 'grid grid-cols-1 gap-5 lg:grid-cols-12'}>
        {/* Left: Board + Turn indicator */}
        <div className={`space-y-3 flex flex-col items-center ${focusMode ? '' : 'lg:col-span-7'}`}>
          <div className="flex w-full gap-3" style={{ maxWidth: boardWidth }}>
            <div className="flex-1">
              <Chessboard
                fen={fen}
                playable={gameOver == null}
                onMove={handleMove}
                orientation={autoFlip ? perspective : undefined}
                rightClickedSquares={rcSquares2}
                onSquareRightClick={(sq) => {
                  setRcSquares2(prev =>
                    prev.includes(sq) ? [] : [...prev, sq]
                  );
                }}
                onLeftClick={() => { setRcSquares2([]); }}
              />
            </div>
          </div>
          {gameOver != null ? (
            <div className="w-full text-center text-sm font-bold text-[var(--color-accent)] bg-[var(--color-surface)] border border-[var(--color-accent)] rounded-lg py-2" style={{ maxWidth: boardWidth }}>
              {gameOver}
            </div>
          ) : (
            <div className="w-full flex items-center justify-between" style={{ maxWidth: boardWidth }}>
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <span className={`w-2.5 h-2.5 rounded-full ${fen.includes(' w ') ? 'bg-white border border-[#888]' : 'bg-[var(--color-surface)] border border-[#888]'}`} />
                <span className="font-bold">
                  {fen.includes(' w ') ? "White's turn" : "Black's turn"}
                </span>
              </div>
              <button
                onClick={() => { setPerspective(perspective === 'white' ? 'black' : 'white'); }}
                className="text-[10px] text-[var(--color-text-muted)] font-bold hover:text-white transition-colors"
              >
                <RotateCcw className="w-3 h-3 inline mr-1" />
                Flip board
              </button>
            </div>
          )}
        </div>

        {/* Right: Controls */}
        {!focusMode && (
        <div className="lg:col-span-5 space-y-4 flex flex-col h-auto min-h-[400px]">
          <div className="grid grid-cols-2 gap-4 w-full">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 space-y-2.5 text-center" id="pvp-settings-card">
              <h3 className="text-xs font-bold text-white flex items-center justify-center gap-1.5">
                <Users className="w-4 h-4 text-[var(--color-accent)]" />
                Local Two-Player
              </h3>
              <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed">
                White moves first, then Black.
              </p>
              <label className="flex items-center justify-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoFlip}
                  onChange={() => { setAutoFlip(!autoFlip); }}
                  className="accent-[var(--color-primary)] w-4 h-4 rounded"
                />
                <span className="text-xs text-white font-medium">Auto-flip</span>
              </label>
            </div>

            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 flex flex-col overflow-hidden min-h-[200px] max-h-[300px]" id="pvp-moves-panel">
              <span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider block mb-2">Moves</span>
              <div className="flex-1 overflow-y-auto font-mono text-xs text-white grid grid-cols-2 gap-y-1 content-start pr-1">
                {moveHistory.length > 0 ? (
                  moveHistory.map((m, idx) => {
                    const isWhite = idx % 2 === 0;
                    const num = Math.floor(idx / 2) + 1;
                    return (
                      <div key={idx} className="flex space-x-1 justify-start">
                        {isWhite && <span className="text-[var(--color-text-muted)] font-bold">{num}.</span>}
                        <span className={`font-semibold ${isWhite ? 'text-white' : 'text-[var(--color-primary)]'}`}>{m}</span>
                      </div>
                    );
                  })
                ) : (
                  <span className="text-[var(--color-text-muted)] text-[10px] col-span-2">White to move...</span>
                )}
              </div>
            </div>
          </div>

          {/* Mini Chess Clock */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3" id="pvp-clock-widget">
            <div className="flex gap-2 mb-2">
              <div
                className={`flex-1 rounded-lg border p-2 text-center relative overflow-hidden ${renderWhiteClockClass()}`}
              >
                {winner != null && whiteTime === 0 && (
                  <svg className="absolute top-1 right-1 w-3.5 h-3.5 text-red-500 flag-fall" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="4" y1="2" x2="4" y2="22" />
                    <polyline points="4,6 20,6 18,10 20,14 4,14" />
                  </svg>
                )}
                <div className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded bg-white border border-[var(--color-text-muted)]" />
                  White
                </div>
                <div className="text-lg font-mono font-black tracking-tighter text-white">
                  {formatClockTime(whiteTime)}
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-border)]">
                  <div
                    className="h-full bg-[var(--color-primary)] transition-all duration-200 ease-linear"
                    style={{ width: `${Math.max(0, (initialWhiteTime > 0 ? whiteTime / initialWhiteTime : 1) * 100)}%` }}
                  />
                </div>
              </div>
              <div
                className={`flex-1 rounded-lg border p-2 text-center relative overflow-hidden ${renderBlackClockClass()}`}
              >
                {winner != null && blackTime === 0 && (
                  <svg className="absolute top-1 right-1 w-3.5 h-3.5 text-red-500 flag-fall" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="4" y1="2" x2="4" y2="22" />
                    <polyline points="4,6 20,6 18,10 20,14 4,14" />
                  </svg>
                )}
                <div className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded bg-[var(--color-surface)] border border-[var(--color-text-muted)]" />
                  Black
                </div>
                <div className="text-lg font-mono font-black tracking-tighter text-white">
                  {formatClockTime(blackTime)}
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-border)]">
                  <div
                    className="h-full bg-[var(--color-primary)] transition-all duration-200 ease-linear"
                    style={{ width: `${Math.max(0, (initialBlackTime > 0 ? blackTime / initialBlackTime : 1) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
            {winner != null && (
              <div className={`text-[9px] font-bold p-1.5 rounded-lg border mb-2 text-center ${
                winner === 'w' ? 'bg-[var(--color-surface)] border-[var(--color-primary)] text-[var(--color-primary)]' : 'bg-[var(--color-surface)] border-[var(--color-accent)] text-[var(--color-accent)]'
              }`}>
                {winner === 'w' ? 'White wins' : 'Black wins'} via {reason}
              </div>
            )}
            <div className="flex items-center justify-center gap-1 mb-2">
              {!isRunning ? (
                <button onClick={() => { clockStore.startClock(); }} disabled={winner != null} className="bg-[var(--color-primary)] text-white px-3 py-1.5 rounded text-[9px] font-bold disabled:opacity-50">
                  Start
                </button>
              ) : (
                <button onClick={() => { clockStore.pauseClock(); }} className="bg-[var(--color-accent)] text-white px-3 py-1.5 rounded text-[9px] font-bold">
                  Stop
                </button>
              )}
              <button onClick={() => { clockStore.resetClock(); }} className="bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] px-2 py-1.5 rounded text-[9px] font-bold flex items-center" title="Reset clock" aria-label="Reset clock">
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
            <div className="flex gap-1 mb-2">
              {PRESET_CATEGORIES.map((cat, idx) => (
                <button
                  key={cat.name}
                  onClick={() => { setClockCategory(idx); }}
                  className={`text-[9px] py-1 px-2 rounded font-bold ${
                    clockCategory === idx
                      ? 'bg-[var(--color-surface)] text-[var(--color-primary)] border border-[var(--color-primary)]'
                      : 'text-[var(--color-text-muted)] border border-transparent'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            {clockCategory === PRESET_CATEGORIES.length - 1 ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-bold text-[var(--color-text-muted)] block mb-1">White Time</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min="0" max="999"
                        value={customWhiteMin}
                        onChange={(e) => { setCustomWhiteMin(Math.max(0, parseInt(e.target.value) || 0)); }}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-1.5 py-1 text-[10px] text-white font-mono text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        placeholder="min"
                      />
                      <span className="text-[var(--color-text-muted)] text-[10px] font-bold">:</span>
                      <input
                        type="number" min="0" max="59"
                        value={customWhiteSec}
                        onChange={(e) => { setCustomWhiteSec(Math.min(59, Math.max(0, parseInt(e.target.value) || 0))); }}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-1.5 py-1 text-[10px] text-white font-mono text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        placeholder="sec"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-[var(--color-text-muted)] block mb-1">Black Time</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min="0" max="999"
                        value={customBlackMin}
                        onChange={(e) => { setCustomBlackMin(Math.max(0, parseInt(e.target.value) || 0)); }}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-1.5 py-1 text-[10px] text-white font-mono text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        placeholder="min"
                      />
                      <span className="text-[var(--color-text-muted)] text-[10px] font-bold">:</span>
                      <input
                        type="number" min="0" max="59"
                        value={customBlackSec}
                        onChange={(e) => { setCustomBlackSec(Math.min(59, Math.max(0, parseInt(e.target.value) || 0))); }}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-1.5 py-1 text-[10px] text-white font-mono text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        placeholder="sec"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-[9px] font-bold text-[var(--color-text-muted)] block mb-1">Increment (sec)</label>
                    <input
                      type="number" min="0" max="999"
                      value={customInc}
                      onChange={(e) => { setCustomInc(Math.max(0, parseInt(e.target.value) || 0)); }}
                      className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-1.5 py-1 text-[10px] text-white font-mono text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      placeholder="sec"
                    />
                  </div>
                  <button
                    onClick={() => {
                      const whiteMs = (customWhiteMin * 60 + customWhiteSec) * 1000;
                      const blackMs = (customBlackMin * 60 + customBlackSec) * 1000;
                      clockStore.setCustomTime(whiteMs, blackMs, customInc);
                    }}
                    className="bg-[var(--color-primary)] text-white px-4 py-1.5 rounded text-[9px] font-bold"
                  >
                    Apply
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {currentCategoryPresets.map((p) => {
                  const active = activePresetId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => { handlePresetClick(p.id); }}
                      className={`text-[9px] py-1 rounded border text-center font-bold font-mono ${
                        active
                          ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                          : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)]'
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button onClick={resetGame} className="w-full bg-[var(--color-surface)] text-white border border-[var(--color-border)] py-2 rounded-lg text-xs font-bold">
            New Game
          </button>
        </div>
        )}
      </div>
      </div>
    </div>
  );
}

// ── Chess Clock Feature ───────────────────────────────────
function ChessClockFeature({ onBack }: { onBack(this: void): void }): React.ReactElement {
  const clockStore = useClockStore();
  const { whiteTime, blackTime, activeColor, isRunning, winner, reason, activePresetId } = clockStore;
  const { focusMode, fullscreenMode } = useUIStore();
  const fullscreen = useFullscreen();
  const { settings } = useSettingsStore();
  const sound = useSound();
  const [clockCategory, setClockCategory] = useState(0);
  const [customWhiteMin, setCustomWhiteMin] = useState(5);
  const [customWhiteSec, setCustomWhiteSec] = useState(0);
  const [customBlackMin, setCustomBlackMin] = useState(5);
  const [customBlackSec, setCustomBlackSec] = useState(0);
  const [customInc, setCustomInc] = useState(0);
  const whiteAlertedRef = useRef(false);
  const blackAlertedRef = useRef(false);
  const initialWhiteTime = useClockStore(s => s.initialWhiteTime);
  const initialBlackTime = useClockStore(s => s.initialBlackTime);
  const whiteFlagFallen = winner != null && (winner === 'b' || winner === 'draw') && whiteTime === 0;
  const blackFlagFallen = winner != null && (winner === 'w' || winner === 'draw') && blackTime === 0;
  const whiteProgress = initialWhiteTime > 0 ? whiteTime / initialWhiteTime : 1;
  const blackProgress = initialBlackTime > 0 ? blackTime / initialBlackTime : 1;

  useEffect(() => {
    if (!settings.timeAlertEnabled) return;
    if (whiteTime > 0 && whiteTime <= settings.timeAlertThreshold * 1000 && !whiteAlertedRef.current) {
      whiteAlertedRef.current = true;
      if (settings.timeAlertSound) sound.play('tenseconds');
    }
    if (blackTime > 0 && blackTime <= settings.timeAlertThreshold * 1000 && !blackAlertedRef.current) {
      blackAlertedRef.current = true;
      if (settings.timeAlertSound) sound.play('tenseconds');
    }
    if (whiteTime > settings.timeAlertThreshold * 1000) whiteAlertedRef.current = false;
    if (blackTime > settings.timeAlertThreshold * 1000) blackAlertedRef.current = false;
  }, [whiteTime, blackTime, settings.timeAlertEnabled, settings.timeAlertThreshold, settings.timeAlertSound, sound]);

  const isInAlert = (timeMs: number): boolean =>
    settings.timeAlertEnabled && timeMs > 0 && timeMs <= settings.timeAlertThreshold * 1000;

  const formatTimeWithAlert = (timeMs: number): string => {
    const minutes = Math.floor(timeMs / 60000);
    const seconds = Math.floor((timeMs % 60000) / 1000);
    const tenths = Math.floor((timeMs % 1000) / 100);
    const minStr = minutes.toString().padStart(2, '0');
    const secStr = seconds.toString().padStart(2, '0');
    if (isInAlert(timeMs) && timeMs < 60000) {
      return `${minStr}:${secStr}.${tenths}`;
    }
    if (timeMs < 20000 && timeMs > 0) {
      return `${minutes}:${secStr}.${tenths}`;
    }
    return `${minStr}:${secStr}`;
  };

  useEffect(() => {
    let lastTime = Date.now();
    let intervalId: ReturnType<typeof setInterval> | null = null;
    if (isRunning) {
      intervalId = setInterval(() => {
        const now = Date.now();
        const delta = now - lastTime;
        lastTime = now;
        clockStore.tick(delta);
      }, 50);
    }
    return () => { if (intervalId != null) clearInterval(intervalId); };
  }, [isRunning, clockStore]);

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (winner != null) return;
        if (!isRunning) {
          clockStore.startClock();
        } else if (activeColor) {
          clockStore.switchTurn(activeColor);
          sound.play('clock-tick');
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => { window.removeEventListener('keydown', handler); };
  }, [isRunning, activeColor, winner, clockStore, sound]);

  const currentCategoryPresets = PRESET_CATEGORIES[clockCategory].presets;

  const getWhiteClockClass = (): string => {
    if (isInAlert(whiteTime)) return 'bg-[#8b1a1a] border-[#ff4444]';
    if (activeColor === 'w' && isRunning) return 'bg-[var(--color-surface)] border-[var(--color-primary)]';
    return 'bg-[var(--color-surface)] border-[var(--color-border)] opacity-60 disabled:cursor-not-allowed';
  };

  const getBlackClockClass = (): string => {
    if (isInAlert(blackTime)) return 'bg-[#8b1a1a] border-[#ff4444]';
    if (activeColor === 'b' && isRunning) return 'bg-[var(--color-surface)] border-[var(--color-primary)]';
    return 'bg-[var(--color-surface)] border-[var(--color-border)] opacity-60 disabled:cursor-not-allowed';
  };

  const handleChessPresetClick = (pId: string): void => {
    clockStore.selectPreset(pId);
    setClockCategory(PRESET_CATEGORIES.findIndex((cat) =>
      cat.presets.some((pp) => pp.id === pId)
    ));
  };

  return (
    <div className="space-y-4" id="chess-clock-feature">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-text-muted)] hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Tools</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] bg-[var(--color-surface)] px-2 py-1 rounded">
            {activePresetId === 'custom' ? 'Custom' : activePresetId}
          </span>
          <button
            onClick={() => { void fullscreen.toggleFullscreen(); }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)]"
            title="Toggle fullscreen (F11)"
          >
            <Maximize className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className={fullscreenMode ? 'flex justify-center items-center min-h-[80vh]' : ''}>
      <div className="flex flex-col items-center overflow-visible">
        <div className={`bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 ${focusMode ? '' : 'max-w-md w-full'} ${fullscreenMode ? 'scale-[1.7] transform-gpu origin-center' : ''}`}>
          <div className="grid grid-rows-2 gap-3" id="clock-sides">
            <button
              onClick={() => { clockStore.switchTurn('w'); sound.play('clock-tick'); }}
              disabled={!isRunning || activeColor !== 'w'}
              className={`rounded-2xl border flex flex-col items-center justify-center p-4 relative overflow-hidden ${getWhiteClockClass()}`}
              id="clock-side-white"
            >
              {whiteFlagFallen && (
                <svg className="absolute top-2 right-2 w-5 h-5 text-red-500 flag-fall" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="4" y1="2" x2="4" y2="22" />
                  <polyline points="4,6 20,6 18,10 20,14 4,14" />
                </svg>
              )}
              <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-white border border-[var(--color-text-muted)]" />
                White
              </div>
              <span className={`text-4xl font-mono font-black tracking-tighter ${activeColor === 'w' ? 'text-[var(--color-primary)]' : 'text-white'}`}>
                {formatTimeWithAlert(whiteTime)}
              </span>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--color-border)]">
                <div
                  className="h-full bg-[var(--color-primary)] transition-all duration-200 ease-linear"
                  style={{ width: `${Math.max(0, whiteProgress * 100)}%` }}
                />
              </div>
            </button>

            <button
              onClick={() => { clockStore.switchTurn('b'); sound.play('clock-tick'); }}
              disabled={!isRunning || activeColor !== 'b'}
              className={`rounded-2xl border flex flex-col items-center justify-center p-4 relative overflow-hidden ${getBlackClockClass()}`}
              id="clock-side-black"
            >
              {blackFlagFallen && (
                <svg className="absolute top-2 right-2 w-5 h-5 text-red-500 flag-fall" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="4" y1="2" x2="4" y2="22" />
                  <polyline points="4,6 20,6 18,10 20,14 4,14" />
                </svg>
              )}
              <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-[var(--color-surface)] border border-[var(--color-text-muted)]" />
                Black
              </div>
              <span className={`text-4xl font-mono font-black tracking-tighter ${activeColor === 'b' ? 'text-[var(--color-primary)]' : 'text-white'}`}>
                {formatTimeWithAlert(blackTime)}
              </span>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--color-border)]">
                <div
                  className="h-full bg-[var(--color-primary)] transition-all duration-200 ease-linear"
                  style={{ width: `${Math.max(0, blackProgress * 100)}%` }}
                />
              </div>
            </button>
          </div>

          {winner != null && (
            <div className={`text-xs font-bold p-2 rounded-xl border mt-3 ${
              winner === 'w' ? 'bg-[var(--color-surface)] border-[var(--color-primary)] text-[var(--color-primary)]' : 'bg-[var(--color-surface)] border-[var(--color-accent)] text-[var(--color-accent)]'
            }`} id="clock-winner-banner">
              {winner === 'w' ? 'White wins' : 'Black wins'} via {reason}
            </div>
          )}

          <div className="flex gap-2 mt-3">
            {!isRunning ? (
              <button onClick={() => { clockStore.startClock(); }} disabled={winner != null} className="flex-1 bg-[var(--color-primary)] text-white py-2.5 rounded-lg flex items-center justify-center space-x-1.5 font-bold text-xs disabled:opacity-50" id="clock-start-btn">
                <Play className="w-4 h-4" />
                <span>Start</span>
              </button>
            ) : (
              <button onClick={() => { clockStore.pauseClock(); }} className="flex-1 bg-[var(--color-accent)] text-white py-2.5 rounded-lg flex items-center justify-center space-x-1.5 font-bold text-xs" id="clock-pause-btn">
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </button>
            )}
            <button onClick={() => { clockStore.resetClock(); }} className="px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-muted)] flex items-center justify-center" title="Reset" id="clock-reset-btn">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {!focusMode && (
          <div className="mt-4">
            <div className="text-center text-[9px] text-[var(--color-text-muted)] font-mono mb-2">
              Press <span className="text-[var(--color-text-muted)] bg-[var(--color-surface)] px-1.5 py-0.5 rounded font-bold">Space</span> to switch turns
            </div>
          <div className="pt-4 border-t border-[var(--color-border)]">
            <div className="flex gap-1 mb-2">
              {PRESET_CATEGORIES.map((cat, idx) => (
                <button
                  key={cat.name}
                  onClick={() => { setClockCategory(idx); }}
                  className={`text-[10px] py-1.5 px-3 rounded-lg font-bold ${
                    clockCategory === idx
                      ? 'bg-[var(--color-surface)] text-[var(--color-primary)] border border-[var(--color-primary)]'
                      : 'text-[var(--color-text-muted)] border border-transparent'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            {clockCategory === PRESET_CATEGORIES.length - 1 ? (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-[var(--color-text-muted)] block mb-1.5">White Time</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min="0" max="999"
                        value={customWhiteMin}
                        onChange={(e) => { setCustomWhiteMin(Math.max(0, parseInt(e.target.value) || 0)); }}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-white font-mono text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        placeholder="min"
                      />
                      <span className="text-[var(--color-text-muted)] text-xs font-bold">:</span>
                      <input
                        type="number" min="0" max="59"
                        value={customWhiteSec}
                        onChange={(e) => { setCustomWhiteSec(Math.min(59, Math.max(0, parseInt(e.target.value) || 0))); }}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-white font-mono text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        placeholder="sec"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[var(--color-text-muted)] block mb-1.5">Black Time</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min="0" max="999"
                        value={customBlackMin}
                        onChange={(e) => { setCustomBlackMin(Math.max(0, parseInt(e.target.value) || 0)); }}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-white font-mono text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        placeholder="min"
                      />
                      <span className="text-[var(--color-text-muted)] text-xs font-bold">:</span>
                      <input
                        type="number" min="0" max="59"
                        value={customBlackSec}
                        onChange={(e) => { setCustomBlackSec(Math.min(59, Math.max(0, parseInt(e.target.value) || 0))); }}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-white font-mono text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        placeholder="sec"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-[var(--color-text-muted)] block mb-1.5">Increment (sec)</label>
                    <input
                      type="number" min="0" max="999"
                      value={customInc}
                      onChange={(e) => { setCustomInc(Math.max(0, parseInt(e.target.value) || 0)); }}
                      className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-white font-mono text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      placeholder="sec"
                    />
                  </div>
                  <button
                    onClick={() => {
                      const whiteMs = (customWhiteMin * 60 + customWhiteSec) * 1000;
                      const blackMs = (customBlackMin * 60 + customBlackSec) * 1000;
                      clockStore.setCustomTime(whiteMs, blackMs, customInc);
                    }}
                    className="bg-[var(--color-primary)] text-white px-5 py-2 rounded-lg text-xs font-bold hover:bg-[var(--color-primary)] transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {currentCategoryPresets.map((p) => {
                  const active = activePresetId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => { handleChessPresetClick(p.id); }}
                      className={`text-[10px] py-1.5 rounded-lg border text-center font-bold font-mono ${
                        active
                          ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                          : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)]'
                      }`}
                      id={`preset-btn-${p.id}`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          </div>
          )}
        </div>
      </div>
      </div>
      </div>
  );
}

export default function Tools(): React.ReactElement {
  const [activeFeature, setActiveFeature] = useState<ActiveFeature>(null);
  const fullscreen = useFullscreen();

  useKeyboardShortcuts([
    {
      key: 'z',
      description: 'Toggle focus mode',
      handler: () => { useUIStore.getState().toggleFocusMode(); },
    },
    {
      key: 'F11',
      description: 'Toggle fullscreen',
      handler: () => { void fullscreen.toggleFullscreen(); },
    },
    {
      key: 'Escape',
      description: 'Back to tools grid',
      handler: () => {
        if (activeFeature) {
          destroyEngine();
          setActiveFeature(null);
        }
      },
    },
  ]);

  return (
    <div>
      {activeFeature === null && <ToolsLanding onSelect={setActiveFeature} />}
      {activeFeature === 'play-vs-computer' && <PlayVsComputerFeature onBack={() => { setActiveFeature(null); }} />}
      {activeFeature === 'player-vs-player' && <PlayerVsPlayerFeature onBack={() => { setActiveFeature(null); }} />}
      {activeFeature === 'chess-clock' && <ChessClockFeature onBack={() => { setActiveFeature(null); }} />}
    </div>
  );
}
