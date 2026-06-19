import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import {
  Play,
  Pause,
  RotateCcw,
  Clock,
  Gamepad2,
  Cpu,
  Timer,
  Layers,
} from 'lucide-react';
import { useClockStore } from '../stores/clockStore';
import { useSettingsStore } from '../stores/settingsStore';
import { analyzePositionLocally, destroyEngine } from '../lib/engine/legacy';
import Chessboard from '../components/board/Chessboard';
import { useSound, getSoundTypeFromSan } from '../hooks/useSound';
import type { EngineGoMode } from '../types';

interface PresetCategory {
  name: string;
  presets: { id: string; name: string }[];
}

const presetCategories: PresetCategory[] = [
  {
    name: 'Bullet',
    presets: [
      { id: 'bullet-1-0', name: '1+0' },
      { id: 'bullet-1-1', name: '1+1' },
      { id: 'bullet-2-1', name: '2+1' },
    ],
  },
  {
    name: 'Blitz',
    presets: [
      { id: 'blitz-3-0', name: '3+0' },
      { id: 'blitz-3-2', name: '3+2' },
      { id: 'blitz-3-15', name: '3+15' },
      { id: 'blitz-5-0', name: '5+0' },
    ],
  },
  {
    name: 'Rapid',
    presets: [
      { id: 'rapid-10-0', name: '10+0' },
      { id: 'rapid-10-5', name: '10+5' },
      { id: 'rapid-15-10', name: '15+10' },
    ],
  },
  {
    name: 'Classic',
    presets: [
      { id: 'classic-30-0', name: '30+0' },
      { id: 'classic-30-20', name: '30+20' },
      { id: 'classic-60-0', name: '60+0' },
    ],
  },
];

const engineDepthPresets = [
  { id: 'beginner', name: 'Beginner', depth: 4 },
  { id: 'intermediate', name: 'Intermediate', depth: 8 },
  { id: 'advanced', name: 'Advanced', depth: 12 },
  { id: 'expert', name: 'Expert', depth: 18 },
];

const formatTime = (timeMs: number) => {
  const minutes = Math.floor(timeMs / 60000);
  const seconds = Math.floor((timeMs % 60000) / 1000);
  const tenths = Math.floor((timeMs % 1000) / 100);
  const minStr = minutes.toString().padStart(2, '0');
  const secStr = seconds.toString().padStart(2, '0');
  if (timeMs < 20000 && timeMs > 0) {
    return `${minutes}:${secStr}.${tenths}`;
  }
  return `${minStr}:${secStr}`;
};

export default function Tools() {
  const {
    whiteTime,
    blackTime,
    activeColor,
    isRunning,
    winner,
    reason,
    presets,
    activePresetId,
    selectPreset,
    startClock,
    pauseClock,
    resetClock,
    switchTurn,
    tick,
  } = useClockStore();

  const { settings } = useSettingsStore();
  const { play, playFromSan, playGameEnd } = useSound();
  const [clockCategory, setClockCategory] = useState(0);
  const [playVsEngineMode, setPlayVsEngineMode] = useState(false);
  const [engineGame, setEngineGame] = useState<Chess | null>(null);
  const [engineFen, setEngineFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [engineDepth, setEngineDepth] = useState(8);
  const [engineDepthPreset, setEngineDepthPreset] = useState('intermediate');
  const [engineGoMode, setEngineGoMode] = useState<EngineGoMode>('depth');
  const [engineThinkingTime, setEngineThinkingTime] = useState(2000);
  const [engineThinking, setEngineThinking] = useState(false);
  const [engineGameHistory, setEngineGameHistory] = useState<string[]>([]);
  const [engineFeedback, setEngineFeedback] = useState('');

  useEffect(() => {
    let lastTime = Date.now();
    let intervalId: any = null;
    if (isRunning) {
      intervalId = setInterval(() => {
        const now = Date.now();
        const delta = now - lastTime;
        lastTime = now;
        tick(delta);
      }, 50);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isRunning, tick]);

  const prevLowTimeRef = React.useRef(false);
  useEffect(() => {
    const lowTime = (whiteTime > 0 && whiteTime <= 10000) || (blackTime > 0 && blackTime <= 10000);
    if (lowTime && !prevLowTimeRef.current) {
      play('tenseconds');
    }
    prevLowTimeRef.current = lowTime;
  }, [whiteTime, blackTime, play]);

  const prevWinnerRef = React.useRef(winner);
  useEffect(() => {
    if (winner && !prevWinnerRef.current) {
      playGameEnd(winner === 'w' ? '1-0' : '0-1');
    }
    prevWinnerRef.current = winner;
  }, [winner, playGameEnd]);

  const startNewEngineGame = () => {
    const freshGame = new Chess();
    setEngineGame(freshGame);
    setEngineFen(freshGame.fen());
    setEngineGameHistory([]);
    setEngineFeedback('Game started. Make your move.');
    setEngineThinking(false);
    play('game-start');
  };

  const handlePlayerMoveInEngineMode = async (from: string, to: string) => {
    if (!engineGame || engineThinking) return;
    try {
      const rawMove = engineGame.move({ from, to, promotion: 'q' });
      setEngineFen(engineGame.fen());
      setEngineGameHistory([...engineGameHistory, rawMove.san]);
      playFromSan(rawMove.san);
      setEngineFeedback('Engine is thinking...');

      if (engineGame.isGameOver()) {
        announceGameEnd(engineGame);
        return;
      }

      setEngineThinking(true);
      const computedMoveResult = await analyzePositionLocally(engineGame.fen(), {
        goMode: engineGoMode,
        depth: engineDepth,
        timeLimit: engineThinkingTime,
      });

      const legalComputerMoves = engineGame.moves({ verbose: true });
      if (legalComputerMoves.length > 0) {
        const bestSan = computedMoveResult.bestMove;
        const bestVerbose = bestSan
          ? legalComputerMoves.find(m => m.san === bestSan)
          : null;
        const selectedMove = bestVerbose || legalComputerMoves[Math.floor(Math.random() * legalComputerMoves.length)];
        engineGame.move(selectedMove.san);
        setEngineFen(engineGame.fen());
        setEngineGameHistory(prev => [...prev, selectedMove.san]);
        playFromSan(selectedMove.san);
        setEngineFeedback(`Engine plays ${selectedMove.san}. Your turn.`);

        if (engineGame.isGameOver()) {
          announceGameEnd(engineGame);
        }
      }
      setEngineThinking(false);
    } catch (err: any) {
      setEngineFeedback('Illegal move.');
    }
  };

  const announceGameEnd = (game: Chess) => {
    if (game.isCheckmate()) {
      setEngineFeedback('Checkmate!');
      playGameEnd(game.isCheckmate() ? (game.turn() === 'w' ? '0-1' : '1-0') : '');
    } else if (game.isDraw()) {
      setEngineFeedback('Draw!');
      play('game-draw');
    } else {
      setEngineFeedback('Game over.');
      play('gameend');
    }
  };

  const handleDepthPreset = (presetId: string, depth: number) => {
    setEngineDepthPreset(presetId);
    setEngineDepth(depth);
  };

  const currentCategoryPresets = presetCategories[clockCategory]?.presets || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" id="tools-view">
      <div className="lg:col-span-5 bg-[#333333] border border-[#4a4a4a] rounded-2xl p-5 flex flex-col" id="clock-panel">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-extrabold text-white flex items-center space-x-2">
            <Clock className="w-5 h-5 text-[#bc6c25]" />
            <span>Chess Clock</span>
          </h2>
          <span className="text-[10px] uppercase font-bold text-[#a0a0a0] bg-[#3d3d3d] px-2 py-1 rounded">
            {activePresetId === 'custom' ? 'Custom' : activePresetId}
          </span>
        </div>

        <div className="grid grid-rows-2 gap-3 flex-1" id="clock-sides">
          <button
            onClick={() => switchTurn('w')}
            disabled={!isRunning || activeColor !== 'w'}
            className={`rounded-2xl border flex flex-col items-center justify-center p-4 ${
              activeColor === 'w' && isRunning
                ? 'bg-[#3d3d3d] border-[#606c38]'
                : 'bg-[#2a2a2a] border-[#4a4a4a] opacity-60 disabled:cursor-not-allowed'
            }`}
            id="clock-side-white"
          >
            <div className="text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded bg-white border border-[#a0a0a0]" />
              White
            </div>
            <span className={`text-4xl font-mono font-black tracking-tighter ${activeColor === 'w' ? 'text-[#606c38]' : 'text-white'}`}>
              {formatTime(whiteTime)}
            </span>
          </button>

          <button
            onClick={() => switchTurn('b')}
            disabled={!isRunning || activeColor !== 'b'}
            className={`rounded-2xl border flex flex-col items-center justify-center p-4 ${
              activeColor === 'b' && isRunning
                ? 'bg-[#3d3d3d] border-[#606c38]'
                : 'bg-[#2a2a2a] border-[#4a4a4a] opacity-60 disabled:cursor-not-allowed'
            }`}
            id="clock-side-black"
          >
            <div className="text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded bg-[#2a2a2a] border border-[#888888]" />
              Black
            </div>
            <span className={`text-4xl font-mono font-black tracking-tighter ${activeColor === 'b' ? 'text-[#606c38]' : 'text-white'}`}>
              {formatTime(blackTime)}
            </span>
          </button>
        </div>

        {winner && (
          <div className={`text-xs font-bold p-2 rounded-xl border mt-3 ${
            winner === 'w' ? 'bg-[#3d3d3d] border-[#606c38] text-[#606c38]' : 'bg-[#3d3d3d] border-[#bc6c25] text-[#bc6c25]'
          }`} id="clock-winner-banner">
            {winner === 'w' ? 'White wins' : 'Black wins'} via {reason}
          </div>
        )}

        <div className="flex gap-2 mt-3">
          {!isRunning ? (
            <button onClick={startClock} disabled={!!winner} className="flex-1 bg-[#606c38] text-white py-2.5 rounded-lg flex items-center justify-center space-x-1.5 font-bold text-xs disabled:opacity-50" id="clock-start-btn">
              <Play className="w-4 h-4" />
              <span>Start</span>
            </button>
          ) : (
            <button onClick={pauseClock} className="flex-1 bg-[#bc6c25] text-white py-2.5 rounded-lg flex items-center justify-center space-x-1.5 font-bold text-xs" id="clock-pause-btn">
              <Pause className="w-4 h-4" />
              <span>Pause</span>
            </button>
          )}
          <button onClick={resetClock} className="px-4 py-2.5 bg-[#3d3d3d] border border-[#4a4a4a] rounded-lg text-[#a0a0a0] flex items-center justify-center" title="Reset" id="clock-reset-btn">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-[#4a4a4a]">
          <div className="flex gap-1 mb-2">
            {presetCategories.map((cat, idx) => (
              <button
                key={cat.name}
                onClick={() => setClockCategory(idx)}
                className={`text-[10px] py-1.5 px-3 rounded-lg font-bold ${
                  clockCategory === idx
                    ? 'bg-[#3d3d3d] text-[#606c38] border border-[#606c38]'
                    : 'text-[#a0a0a0] border border-transparent'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {currentCategoryPresets.map((p) => {
              const active = activePresetId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    selectPreset(p.id);
                    setClockCategory(presetCategories.findIndex((cat) =>
                      cat.presets.some((pp) => pp.id === p.id)
                    ));
                  }}
                  className={`text-[10px] py-1.5 rounded-lg border text-center font-bold font-mono ${
                    active
                      ? 'bg-[#606c38] text-white border-[#606c38]'
                      : 'bg-[#2a2a2a] border-[#4a4a4a] text-[#a0a0a0]'
                  }`}
                  id={`preset-btn-${p.id}`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="lg:col-span-7 bg-[#333333] border border-[#4a4a4a] rounded-2xl p-5 flex flex-col" id="engine-play-panel">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-extrabold text-white flex items-center space-x-2">
            <Gamepad2 className="w-5 h-5 text-[#bc6c25]" />
            <span>Play vs Engine</span>
          </h2>
          <button
            onClick={() => {
              if (playVsEngineMode) destroyEngine();
              setPlayVsEngineMode(!playVsEngineMode);
              if (!playVsEngineMode && !engineGame) startNewEngineGame();
            }}
            className={`text-xs px-3 py-1.5 font-bold rounded-lg border ${
              playVsEngineMode
                ? 'bg-[#606c38] text-white border-[#606c38]'
                : 'bg-[#3d3d3d] border-[#4a4a4a] text-[#d0d0d0]'
            }`}
            id="engine-mode-toggle"
          >
            {playVsEngineMode ? 'Stop' : 'Play'}
          </button>
        </div>

        {playVsEngineMode ? (
          <div className="flex flex-col md:flex-row items-center md:items-start gap-5 flex-1">
            <div className="flex-1 flex justify-center w-full max-w-[340px]">
              <Chessboard
                fen={engineFen}
                playable={!engineThinking}
                onMove={handlePlayerMoveInEngineMode}
              />
            </div>

            <div className="flex-1 flex flex-col self-stretch space-y-3">
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5 mb-2">
                  <Cpu className="w-4 h-4 text-[#bc6c25]" />
                  Engine Strength
                </h3>

                <div className="flex gap-1 mb-3">
                  <button
                    onClick={() => setEngineGoMode('depth')}
                    className={`flex items-center gap-1 text-[10px] py-1.5 px-3 rounded-lg font-bold border ${
                      engineGoMode === 'depth'
                        ? 'bg-[#606c38] text-white border-[#606c38]'
                        : 'bg-[#2a2a2a] border-[#4a4a4a] text-[#a0a0a0]'
                    }`}
                  >
                    <Layers className="w-3 h-3" />
                    Depth
                  </button>
                  <button
                    onClick={() => setEngineGoMode('time')}
                    className={`flex items-center gap-1 text-[10px] py-1.5 px-3 rounded-lg font-bold border ${
                      engineGoMode === 'time'
                        ? 'bg-[#606c38] text-white border-[#606c38]'
                        : 'bg-[#2a2a2a] border-[#4a4a4a] text-[#a0a0a0]'
                    }`}
                  >
                    <Timer className="w-3 h-3" />
                    Time per move
                  </button>
                </div>

                {engineGoMode === 'depth' ? (
                  <>
                    <div className="flex gap-1.5 mb-2">
                      {engineDepthPresets.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => handleDepthPreset(p.id, p.depth)}
                          className={`text-[10px] py-1.5 px-2.5 rounded-lg font-bold border ${
                            engineDepthPreset === p.id
                              ? 'bg-[#606c38] text-white border-[#606c38]'
                              : 'bg-[#2a2a2a] border-[#4a4a4a] text-[#a0a0a0]'
                          }`}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-[#a0a0a0]">
                      <span>Depth:</span>
                      <input
                        type="range"
                        min={1}
                        max={30}
                        value={engineDepth}
                        onChange={(e) => {
                          setEngineDepth(parseInt(e.target.value, 10));
                          setEngineDepthPreset('custom');
                        }}
                        className="flex-1 accent-[#606c38] h-1 bg-[#3d3d3d] rounded-lg cursor-pointer"
                        id="difficulty-slider"
                      />
                      <span className="font-mono font-bold text-[#606c38] w-6 text-center">{engineDepth}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-[10px] text-[#a0a0a0]">
                    <span>Time:</span>
                    <input
                      type="range"
                      min={100}
                      max={30000}
                      step={100}
                      value={engineThinkingTime}
                      onChange={(e) => setEngineThinkingTime(parseInt(e.target.value, 10))}
                      className="flex-1 accent-[#606c38] h-1 bg-[#3d3d3d] rounded-lg cursor-pointer"
                    />
                    <span className="font-mono font-bold text-[#606c38] w-12 text-center">
                      {(engineThinkingTime / 1000).toFixed(1)}s
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-[#2a2a2a] border border-[#4a4a4a] rounded-xl p-3 flex-1 min-h-[100px] max-h-[160px] flex flex-col overflow-hidden">
                <span className="text-[10px] text-[#a0a0a0] font-bold uppercase tracking-wider block mb-1">Moves</span>
                <div className="flex-1 overflow-y-auto font-mono text-xs text-white grid grid-cols-3 gap-y-1 content-start pr-1" id="engine-moves-log">
                  {engineGameHistory.map((m, idx) => {
                    const isWhite = idx % 2 === 0;
                    const num = Math.floor(idx / 2) + 1;
                    return (
                      <div key={idx} className="flex space-x-1 justify-start">
                        {isWhite && <span className="text-[#666666] font-bold">{num}.</span>}
                        <span className="font-semibold text-[#606c38]">{m}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="text-xs text-white bg-[#3d3d3d] p-2.5 rounded-lg border border-[#4a4a4a] leading-relaxed" id="AI-status-banner">
                {engineFeedback || 'Select a strength preset and make your first move.'}
              </div>
              <button onClick={startNewEngineGame} className="w-full bg-[#3d3d3d] text-white border border-[#4a4a4a] py-1.5 rounded-lg text-xs font-bold">
                New Game
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 border border-dashed border-[#4a4a4a] bg-[#2a2a2a] flex flex-col items-center justify-center p-8 rounded-2xl text-center space-y-4 min-h-[300px]">
            <Cpu className="w-12 h-12 text-[#888888]" />
            <div>
              <h3 className="font-bold text-white text-lg">Play vs Stockfish</h3>
              <p className="text-xs text-[#a0a0a0] max-w-sm mx-auto mt-1">
                Choose a strength level and play against the local Stockfish 17 Lite engine.
              </p>
            </div>
            <button
              onClick={() => { setPlayVsEngineMode(true); startNewEngineGame(); }}
              className="bg-[#606c38] text-white px-5 py-2 rounded-lg font-semibold text-xs"
              id="enable-play-btn"
            >
              Start Game
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
