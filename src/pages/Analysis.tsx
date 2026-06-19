import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useGameStore } from '../stores/gameStore';
import { useSettingsStore } from '../stores/settingsStore';
import Chessboard from '../components/board/Chessboard';
import EvalBar from '../components/eval/EvalBar';
import { LEGENDARY_PRESET_GAMES } from '../lib/chessCom';
import { classificationImages, classificationColours, classificationNames } from '../constants/classifications';
import { getTopEngineLine } from '../lib/engine';
import { useSound, getSoundTypeFromSan } from '../hooks/useSound';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

export default function Analysis() {
  const {
    games,
    selectedGame,
    currentMoveIndex,
    analyzing,
    analysisProgress,
    importError,
    loadingGames,
    importChessComGames,
    selectGame,
    setCurrentMoveIndex,
    importPgnDirectly,
    triggerEvaluationPipeline,
    setGames,
  } = useGameStore();

  const { settings, updateSettings } = useSettingsStore();
  const { play, playFromSan, playGameEnd } = useSound();

  const [usernameInput, setUsernameInput] = useState('');
  const [pgnInput, setPgnInput] = useState('');
  const [importMode, setImportMode] = useState<'chesscom' | 'pgn'>('chesscom');
  const [notificationDismissed, setNotificationDismissed] = useState(false);
  const [showGameList, setShowGameList] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const isInAnalysis = !!selectedGame;
  const legendaryData = checkLegendaryStatus();
  const currentMove = selectedGame?.moves[currentMoveIndex];

  useEffect(() => {
    if (games.length === 0 && !selectedGame) {
      setGames(LEGENDARY_PRESET_GAMES);
    }
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
    const cb = () => setShowShortcuts(true);
    window.addEventListener('open-shortcuts', cb);
    return () => window.removeEventListener('open-shortcuts', cb);
  }, []);

  useKeyboardShortcuts([
    {
      key: 'f',
      description: 'Flip board',
      handler: () => toggleOrientation(),
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
      handler: () => setCurrentMoveIndex(-1),
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
      handler: () => setShowShortcuts(true),
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

  const handleBackToStart = () => setCurrentMoveIndex(-1);
  const handlePrevMove = () => setCurrentMoveIndex(currentMoveIndex - 1);
  const handleNextMove = () => setCurrentMoveIndex(currentMoveIndex + 1);
  const handleEndMove = () => setCurrentMoveIndex((selectedGame?.moves.length || 0) - 1);

  const handleBackToImport = () => {
    selectGame('');
    setNotificationDismissed(false);
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
    if (!topLine || !topLine.moves.length) return undefined;
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
        <div className="text-center space-y-2 mb-2">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Analyze a Chess Game
          </h1>
          <p className="text-sm text-[#a0a0a0]">
            Import from Chess.com or paste a PGN to start analyzing with Stockfish 17.
          </p>
        </div>

        <div className="bg-[#333333] border border-[#4a4a4a] rounded-2xl p-6" id="analysis-settings-card">
          <div className="flex border-b border-[#4a4a4a] mb-4">
            <button
              onClick={() => setImportMode('chesscom')}
              className={`pb-3 px-4 text-sm font-semibold border-b-2 ${
                importMode === 'chesscom'
                  ? 'border-[#606c38] text-[#606c38]'
                  : 'border-transparent text-[#a0a0a0]'
              }`}
            >
              <Search className="w-4 h-4 inline mr-1" />
              Chess.com Username
            </button>
            <button
              onClick={() => setImportMode('pgn')}
              className={`pb-3 px-4 text-sm font-semibold border-b-2 ${
                importMode === 'pgn'
                  ? 'border-[#606c38] text-[#606c38]'
                  : 'border-transparent text-[#a0a0a0]'
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
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="e.g. Hikaru"
                className="bg-[#2a2a2a] border border-[#4a4a4a] rounded-lg px-4 py-2.5 text-sm text-white placeholder-[#888888] flex-1"
                id="chesscom-user-input"
              />
              <button
                type="submit"
                disabled={loadingGames}
                className="bg-[#606c38] text-white text-sm px-5 py-2.5 rounded-lg font-bold disabled:opacity-50"
                id="api-fetch-submit"
              >
                {loadingGames ? 'Searching...' : 'Fetch Games'}
              </button>
            </form>
          ) : (
            <form onSubmit={handlePgnImportSubmit} className="flex flex-col gap-2">
              <textarea
                value={pgnInput}
                onChange={(e) => setPgnInput(e.target.value)}
                placeholder="Paste PGN here..."
                rows={3}
                className="bg-[#2a2a2a] border border-[#4a4a4a] rounded-lg p-3 text-xs font-mono text-white placeholder-[#888888]"
                id="pgn-textarea-input"
              />
              <button
                type="submit"
                className="bg-[#606c38] text-white font-bold text-sm py-2.5 rounded-lg self-end px-6"
                id="pgn-import-submit"
              >
                Analyze PGN
              </button>
            </form>
          )}

          {importError && (
            <div className="flex items-center space-x-2 text-xs bg-[#3d3d3d] text-[#bc6c25] p-2.5 rounded-lg mt-3" id="import-error-banner">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{importError}</span>
            </div>
          )}
        </div>

        {showGameList && games.length > 0 && (
          <div className="bg-[#333333] border border-[#4a4a4a] rounded-2xl p-5" id="games-archive-card">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-[#bc6c25]" />
              <span>Recent Games ({games.length})</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {games.map((g) => {
                const isSel = selectedGame?.id === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => selectGame(g.id)}
                    className={`text-left p-4 rounded-xl border flex flex-col justify-between h-32 ${
                      isSel
                        ? 'bg-[#3d3d3d] border-[#606c38]'
                        : 'bg-[#2a2a2a] border-[#4a4a4a]'
                    }`}
                    id={`game-selector-${g.id}`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-[#a0a0a0] font-semibold mb-1">
                        <span>{g.date}</span>
                        <span className="font-mono bg-[#3d3d3d] px-1.5 py-0.5 rounded text-white">{g.result}</span>
                      </div>
                      <div className="text-xs font-bold text-white truncate">
                        {g.white.username} vs {g.black.username}
                      </div>
                      <div className="text-[10px] text-[#888888] mt-1">
                        {g.white.rating && `White: ${g.white.rating}`}{g.white.rating && g.black.rating && ' | '}{g.black.rating && `Black: ${g.black.rating}`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!showGameList && games.length > 0 && (
          <div className="text-center">
            <p className="text-xs text-[#888888] mb-3">Or try a legendary game:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {LEGENDARY_PRESET_GAMES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => selectGame(g.id)}
                  className="text-xs bg-[#333333] border border-[#4a4a4a] text-[#a0a0a0] px-3 py-2 rounded-lg"
                >
                  {g.white.username} vs {g.black.username}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5" id="analysis-viewport">
      <button
        onClick={handleBackToImport}
        className="flex items-center space-x-1.5 text-xs text-[#bc6c25] mb-1"
        id="back-to-import-btn"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to import</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" id="game-arena-grid">
        <div className="lg:col-span-7 space-y-4 flex flex-col items-center">
          <div className="w-full max-w-[500px] bg-[#333333] border border-[#4a4a4a] rounded-xl p-3.5 flex items-center justify-between" id="game-header-card">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-[#a0a0a0] font-semibold">
                <TrendingUp className="w-3.5 h-3.5 text-[#606c38]" />
                <span>Result: </span>
                <span className="text-white bg-[#3d3d3d] px-1.5 py-0.5 rounded font-mono">{selectedGame.result}</span>
                <span className="mx-1">&bull;</span>
                <span>{selectedGame.date}</span>
              </div>
              <div className="text-sm font-bold text-white flex flex-col">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded bg-white border border-[#a0a0a0] flex-shrink-0" />
                  <span>{selectedGame.white.username} {selectedGame.white.rating && <span className="text-[#a0a0a0]">({selectedGame.white.rating})</span>}</span>
                </div>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="w-2.5 h-2.5 rounded bg-[#2a2a2a] border border-[#888888] flex-shrink-0" />
                  <span>{selectedGame.black.username} {selectedGame.black.rating && <span className="text-[#a0a0a0]">({selectedGame.black.rating})</span>}</span>
                </div>
              </div>
            </div>
            {selectedGame.accuracy && (
              <div className="flex items-center space-x-4 border-l border-[#4a4a4a] pl-4">
                <div className="text-center">
                  <div className="text-[10px] text-[#a0a0a0] font-bold uppercase tracking-wider">White</div>
                  <div className="text-lg font-black text-white">{selectedGame.accuracy.white}%</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-[#a0a0a0] font-bold uppercase tracking-wider">Black</div>
                  <div className="text-lg font-black text-white">{selectedGame.accuracy.black}%</div>
                </div>
              </div>
            )}
          </div>

          <div className="flex w-full max-w-[500px] gap-3">
            <div className="self-stretch min-h-[300px]">
              <EvalBar
                score={currentMove?.evaluation?.score ?? null}
                mate={currentMove?.evaluation?.mateIn ?? null}
                flipped={settings.boardOrientation === 'black'}
              />
            </div>
            <div className="flex-1">
              <Chessboard
                fen={getCurrentFen()}
                playable={false}
                orientation={settings.boardOrientation}
                highlightSquares={getMoveHighlight()}
                bestMoveArrow={getBestMoveArrow()}
              />
            </div>
          </div>

          <div className="w-full max-w-[500px] flex items-center justify-between bg-[#333333] border border-[#4a4a4a] rounded-xl p-3" id="game-controls-console">
            <div className="flex space-x-1">
              <button onClick={handleBackToStart} disabled={currentMoveIndex === -1} className="p-2 bg-[#3d3d3d] text-[#a0a0a0] rounded-lg disabled:opacity-30" title="First Move">
                <ChevronsLeft className="w-5 h-5" />
              </button>
              <button onClick={handlePrevMove} disabled={currentMoveIndex === -1} className="p-2 bg-[#3d3d3d] text-[#a0a0a0] rounded-lg disabled:opacity-30" title="Previous Move">
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
            <span className="text-xs text-[#a0a0a0] font-mono font-bold uppercase tracking-wider" id="nav-move-indicator">
              Move {currentMoveIndex + 1} / {selectedGame.moves.length}
            </span>
            <div className="flex space-x-1">
              <button onClick={handleNextMove} disabled={currentMoveIndex === selectedGame.moves.length - 1} className="p-2 bg-[#3d3d3d] text-[#a0a0a0] rounded-lg disabled:opacity-30" title="Next Move">
                <ChevronRight className="w-5 h-5" />
              </button>
              <button onClick={handleEndMove} disabled={currentMoveIndex === selectedGame.moves.length - 1} className="p-2 bg-[#3d3d3d] text-[#a0a0a0] rounded-lg disabled:opacity-30" title="Last Move">
                <ChevronsRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="w-full max-w-[500px] flex items-center gap-2">
            <button
              onClick={toggleOrientation}
              className="flex items-center gap-1.5 bg-[#3d3d3d] border border-[#4a4a4a] px-3 py-2 rounded-lg text-xs text-[#a0a0a0]"
              title="Flip board (F)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Flip</span>
            </button>
            <div className="flex-1" />
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-shortcuts'))}
              className="flex items-center gap-1.5 bg-[#3d3d3d] border border-[#4a4a4a] px-3 py-2 rounded-lg text-xs text-[#a0a0a0]"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>Shortcuts</span>
            </button>
          </div>

          <div className="w-full max-w-[500px] bg-[#333333] border border-[#4a4a4a] rounded-xl p-3.5 space-y-2.5" id="engine-controls-panel">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-[#606c38]" />
                  <span>Stockfish 17</span>
                </h3>
                <p className="text-[11px] text-[#a0a0a0]">Depth {settings.engineDepth} &middot; Non-blocking analysis</p>
              </div>
              <div className="flex items-center space-x-2">
                <select
                  value={settings.engineDepth}
                  onChange={(e) => updateSettings({ engineDepth: parseInt(e.target.value, 10) })}
                  className="bg-[#2a2a2a] border border-[#4a4a4a] rounded-lg px-2 py-1.5 text-xs text-white"
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
                      ? 'bg-[#4a5530] opacity-70 cursor-wait'
                      : 'bg-[#606c38]'
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
                  <span className="text-[#606c38]">Analyzing positions...</span>
                  <span className="text-[#606c38] font-bold">{analysisProgress}%</span>
                </div>
                <div className="w-full h-2 bg-[#3d3d3d] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#606c38] rounded-full"
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-4 flex flex-col h-[580px]">
          {legendaryData && !notificationDismissed && (
            <div className="bg-[#3d3d3d] border border-[#bc6c25] rounded-xl p-4 text-[#bc6c25] relative" id="legendary-achievement-banner">
              <button
                className="absolute top-2 right-2 text-[#bc6c25] text-sm font-bold w-5 h-5 rounded-full flex items-center justify-center bg-[#4a4a4a]"
                onClick={() => setNotificationDismissed(true)}
              >
                &#x2715;
              </button>
              <div className="flex items-start space-x-3">
                <div className="bg-[#bc6c25] text-white p-1.5 rounded-lg shrink-0 mt-0.5">
                  <Award className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="font-extrabold text-[#bc6c25] tracking-tight uppercase text-xs flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#bc6c25]" />
                    Legendary Game!
                  </h4>
                  <p className="text-xs text-[#d0d0d0] mt-1 pr-6 leading-relaxed">
                    {legendaryData.hasBrilliant && `Brilliant moves: ${legendaryData.brilliantsWhite} by White, ${legendaryData.brilliantsBlack} by Black. `}
                    {legendaryData.hasHighAccuracy && `Accuracy: White ${legendaryData.whiteAcc}%, Black ${legendaryData.blackAcc}%.`}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 bg-[#333333] border border-[#4a4a4a] rounded-2xl p-4 flex flex-col overflow-hidden max-h-[380px] min-h-[220px]">
            <h3 className="text-xs font-bold text-[#a0a0a0] uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
              <History className="w-4 h-4 text-[#bc6c25]" />
              <span>Move Log</span>
            </h3>
            <div className="flex-1 overflow-y-auto pr-1 space-y-1 scrollbar-thin scrollbar-track-[#2a2a2a] scrollbar-thumb-[#4a4a4a]" id="moves-log-container">
              {selectedGame.moves.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-[#888888] italic p-6">
                  Click 'Analyze' to evaluate positions.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1 text-sm font-mono">
                  {Array.from({ length: Math.ceil(selectedGame.moves.length / 2) }).map((_, rowIndex) => {
                    const whiteMove = selectedGame.moves[rowIndex * 2];
                    const blackMove = selectedGame.moves[rowIndex * 2 + 1];
                    const turnNum = rowIndex + 1;
                    return (
                      <div key={rowIndex} className="col-span-2 grid grid-cols-12 py-1.5 px-2 rounded-lg bg-transparent items-center">
                        <div className="col-span-2 text-xs text-[#888888] font-bold">{turnNum}.</div>
                        <button
                          onClick={() => setCurrentMoveIndex(whiteMove.index)}
                          className={`col-span-5 text-left font-semibold px-2 py-0.5 rounded flex items-center justify-between ${
                            currentMoveIndex === whiteMove.index
                              ? 'bg-[#3d3d3d] text-[#606c38]'
                              : 'text-[#d0d0d0]'
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
                            onClick={() => setCurrentMoveIndex(blackMove.index)}
                            className={`col-span-5 text-left font-semibold px-2 py-0.5 rounded flex items-center justify-between ${
                              currentMoveIndex === blackMove.index
                                ? 'bg-[#3d3d3d] text-[#606c38]'
                                : 'text-[#d0d0d0]'
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

          <div className="bg-[#333333] border border-[#4a4a4a] rounded-2xl p-4 flex-shrink-0" id="positional-evaluation-box">
            <h3 className="text-xs font-bold text-[#a0a0a0] uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <Activity className="w-4 h-4 text-[#bc6c25]" />
              <span>Engine Diagnosis</span>
            </h3>
            {currentMoveIndex === -1 ? (
              <div className="text-xs text-[#888888] italic leading-relaxed py-2">
                Starting position. Browse moves or click 'Analyze' to compute.
              </div>
            ) : currentMove ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#4a4a4a] pb-2">
                  <div className="flex items-center space-x-2">
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
                    <div className="flex items-center space-x-2 text-xs font-mono font-bold bg-[#2a2a2a] px-2.5 py-1 rounded border border-[#4a4a4a]">
                      <span className="text-[#a0a0a0]">Eval:</span>
                      <span className={currentMove.evaluation.score > 0 ? 'text-[#606c38]' : 'text-white'}>
                        {currentMove.evaluation.score > 0 ? `+${currentMove.evaluation.score.toFixed(2)}` : currentMove.evaluation.score.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
                {currentMove.opening && (
                  <div className="flex items-center space-x-1.5 text-xs text-[#dda15e] font-semibold">
                    <BookOpen className="w-3 h-3" />
                    <span>{currentMove.opening}</span>
                  </div>
                )}
                <p className="text-xs text-white leading-relaxed">
                  {currentMove.explanation || `Move ${currentMove.index + 1}.`}
                </p>
                {currentMove.evaluation?.bestMove && (
                  <div className="flex items-center justify-between bg-[#2a2a2a] p-2 rounded text-xs">
                    <span className="text-[#a0a0a0]">Best line:</span>
                    <span className="font-bold font-mono text-[#606c38]">{currentMove.evaluation.bestMove}</span>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <button
        onClick={() => setShowGameList(!showGameList)}
        className="flex items-center space-x-1.5 text-xs text-[#a0a0a0]"
      >
        <BookOpen className="w-3.5 h-3.5" />
        <span>Game library ({games.length})</span>
        <ChevronDown className={`w-3 h-3 ${showGameList ? 'rotate-180' : ''}`} />
      </button>

      {showGameList && (
        <div className="bg-[#333333] border border-[#4a4a4a] rounded-2xl p-5" id="games-archive-card">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {games.map((g) => (
              <button
                key={g.id}
                onClick={() => selectGame(g.id)}
                className={`text-left p-4 rounded-xl border flex flex-col justify-between h-32 ${
                  selectedGame?.id === g.id
                    ? 'bg-[#3d3d3d] border-[#606c38]'
                    : 'bg-[#2a2a2a] border-[#4a4a4a]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-[10px] text-[#a0a0a0] font-semibold mb-1">
                    <span>{g.date}</span>
                    <span className="font-mono bg-[#3d3d3d] px-1.5 py-0.5 rounded text-white">{g.result}</span>
                  </div>
                  <div className="text-xs font-bold text-white truncate">
                    {g.white.username} vs {g.black.username}
                  </div>
                </div>
                {selectedGame?.id === g.id && (
                  <span className="text-[10px] font-bold text-white bg-[#606c38] px-2 py-0.5 rounded-full self-start mt-2">
                    Active
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowShortcuts(false)}>
          <div className="bg-[#333333] border border-[#4a4a4a] rounded-2xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-[#606c38]" />
                Keyboard Shortcuts
              </h2>
              <button onClick={() => setShowShortcuts(false)} className="text-[#a0a0a0] text-xl leading-none">&times;</button>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm py-1.5 border-b border-[#4a4a4a]">
                <span className="text-white">Flip board</span>
                <span className="text-[#a0a0a0] font-mono text-xs bg-[#3d3d3d] px-2 py-0.5 rounded">F</span>
              </div>
              <div className="flex justify-between text-sm py-1.5 border-b border-[#4a4a4a]">
                <span className="text-white">Analyze game</span>
                <span className="text-[#a0a0a0] font-mono text-xs bg-[#3d3d3d] px-2 py-0.5 rounded">A</span>
              </div>
              <div className="flex justify-between text-sm py-1.5 border-b border-[#4a4a4a]">
                <span className="text-white">Next move</span>
                <span className="text-[#a0a0a0] font-mono text-xs bg-[#3d3d3d] px-2 py-0.5 rounded">&rarr;</span>
              </div>
              <div className="flex justify-between text-sm py-1.5 border-b border-[#4a4a4a]">
                <span className="text-white">Previous move</span>
                <span className="text-[#a0a0a0] font-mono text-xs bg-[#3d3d3d] px-2 py-0.5 rounded">&larr;</span>
              </div>
              <div className="flex justify-between text-sm py-1.5 border-b border-[#4a4a4a]">
                <span className="text-white">First move</span>
                <span className="text-[#a0a0a0] font-mono text-xs bg-[#3d3d3d] px-2 py-0.5 rounded">Home</span>
              </div>
              <div className="flex justify-between text-sm py-1.5 border-b border-[#4a4a4a]">
                <span className="text-white">Last move</span>
                <span className="text-[#a0a0a0] font-mono text-xs bg-[#3d3d3d] px-2 py-0.5 rounded">End</span>
              </div>
              <div className="flex justify-between text-sm py-1.5">
                <span className="text-white">Show shortcuts</span>
                <span className="text-[#a0a0a0] font-mono text-xs bg-[#3d3d3d] px-2 py-0.5 rounded">?</span>
              </div>
            </div>
            <p className="text-xs text-[#666666] mt-4 text-center">Shortcuts can be disabled in Profile settings.</p>
          </div>
        </div>
      )}
    </div>
  );
}
