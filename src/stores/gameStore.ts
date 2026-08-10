import { create } from 'zustand';
import { Chess } from 'chess.js';
import type { ChessGame, AnalyzedMove, HypothesisMove, EngineLine } from '../types';
import { STARTING_FEN } from '../types';
import { createGameEvaluator, getEngineVersion, createPositionEvaluator, getEvaluationResultFromLines } from '../lib/engine/evaluate';
import { getGameAnalysis } from '../lib/reporter/report';
import { useAuthStore } from './authStore';
import { useSettingsStore } from './settingsStore';
import { getCachedAnalysis, saveCachedAnalysis, getCachedAnalysisByKey, saveSharedGameToTurso, batchCheckAnalysis, hashPgn } from '../lib/tursoCache';
import { getOptimalEngineCount } from '../lib/engine/evaluate';
import { detectDeviceTier, recommendedDepth, recommendedWorkers } from '../lib/deviceTier';
import { saveUserGame, fetchUserGames, fetchPublishedGame } from '../lib/firebase';
import { fetchGameFromApi, saveGameToApi } from '../lib/api';
import { generateShortId } from '../lib/shortId';
import { useToastStore } from './toastStore';

type GameState = {
  games: ChessGame[];
  selectedGame: ChessGame | null;
  currentMoveIndex: number;
  analyzing: boolean;
  autoAnalyzing: boolean;
  analysisProgress: number;
  importError: string | null;
  loadingGames: boolean;
  analysisCache: Record<string, ChessGame | undefined>;
  analyzedPgnHashes: Record<string, boolean>;
  linkedGames: ChessGame[];
  linkedLoading: boolean;
  linkedAnalyzing: boolean;
  linkedAnalysisProgress: string;
  importJustCompleted: boolean;
  hypothesisActive: boolean;
  hypothesisMoves: HypothesisMove[];
  hypothesisBaseIndex: number;
  hypothesisSearching: boolean;
  hypothesisLines: EngineLine[] | null;
  hypothesisDepth: number;

  importChessComGames(username: string): Promise<void>;
  selectGame(gameId: string): void;
  setCurrentMoveIndex(index: number): void;
  importPgnDirectly(pgn: string): void;
  triggerEvaluationPipeline(depth?: number): Promise<void>;
  autoAnalyzeGame(gameId: string): Promise<void>;
  loadPriorAnalysis(depth: number, engine: string): Promise<boolean>;
  setGames(games: ChessGame[]): void;
  fetchLinkedUserGames(): Promise<void>;
  loadUserGames(): Promise<void>;
  loadGameByShortId(shortId: string): Promise<ChessGame | null>;
  resetGameStore(): void;
  consumeImportFlag(): void;
  enterHypothesisMode(depth?: number): boolean;
  exitHypothesisMode(): void;
  playHypothesisMove(from: string, to: string): boolean;
  undoHypothesisMove(): void;
  clearHypothesisMoves(): void;
}

const pendingAnalysis = new Map<string, Promise<void>>();
let activeAbortController: AbortController | null = null;
let hypothesisAbortController: AbortController | null = null;

export const useGameStore = create<GameState>((set, get) => ({
  games: [] as ChessGame[],
  selectedGame: null,
  currentMoveIndex: -1,
  analyzing: false,
  autoAnalyzing: false,
  analysisProgress: 0,
  importError: null,
  loadingGames: false,
  analysisCache: {},
  analyzedPgnHashes: {},
  linkedGames: [],
  linkedLoading: false,
  linkedAnalyzing: false,
  linkedAnalysisProgress: '',
  importJustCompleted: false,
  hypothesisActive: false,
  hypothesisMoves: [],
  hypothesisBaseIndex: 0,
  hypothesisSearching: false,
  hypothesisLines: null,
  hypothesisDepth: 0,

  setGames: (games) => { set({ games }); },

  consumeImportFlag: () => { set({ importJustCompleted: false }); },

  enterHypothesisMode: (depth) => {
    const { selectedGame, analyzing, hypothesisActive, currentMoveIndex } = get();
    if (!selectedGame || analyzing || hypothesisActive) return false;
    set({
      hypothesisActive: true,
      hypothesisMoves: [],
      hypothesisBaseIndex: currentMoveIndex,
      hypothesisDepth: depth ?? useSettingsStore.getState().settings.engineDepth,
      hypothesisLines: null,
      hypothesisSearching: false,
    });
    return true;
  },

  exitHypothesisMode: () => {
    hypothesisAbortController?.abort();
    hypothesisAbortController = null;
    set({ hypothesisActive: false, hypothesisMoves: [], hypothesisLines: null, hypothesisSearching: false });
  },

  playHypothesisMove: (from, to) => {
    const { hypothesisActive, hypothesisMoves, selectedGame, hypothesisBaseIndex } = get();
    if (!hypothesisActive) return false;
    const tipFen = hypothesisMoves.length
      ? hypothesisMoves[hypothesisMoves.length - 1].fen
      : (selectedGame?.moves[hypothesisBaseIndex]?.fen ?? STARTING_FEN);
    let board: Chess;
    let moveResult;
    try {
      board = new Chess(tipFen);
      moveResult = board.move({ from, to, promotion: 'q' });
    } catch {
      return false;
    }
    const newMove: HypothesisMove = {
      index: hypothesisMoves.length,
      san: moveResult.san,
      from: moveResult.from,
      to: moveResult.to,
      fen: board.fen(),
      color: moveResult.color,
    };
    set(state => ({ hypothesisMoves: [...state.hypothesisMoves, newMove] }));
    void runHypothesisSearch(newMove);
    return true;
  },

  undoHypothesisMove: () => {
    const { hypothesisActive, hypothesisMoves } = get();
    if (!hypothesisActive || hypothesisMoves.length === 0) return;
    hypothesisAbortController?.abort();
    hypothesisAbortController = null;
    const newMoves = hypothesisMoves.slice(0, -1);
    const newTip = newMoves[newMoves.length - 1];
    set({
      hypothesisMoves: newMoves,
      hypothesisLines: newTip?.engineLines ?? null,
      hypothesisSearching: false,
    });
  },

  clearHypothesisMoves: () => {
    hypothesisAbortController?.abort();
    hypothesisAbortController = null;
    set({ hypothesisMoves: [], hypothesisLines: null, hypothesisSearching: false });
  },

  selectGame: (gameId) => {
    hypothesisAbortController?.abort();
    hypothesisAbortController = null;
    if (!gameId) {
      set({
        selectedGame: null,
        currentMoveIndex: -1,
        hypothesisActive: false,
        hypothesisMoves: [],
        hypothesisBaseIndex: 0,
        hypothesisSearching: false,
        hypothesisLines: null,
        hypothesisDepth: 0,
      });
      return;
    }
    const { games, analysisCache } = get();
    const game = games.find((g) => g.id === gameId);
    if (!game) {
      console.warn('[GameStore] selectGame: game not found:', gameId);
      return;
    }

    // Use cached moves if available, otherwise hydrate from PGN (expensive)
    const cached = analysisCache[gameId];
    const hydratedMoves = game.moves.length > 0 ? game.moves : hydratePgnMoves(game.pgn);
    const mergedMoves = hydratedMoves.map((move, i) => {
      if (cached?.moves[i] != null) {
        return { ...move, ...cached.moves[i] };
      }
      return move;
    });

    const updatedGame = { ...game, moves: mergedMoves };
    if (cached != null) {
      updatedGame.accuracy = cached.accuracy;
      updatedGame.classificationCounts = cached.classificationCounts;
      updatedGame.analyzedAt = cached.analyzedAt;
      updatedGame.analysisDurationMs = cached.analysisDurationMs;
      updatedGame.analysisDepth = cached.analysisDepth;
    }

    set({
      selectedGame: updatedGame,
      currentMoveIndex: -1,
      hypothesisActive: false,
      hypothesisMoves: [],
      hypothesisBaseIndex: 0,
      hypothesisSearching: false,
      hypothesisLines: null,
      hypothesisDepth: 0,
    });
  },

  setCurrentMoveIndex: (index) => {
    const { selectedGame } = get();
    if (!selectedGame) return;
    const clampedIndex = Math.max(-1, Math.min(selectedGame.moves.length - 1, index));
    set({ currentMoveIndex: clampedIndex });
  },

  importChessComGames: async (username) => {
    set({ loadingGames: true, importError: null });
    try {
      const { fetchChessComGames, fetchAvatarsForGames } = await import('../lib/chessCom');
      const loaded = await fetchChessComGames(username);
      if (loaded.length === 0) {
        set({ importError: 'No recent games found for this user.', loadingGames: false });
      } else {
        const withAvatars = await fetchAvatarsForGames(loaded);
        set({ games: withAvatars, selectedGame: null, currentMoveIndex: -1, loadingGames: false });
        const tursoStatus = await batchCheckAnalysis(withAvatars, useSettingsStore.getState().settings.engineDepth);
        set({ analyzedPgnHashes: tursoStatus });
        get().selectGame(loaded[0].id);
        void get().autoAnalyzeGame(loaded[0].id);
        set({ importJustCompleted: true });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch games.';
      set({ importError: msg, loadingGames: false });
      useToastStore.getState().addToast({ type: 'error', message: msg });
    }
  },

  importPgnDirectly: (pgn) => {
    set({ importError: null });
    try {
      const hydratedMoves = hydratePgnMoves(pgn);
      if (hydratedMoves.length === 0) {
        throw new Error('Could not parse any chess moves from PGN.');
      }
      const whiteName = (/\[White "(.*?)"\]/.exec(pgn))?.[1] ?? 'White Player';
      const blackName = (/\[Black "(.*?)"\]/.exec(pgn))?.[1] ?? 'Black Player';
      const date = (/\[Date "(.*?)"\]/.exec(pgn))?.[1] ?? new Date().toISOString().split('T')[0];
      const result = (/\[Result "(.*?)"\]/.exec(pgn))?.[1] ?? '*';

      const newGame: ChessGame = {
        id: `pgn_custom_${Date.now()}`,
        shortId: generateShortId(),
        white: { username: whiteName },
        black: { username: blackName },
        result,
        date,
        pgn,
        moves: hydratedMoves,
      };

      set((state) => ({
        games: [newGame, ...state.games],
        selectedGame: newGame,
        currentMoveIndex: -1,
      }));

      void get().autoAnalyzeGame(newGame.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'PGN Parsing Failure';
      set({ importError: msg });
      useToastStore.getState().addToast({ type: 'error', message: msg });
    }
  },

  autoAnalyzeGame: async (gameId) => {
    const { games, analyzing, autoAnalyzing } = get();
    if (analyzing || autoAnalyzing) return;
    if (pendingAnalysis.has(gameId)) return;

    const { linkedGames } = get();
    const game = games.find(g => g.id === gameId) ?? linkedGames.find(g => g.id === gameId);
    if (!game || game.moves.length === 0) return;

    const settings = useSettingsStore.getState().settings;
    const depth = settings.engineDepth;
    const autoEnabled = settings.featureToggles.autoAnalyze;
    if (!autoEnabled) return;

    // Always run analysis from scratch (no Turso cache lookup)

    set({ autoAnalyzing: true });

    const promise = runEvaluationPipeline(game, depth, gameId);
    pendingAnalysis.set(gameId, promise);

    try {
      await promise;
    } finally {
      pendingAnalysis.delete(gameId);
      const state = get();
      if (!state.analyzing) {
        set({ autoAnalyzing: false });
      }
    }
  },

  loadPriorAnalysis: async (depth, engine) => {
    const { selectedGame, analyzing } = get();
    if (!selectedGame || analyzing || selectedGame.moves.length === 0) return false;
    const cached = await getCachedAnalysisByKey(selectedGame.pgn, depth, engine);
    if (!cached) return false;
    set({
      analysisCache: { ...get().analysisCache, [selectedGame.id]: cached },
      analyzedPgnHashes: { ...get().analyzedPgnHashes, [hashPgn(selectedGame.pgn)]: true },
      selectedGame: {
        ...selectedGame,
        moves: mergeMoves(selectedGame.moves, cached.moves),
        accuracy: cached.accuracy,
        classificationCounts: cached.classificationCounts,
        analyzedAt: cached.analyzedAt,
        analysisDurationMs: cached.analysisDurationMs,
        analysisDepth: cached.analysisDepth,
      },
    });
    return true;
  },

  triggerEvaluationPipeline: async (depth?: number) => {
    const { selectedGame, analyzing } = get();
    if (!selectedGame || analyzing || selectedGame.moves.length === 0) return;

    const evalDepth = depth ?? useSettingsStore.getState().settings.engineDepth;

    const pending = pendingAnalysis.get(selectedGame.id);
    if (pending) {
      set({ analyzing: true, analysisProgress: 50 });
      try {
        await pending;
        const result = get().analysisCache[selectedGame.id];
        if (result != null) {
          set({
            selectedGame: {
              ...selectedGame,
              moves: mergeMoves(selectedGame.moves, result.moves),
              accuracy: result.accuracy,
              classificationCounts: result.classificationCounts,
              analyzedAt: result.analyzedAt,
              analysisDurationMs: result.analysisDurationMs,
            },
            analysisProgress: 100,
            analyzing: false,
            autoAnalyzing: false,
          });
        }
      } catch {
        set({ analyzing: false, analysisProgress: 0, autoAnalyzing: false });
      }
      return;
    }

    set({ analyzing: true, analysisProgress: 1 });

    try {
      await runEvaluationPipeline(selectedGame, evalDepth, selectedGame.id);

      // runEvaluationPipeline already updated the cache and merged moves into selectedGame.
      // Pull the final analysed game from the cache (or fall back to the updated selectedGame).
      const result = get().analysisCache[selectedGame.id];
      const finalGame = result ?? get().selectedGame ?? selectedGame;

      set({
        selectedGame: finalGame,
        analysisProgress: 100,
        analyzing: false,
      });

      const authStore = useAuthStore.getState();
      if (authStore.user) {
        await authStore.incrementAnalyzedGames();
        const streakResult = await authStore.updateStreakOnAnalysis();
        if (streakResult.streakIncremented) {
          useAuthStore.setState({
            streakToast: { show: true, newStreak: streakResult.newStreak, prevStreak: streakResult.prevStreak },
          });
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && (err.message === 'aborted' || err.message === 'abort')) {
        set({ analyzing: false, analysisProgress: 0, autoAnalyzing: false });
        return;
      }
      set({ analyzing: false, analysisProgress: 0, autoAnalyzing: false });
    }
  },

  fetchLinkedUserGames: async () => {
    const authUser = useAuthStore.getState().user;
    const chessComUsername = authUser?.chessComUsername;
    if (chessComUsername == null) return;

    set({ linkedLoading: true, linkedAnalyzing: false, linkedAnalysisProgress: '' });

    try {
      const { fetchChessComGames, fetchAvatarsForGames } = await import('../lib/chessCom');
      const raw = await fetchChessComGames(chessComUsername);
      const latest = raw.slice(0, 3);

      const withAvatars = await fetchAvatarsForGames(latest);
      const withIds = withAvatars.map(g => ({ ...g, id: `linked-${g.id}`, shortId: generateShortId() }));

      const tursoStatus = await batchCheckAnalysis(withIds, useSettingsStore.getState().settings.engineDepth);
      set(state => ({
        linkedGames: withIds,
        linkedLoading: false,
        analyzedPgnHashes: { ...state.analyzedPgnHashes, ...tursoStatus },
        games: [...state.games, ...withIds],
        selectedGame: state.selectedGame,
      }));

      const uncached = withIds.filter(g => !tursoStatus[hashPgn(g.pgn)]);
      if (uncached.length === 0) {
        set({ linkedAnalyzing: false });
        return;
      }

      set({ linkedAnalyzing: true, linkedAnalysisProgress: `Analyzing 1 / ${uncached.length}` });

      for (let i = 0; i < uncached.length; i++) {
        const gameId = uncached[i].id;
        set({ linkedAnalysisProgress: `Analyzing ${i + 1} / ${uncached.length}` });
        const existing = get().analysisCache[gameId];
        if (existing == null) {
          await get().autoAnalyzeGame(gameId);
        }
      }

      set({ linkedAnalyzing: false, linkedAnalysisProgress: '' });
    } catch {
      set({ linkedLoading: false, linkedAnalyzing: false, linkedAnalysisProgress: '' });
    }
  },

  loadUserGames: async () => {
    const authUser = useAuthStore.getState().user;
    if (!authUser || (authUser.authProvider !== 'google' && authUser.authProvider !== 'anonymous')) return;
    const raw = await fetchUserGames(authUser.id);
    if (raw.length === 0) return;
    const parsed: ChessGame[] = raw.map((r: Record<string, unknown>) => {
      const moves = typeof r.moves === 'string' ? JSON.parse(r.moves) as AnalyzedMove[] : (r.moves as AnalyzedMove[] | undefined) ?? [];
      return {
        id: r.id as string,
        shortId: r.shortId as string | undefined,
        white: r.white as ChessGame['white'],
        black: r.black as ChessGame['black'],
        result: r.result as string,
        date: r.date as string,
        pgn: r.pgn as string,
        moves,
        accuracy: r.accuracy as ChessGame['accuracy'] ?? undefined,
        classificationCounts: r.classificationCounts as ChessGame['classificationCounts'] ?? undefined,
        analyzedAt: r.analyzedAt as string | undefined,
        analysisDurationMs: r.analysisDurationMs as number | undefined,
        analysisDepth: r.analysisDepth as number | undefined,
        initialPosition: r.initialPosition as string | undefined,
      };
    });
    const cache: Record<string, ChessGame> = {};
    const pgnMap: Record<string, boolean> = {};
    parsed.forEach(g => {
      if (g.analyzedAt != null) {
        cache[g.id] = g;
      }
      if (g.pgn !== '') pgnMap[hashPgn(g.pgn)] = true;
    });
    set(state => ({
      games: [...parsed, ...state.games.filter(g => g.id.startsWith('legend-'))],
      analysisCache: { ...state.analysisCache, ...cache },
      analyzedPgnHashes: { ...state.analyzedPgnHashes, ...pgnMap },
    }));
  },

  loadGameByShortId: async (shortId: string) => {
    const state = get();
    const existing = state.games.find(g => g.shortId === shortId || g.id === shortId);
    if (existing) {
      set({ selectedGame: existing, currentMoveIndex: -1 });
      return existing;
    }
    let data: Record<string, unknown> | null = null;
    try {
      data = await fetchGameFromApi(shortId);
    } catch {
      console.warn('fetchGameFromApi failed');
    }
    data ??= await fetchPublishedGame(shortId);
    if (data == null) {
      const authUser = useAuthStore.getState().user;
      if (authUser && (authUser.authProvider === 'google' || authUser.authProvider === 'anonymous')) {
        const raw = await fetchUserGames(authUser.id);
        const match = raw.find((r: Record<string, unknown>) => r.shortId === shortId);
        if (match) {
          const moves = typeof match.moves === 'string' ? JSON.parse(match.moves) as AnalyzedMove[] : (match.moves as AnalyzedMove[] | undefined) ?? [];
          const game: ChessGame = {
            id: match.id as string,
            shortId: match.shortId as string | undefined ?? shortId,
            white: match.white as ChessGame['white'],
            black: match.black as ChessGame['black'],
            result: match.result as string,
            date: match.date as string,
            pgn: match.pgn as string,
            moves,
            accuracy: match.accuracy as ChessGame['accuracy'] ?? undefined,
            classificationCounts: match.classificationCounts as ChessGame['classificationCounts'] ?? undefined,
            analyzedAt: match.analyzedAt as string | undefined,
            analysisDurationMs: match.analysisDurationMs as number | undefined,
            analysisDepth: match.analysisDepth as number | undefined,
            initialPosition: match.initialPosition as string | undefined,
          };
          set(state2 => ({
            games: [game, ...state2.games.filter(g => g.id !== game.id)],
            selectedGame: game,
            currentMoveIndex: -1,
          }));
          if (game.analyzedAt != null) {
            set(state2 => ({
              analysisCache: { ...state2.analysisCache, [game.id]: game },
              analyzedPgnHashes: { ...state2.analyzedPgnHashes, [hashPgn(game.pgn)]: true },
            }));
            void saveUserGame(authUser.id, game.id, { ...game, moves: JSON.parse(JSON.stringify(game.moves)), userSaved: false });
          }
          return game;
        }
      }
      return null;
    }
    const moves = typeof data.moves === 'string' ? JSON.parse(data.moves) as AnalyzedMove[] : (data.moves as AnalyzedMove[] | undefined) ?? [];
    const game: ChessGame = {
      id: data.id as string,
      shortId: data.shortId as string | undefined ?? shortId,
      white: data.white as ChessGame['white'],
      black: data.black as ChessGame['black'],
      result: data.result as string,
      date: data.date as string,
      pgn: data.pgn as string,
      moves,
      accuracy: data.accuracy as ChessGame['accuracy'] ?? undefined,
      classificationCounts: data.classificationCounts as ChessGame['classificationCounts'] ?? undefined,
      analyzedAt: data.analyzedAt as string | undefined,
      analysisDurationMs: data.analysisDurationMs as number | undefined,
      analysisDepth: data.analysisDepth as number | undefined,
      initialPosition: data.initialPosition as string | undefined,
    };
    set(state => ({
      games: [game, ...state.games.filter(g => g.id !== game.id)],
      selectedGame: game,
      currentMoveIndex: -1,
    }));
    if (game.analyzedAt != null) {
      set(state => ({
        analysisCache: { ...state.analysisCache, [game.id]: game },
        analyzedPgnHashes: { ...state.analyzedPgnHashes, [hashPgn(game.pgn)]: true },
      }));
    }
    return game;
  },

  resetGameStore: () => {
    if (activeAbortController) { activeAbortController.abort(); activeAbortController = null; }
    hypothesisAbortController?.abort();
    hypothesisAbortController = null;
    pendingAnalysis.clear();
    set({
    games: [],
    selectedGame: null,
    currentMoveIndex: -1,
    analyzing: false,
    autoAnalyzing: false,
    analysisProgress: 0,
    importError: null,
    analysisCache: {},
    analyzedPgnHashes: {},
    linkedGames: [],
    linkedLoading: false,
    linkedAnalyzing: false,
    linkedAnalysisProgress: '',
    importJustCompleted: false,
    hypothesisActive: false,
    hypothesisMoves: [],
    hypothesisBaseIndex: 0,
    hypothesisSearching: false,
    hypothesisLines: null,
    hypothesisDepth: 0,
  }); },
}));

async function runHypothesisSearch(tipMove: HypothesisMove): Promise<void> {
  // Abort any previous search (abort-and-restart so fast move sequences work).
  hypothesisAbortController?.abort();
  useGameStore.setState({ hypothesisSearching: true });

  const evaluator = createPositionEvaluator(tipMove.fen, {
    depth: useGameStore.getState().hypothesisDepth,
    linesCount: 2,
  });
  hypothesisAbortController = evaluator.controller;

  try {
    const lines = await evaluator.evaluate();
    // Guard staleness: only apply if tipMove is still the tip of the branch
    // (the user hasn't undone or played another move meanwhile).
    const moves = useGameStore.getState().hypothesisMoves;
    const isCurrent = moves.length > 0 && moves[moves.length - 1].index === tipMove.index;
    if (!isCurrent) return; // stale — drop the result
    useGameStore.setState(state => ({
      hypothesisMoves: state.hypothesisMoves.map(m =>
        m.index === tipMove.index
          ? { ...m, engineLines: lines, evaluation: getEvaluationResultFromLines(lines) }
          : m
      ),
      hypothesisLines: lines,
      hypothesisSearching: false,
    }));
  } catch (err: unknown) {
    // If the search was replaced by a newer one, leave hypothesisSearching alone.
    const moves = useGameStore.getState().hypothesisMoves;
    const isCurrent = moves.length > 0 && moves[moves.length - 1].index === tipMove.index;
    if (isCurrent) {
      useGameStore.setState({ hypothesisSearching: false });
    }
    if (err instanceof Error && err.message === 'aborted') return;
    console.warn('[GameStore] hypothesis search failed:', err);
  }
}

async function runEvaluationPipeline(game: ChessGame, depth: number, gameId: string): Promise<void> {
  const startTime = performance.now();

  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 4;
  const engineVersion = getEngineVersion(cores);
  const settings = useSettingsStore.getState().settings;
  const tier = detectDeviceTier();
  const effectiveDepth = settings.autoDepth ? Math.min(depth, recommendedDepth(tier)) : depth;
  const maxEngineCount = getOptimalEngineCount(
    settings.parallelWorkers > 0 ? settings.parallelWorkers : recommendedWorkers(tier)
  );

  const evaluator = createGameEvaluator(game, {
    engineVersion,
    maxEngineCount,
    engineDepth: effectiveDepth,
    engineLinesCount: 2,
    engineConfig: (engine) => {
      engine.setLineCount(2);
    },
    onProgress: (progress) => {
      useGameStore.setState({ analysisProgress: Math.round(progress * 90) });
    },
  });

  // Store abort controller so resetGameStore can abort on navigation
  if (activeAbortController) activeAbortController.abort();
  activeAbortController = evaluator.controller;
  // Clear reference once evaluation completes so it can't be double-aborted
  const cleanupController = () => { if (activeAbortController === evaluator.controller) activeAbortController = null; };

  const evaluatedGame = await evaluator.evaluate();
  cleanupController();
  useGameStore.setState({ analysisProgress: 95 });

  const analysedGame = getGameAnalysis(evaluatedGame, {
    includeBrilliant: true,
    includeCritical: true,
    includeTheory: true,
  });

  const durationMs = Math.round(performance.now() - startTime);
  analysedGame.analysisDurationMs = durationMs;
  analysedGame.analysisDepth = effectiveDepth;

  // Show toast notification
  useToastStore.getState().addToast({
    type: 'analysis',
    message: `Analysis complete — ${game.white.username} vs ${game.black.username}`,
    gameId: gameId,
  });

  const pgnHash = hashPgn(game.pgn);
  useGameStore.setState(state => ({
    analysisCache: { ...state.analysisCache, [gameId]: analysedGame },
    analyzedPgnHashes: { ...state.analyzedPgnHashes, [pgnHash]: true },
    selectedGame: state.selectedGame?.id === gameId
      ? { ...state.selectedGame, moves: mergeMoves(state.selectedGame.moves, analysedGame.moves), accuracy: analysedGame.accuracy, classificationCounts: analysedGame.classificationCounts, analyzedAt: analysedGame.analyzedAt, analysisDepth: analysedGame.analysisDepth }
      : state.selectedGame,
  }));

  void saveCachedAnalysis(analysedGame, depth, engineVersion).catch(e => console.warn('[Cache] save failed:', e));

  const shortId = analysedGame.shortId ?? game.shortId ?? gameId;
  void saveSharedGameToTurso(shortId, analysedGame).catch(e => console.warn('[Turso] save shared failed:', e));
  void saveGameToApi(shortId, analysedGame).catch(e => console.warn('[API] save failed:', e));

  const gameForFirestore = {
    ...analysedGame,
    moves: JSON.parse(JSON.stringify(analysedGame.moves)) as AnalyzedMove[],
    userSaved: false,
  };

  const u = useAuthStore.getState().user;
  if (u != null && (u.authProvider === 'google' || u.authProvider === 'anonymous')) {
    void saveUserGame(u.id, gameId, gameForFirestore).catch(e => console.warn('[Firestore] save game failed:', e));
  } else {
    const unsub = useAuthStore.subscribe((state, prev) => {
      if ((state.user?.authProvider === 'google' || state.user?.authProvider === 'anonymous') && !prev.user) {
        unsub();
        void saveUserGame(state.user.id, gameId, gameForFirestore).catch(e => console.warn('[Firestore] save game failed:', e));
      }
    });
    setTimeout(() => { unsub(); }, 15000);
  }
}

function hydratePgnMoves(pgn: string): AnalyzedMove[] {
  if (pgn === '') return [];
  const chess = new Chess();
  const moves: AnalyzedMove[] = [];
  let cleanPgn = '';
  let braceDepth = 0;
  for (const ch of pgn) {
    if (ch === '[' || ch === '{') braceDepth++;
    else if (ch === ']' || ch === '}') braceDepth--;
    else if (braceDepth === 0) cleanPgn += ch;
  }
  cleanPgn = cleanPgn.trim();
  const rawArray = cleanPgn.split(/\s+/).filter(
    word => word !== '' && !word.includes('.') && word !== '*' && /^(1-0|0-1|1\/2-1\/2)$/.exec(word) == null
  );
  for (const [i, rawMove] of rawArray.entries()) {
    try {
      const moveResult = chess.move(rawMove);
      moves.push({
        index: i,
        san: moveResult.san,
        from: moveResult.from,
        to: moveResult.to,
        fen: chess.fen(),
        color: moveResult.color,
      });
    } catch {
      break;
    }
  }
  return moves;
}

function mergeMoves(base: AnalyzedMove[], analysis: AnalyzedMove[]): AnalyzedMove[] {
  return base.map((move, i) => {
    const analyzed = analysis[i] ?? move;
    return {
      ...move,
      engineLines: analyzed.engineLines ?? move.engineLines,
      evaluation: analyzed.evaluation ?? move.evaluation,
      classification: analyzed.classification ?? move.classification,
      accuracy: analyzed.accuracy ?? move.accuracy,
      explanation: analyzed.explanation ?? move.explanation,
      opening: analyzed.opening ?? move.opening,
    };
  });
}
