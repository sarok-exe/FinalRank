import { create } from 'zustand';
import { Chess } from 'chess.js';
import type { ChessGame, AnalyzedMove, HypothesisMove, EngineLine, MoveClassification } from '../types';
import { STARTING_FEN } from '../types';
import { createGameEvaluator, getEngineVersion, createPositionEvaluator, getEvaluationResultFromLines } from '../lib/engine/evaluate';
import { getTopEngineLine } from '../lib/engine';
import { classifyMove } from '../lib/reporter/classify';
import { getGameAnalysis } from '../lib/reporter/report';
import { useAuthStore } from './authStore';
import { useSettingsStore } from './settingsStore';
import { getCachedAnalysis, saveCachedAnalysis, getCachedAnalysisByKey, saveSharedGameToTurso, batchCheckAnalysis, hashPgn, saveUserAnalysisStats } from '../lib/tursoCache';
import { getOptimalEngineCount } from '../lib/engine/evaluate';
import { detectDeviceTier, recommendedDepth, recommendedWorkers } from '../lib/deviceTier';
import { saveUserGame, fetchUserGames, fetchPublishedGame } from '../lib/firebase';
import { fetchGameFromApi, saveGameToApi } from '../lib/api';
import { generateShortId, shortIdFromKey } from '../lib/shortId';
import { useToastStore } from './toastStore';
import { getLocalGames, type FullGame } from '../lib/localStore';
import { canMakeApiCall } from '../lib/firewall';
import { isValidPgn } from '../lib/validator';

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
  hypothesisError: boolean;
  hypothesisLines: EngineLine[] | null;
  hypothesisDepth: number;
  hypothesisClassification: string | null;

  importChessComGames(username: string): Promise<void>;
  importLichessGames(username: string): Promise<void>;
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
  consumeImportFlag(): void;
  enterHypothesisMode(depth?: number): boolean;
  exitHypothesisMode(): void;
  playHypothesisMove(from: string, to: string): boolean;
  undoHypothesisMove(): void;
  clearHypothesisMoves(): void;
}

const pendingAnalysis = new Map<string, Promise<boolean>>();
let activeAbortController: AbortController | null = null;
let hypothesisAbortController: AbortController | null = null;

/** Minimum gap between analysis-progress store updates. The engine reports a
 *  line for essentially every depth level searched (per MultiPV line), and the
 *  analysis page subscribes to the whole store, so an unbounded stream of
 *  setState calls re-renders the entire page for every engine line — long games
 *  at high depth saturate the main thread and freeze the tab. */
const PROGRESS_THROTTLE_MS = 150;

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
  hypothesisError: false,
  hypothesisLines: null,
  hypothesisDepth: 0,
  hypothesisClassification: null,

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
      hypothesisError: false,
      hypothesisClassification: null,
    });
    return true;
  },

  exitHypothesisMode: () => {
    hypothesisAbortController?.abort();
    hypothesisAbortController = null;
    set({ hypothesisActive: false, hypothesisMoves: [], hypothesisLines: null, hypothesisSearching: false, hypothesisError: false, hypothesisClassification: null });
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
      hypothesisError: false,
      hypothesisClassification: null,
    });
  },

  clearHypothesisMoves: () => {
    hypothesisAbortController?.abort();
    hypothesisAbortController = null;
    set({ hypothesisMoves: [], hypothesisLines: null, hypothesisSearching: false, hypothesisError: false, hypothesisClassification: null });
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
        hypothesisError: false,
        hypothesisLines: null,
        hypothesisDepth: 0,
        hypothesisClassification: null,
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
      hypothesisClassification: null,
    });
  },

  setCurrentMoveIndex: (index) => {
    const { selectedGame } = get();
    if (!selectedGame) return;
    const clampedIndex = Math.max(-1, Math.min(selectedGame.moves.length - 1, index));
    set({ currentMoveIndex: clampedIndex });
  },

  importChessComGames: async (username) => {
    if (!canMakeApiCall('chess.com')) {
      const msg = 'Too many requests. Please wait a moment before trying again.';
      set({ importError: msg, loadingGames: false });
      useToastStore.getState().addToast({ type: 'error', message: msg });
      return;
    }
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

  importLichessGames: async (username) => {
    if (!canMakeApiCall('lichess')) {
      const msg = 'Too many requests. Please wait a moment before trying again.';
      set({ importError: msg, loadingGames: false });
      useToastStore.getState().addToast({ type: 'error', message: msg });
      return;
    }
    set({ loadingGames: true, importError: null });
    try {
      const { fetchLichessGames } = await import('../lib/lichess');
      const loaded = await fetchLichessGames(username);
      if (loaded.length === 0) {
        set({ importError: 'No recent games found for this user.', loadingGames: false });
      } else {
        set({ games: loaded, selectedGame: null, currentMoveIndex: -1, loadingGames: false });
        const tursoStatus = await batchCheckAnalysis(loaded, useSettingsStore.getState().settings.engineDepth);
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
    if (!isValidPgn(pgn)) {
      const msg = 'Invalid PGN. Make sure it contains valid chess moves.';
      set({ importError: msg });
      useToastStore.getState().addToast({ type: 'error', message: msg });
      return;
    }
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
    const { games, analyzing, autoAnalyzing, hypothesisActive } = get();
    // Same engine-separation guard as triggerEvaluationPipeline: what-if mode
    // uses its own dedicated Engine instances, so no main-game engine analysis
    // may run while it is active.
    if (analyzing || autoAnalyzing || hypothesisActive) return;
    if (pendingAnalysis.has(gameId)) return;

    const { linkedGames } = get();
    const game = games.find(g => g.id === gameId) ?? linkedGames.find(g => g.id === gameId);
    if (!game || game.moves.length === 0) return;

    const settings = useSettingsStore.getState().settings;
    const depth = settings.engineDepth;
    const autoEnabled = settings.featureToggles.autoAnalyze;
    if (!autoEnabled) return;

    // Automatic analysis may be auto-clamped to the device-tier recommendation
    // when autoDepth is on, so weak devices aren't overwhelmed. A depth the user
    // explicitly picks in the UI is honored as-is (see triggerEvaluationPipeline).
    const tier = detectDeviceTier();
    const clampDepth = settings.autoDepth && settings.engineEffort !== 'max';
    const effectiveDepth = clampDepth ? Math.min(depth, recommendedDepth(tier)) : depth;

    // Always run analysis from scratch (no Turso cache lookup)

    set({ autoAnalyzing: true });

    const promise = runEvaluationPipeline(game, effectiveDepth, gameId);
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
    const { selectedGame, analyzing, hypothesisActive } = get();
    // What-if (hypothesis) mode never touches the main engine pool: its search
    // runs on its own dedicated Engine instance spawned per call inside
    // createPositionEvaluator (src/lib/engine/evaluate.ts:251 spawns `new
    // Engine(...)` per call), so the main-game pipeline is blocked entirely
    // while what-if mode is active.
    if (!selectedGame || analyzing || hypothesisActive || selectedGame.moves.length === 0) return;

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
      const ok = await runEvaluationPipeline(selectedGame, evalDepth, selectedGame.id);
      if (!ok) {
        // Defensive: never leave the UI stuck on "Analyzing..." even if a future
        // failure path forgets to reset the flags. runEvaluationPipeline already
        // resets them today; this guarantees it at the call site.
        set({ analyzing: false, autoAnalyzing: false, analysisProgress: 0 });
        return;
      }

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
      const withIds = withAvatars.map(g => ({ ...g, id: `linked-${g.id}`, shortId: shortIdFromKey(`linked-${g.id}`) }));

        const tursoStatus = await batchCheckAnalysis(withIds, useSettingsStore.getState().settings.engineDepth);
      set(state => {
        const deduped = [...state.games, ...withIds].filter(
          (g, i, arr) => arr.findIndex(x => x.id === g.id) === i
        );
        return {
          linkedGames: withIds,
          linkedLoading: false,
          analyzedPgnHashes: { ...state.analyzedPgnHashes, ...tursoStatus },
          games: deduped,
          selectedGame: state.selectedGame,
        };
      });

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

    /** Parse raw records into ChessGame objects. */
    const parseGames = (raw: Record<string, unknown>[]): ChessGame[] =>
      raw.map((r: Record<string, unknown>) => {
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

    const applyParsed = (parsed: ChessGame[]) => {
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
    };

    // 1. Read device cache first so the UI renders instantly.
    const localGames: FullGame[] = getLocalGames();
    if (localGames.length > 0) {
      applyParsed(parseGames(localGames as unknown as Record<string, unknown>[]));
    }

    // 2. Reconcile with Turso/Firestore in the background.
    const raw = await fetchUserGames(authUser.id);
    if (raw.length === 0) return;
    applyParsed(parseGames(raw));
  },

  loadGameByShortId: async (shortId: string) => {
    const state = get();
    const existing = state.games.find(g => g.shortId === shortId || g.id === shortId);
    if (existing) {
      const hydratedMoves = existing.moves.length > 0 ? existing.moves : hydratePgnMoves(existing.pgn);
      const updatedGame = { ...existing, moves: hydratedMoves };
      set({ selectedGame: updatedGame, currentMoveIndex: -1 });
      return updatedGame;
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
            void saveUserGame(authUser.id, game.id, { ...game, moves: JSON.parse(JSON.stringify(game.moves)) })
              .catch(e => console.warn('[Firestore] save game failed:', e));
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
}));

async function runHypothesisSearch(tipMove: HypothesisMove): Promise<void> {
  // Abort any previous search (abort-and-restart so fast move sequences work).
  hypothesisAbortController?.abort();
  useGameStore.setState({ hypothesisSearching: true, hypothesisError: false });

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

    // Classify the tip move against the position it was played from.
    const { selectedGame, hypothesisBaseIndex } = useGameStore.getState();
    let prevFen: string;
    let prevEngineLines: EngineLine[];
    if (tipMove.index === 0) {
      // First hypothesis move → the base position is the selected game's move
      // at hypothesisBaseIndex (or the starting position when it's < 0).
      const base = hypothesisBaseIndex >= 0 ? selectedGame?.moves[hypothesisBaseIndex] : undefined;
      prevFen = base?.fen ?? STARTING_FEN;
      prevEngineLines = base?.engineLines ?? [];
    } else {
      const prev = moves[moves.length - 2];
      prevFen = prev.fen;
      prevEngineLines = prev.engineLines ?? [];
    }

    let classification: MoveClassification | 'mate' | undefined = classifyMove(
      prevFen,
      prevEngineLines,
      tipMove.fen,
      lines,
      tipMove.san,
      { includeBrilliant: true, includeCritical: false, includeTheory: false },
    ).classification;

    // Mate override: a position where the engine announces mate is always
    // reported as 'mate', regardless of the loss-based classification.
    if (getTopEngineLine(lines)?.evaluation.type === 'mate') {
      classification = 'mate';
    }

    useGameStore.setState(state => ({
      hypothesisMoves: state.hypothesisMoves.map(m =>
        m.index === tipMove.index
          ? { ...m, engineLines: lines, evaluation: getEvaluationResultFromLines(lines), classification }
          : m
      ),
      hypothesisLines: lines,
      hypothesisClassification: classification ?? null,
      hypothesisSearching: false,
      hypothesisError: false,
    }));
  } catch (err: unknown) {
    // If the search was replaced by a newer one, leave hypothesisSearching alone.
    const moves = useGameStore.getState().hypothesisMoves;
    const isCurrent = moves.length > 0 && moves[moves.length - 1].index === tipMove.index;
    if (isCurrent) {
      useGameStore.setState({ hypothesisSearching: false, hypothesisError: true });
    }
    if (err instanceof Error && err.message === 'aborted') return;
    console.warn('[GameStore] hypothesis search failed:', err);
  }
}

async function runEvaluationPipeline(game: ChessGame, depth: number, gameId: string): Promise<boolean> {
  const startTime = performance.now();

  // Per-run throttle state for onProgress (see PROGRESS_THROTTLE_MS).
  let lastProgressValue = -1;
  let lastProgressEmitAt = 0;

  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 4;
  const engineVersion = getEngineVersion(cores);
  const settings = useSettingsStore.getState().settings;
  const tier = detectDeviceTier();
  // Depth is honored as requested: auto-clamping happens only in the automatic
  // analysis path (autoAnalyzeGame), so a depth the user explicitly picks in the
  // UI reaches the engine as-is.
  const effectiveDepth = depth;
  const effort = settings.engineEffort ?? 'balanced';
  const hashMb = effort === 'max' ? 128 : effort === 'quick' ? 16 : 64;
  const requestedWorkers =
    effort === 'max'
      ? 8
      : effort === 'quick'
        ? Math.min(settings.parallelWorkers > 0 ? settings.parallelWorkers : recommendedWorkers(tier), 2)
        : (settings.parallelWorkers > 0 ? settings.parallelWorkers : recommendedWorkers(tier));
  const maxEngineCount = getOptimalEngineCount(requestedWorkers);
  const engineTimeLimit =
    effort === 'quick'
      ? Math.min(settings.engineTimeLimitMs, 1000) / 1000
      : settings.engineGoMode === 'time' ? settings.engineTimeLimitMs / 1000 : undefined;

  const evaluator = createGameEvaluator(game, {
    engineVersion,
    maxEngineCount,
    engineDepth: effectiveDepth,
    engineTimeLimit,
    engineHashMb: hashMb,
    engineLinesCount: 2,
    engineConfig: (engine) => {
      engine.setLineCount(2);
    },
    onProgress: (progress) => {
      // Only emit when the visible value actually changed and at most ~6 times
      // per second, so analysis progress can't flood the store (and therefore
      // the whole analysis page) with re-renders.
      const value = Math.round(progress * 90);
      if (value === lastProgressValue) return;
      lastProgressValue = value;
      const now = Date.now();
      if (now - lastProgressEmitAt < PROGRESS_THROTTLE_MS) return;
      lastProgressEmitAt = now;
      useGameStore.setState({ analysisProgress: value });
    },
  });

  // Store abort controller so in-flight evaluation can be aborted
  if (activeAbortController) activeAbortController.abort();
  activeAbortController = evaluator.controller;
  // Clear reference once evaluation completes so it can't be double-aborted
  const cleanupController = () => { if (activeAbortController === evaluator.controller) activeAbortController = null; };

  let evaluatedGame: ChessGame;
  try {
    evaluatedGame = await evaluator.evaluate();
  } catch (err: unknown) {
    cleanupController();
    // 'aborted' is a normal cancellation and is handled by the callers.
    if (err instanceof Error && (err.message === 'aborted' || err.message === 'abort')) throw err;
    // The engine environment is broken (all worker slots died, e.g. WASM
    // blocked or OOM). Don't present a fake "analyzed" game — surface the
    // failure instead.
    useGameStore.setState({ analysisProgress: 0, analyzing: false, autoAnalyzing: false });
    useToastStore.getState().addToast({
      type: 'error',
      message: 'Analysis failed — the chess engine could not start. Reload and try again.',
    });
    return false;
  }
  cleanupController();

  // If every engine attempt failed (e.g. the engine worker/WASM is blocked),
  // don't present a fake "analyzed" game — surface the failure instead.
  const { attemptedPositions = 0, failedPositions = 0 } = evaluator;
  if (attemptedPositions > 0 && failedPositions === attemptedPositions) {
    useGameStore.setState({ analysisProgress: 0, analyzing: false, autoAnalyzing: false });
    useToastStore.getState().addToast({
      type: 'error',
      message: 'Analysis failed — the chess engine could not start. Reload and try again.',
    });
    return false;
  }
  if (failedPositions > 0) {
    useToastStore.getState().addToast({
      type: 'error',
      message: `Analysis finished with ${failedPositions} failed position(s) — some moves may be missing evaluations.`,
    });
  }
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

  // Tell the user when brilliants count or why they don't.
  const wB = analysedGame.classificationCounts?.white?.brilliant ?? 0;
  const bB = analysedGame.classificationCounts?.black?.brilliant ?? 0;
  const foundBrilliants = wB + bB;
  if (foundBrilliants > 0 && effectiveDepth >= 15) {
    useToastStore.getState().addToast({
      type: 'success',
      message: `${foundBrilliants} brilliant move${foundBrilliants === 1 ? '' : 's'} counted for your account`,
    });
  } else if (foundBrilliants > 0 && effectiveDepth < 15) {
    useToastStore.getState().addToast({
      type: 'info',
      message: `${foundBrilliants} brilliant move${foundBrilliants === 1 ? '' : 's'} found — analyze at depth 15+ for them to count (this run: depth ${effectiveDepth}).`,
    });
  }

  const pgnHash = hashPgn(game.pgn);
  useGameStore.setState(state => ({
    analysisCache: { ...state.analysisCache, [gameId]: analysedGame },
    analyzedPgnHashes: { ...state.analyzedPgnHashes, [pgnHash]: true },
    selectedGame: state.selectedGame?.id === gameId
      ? { ...state.selectedGame, moves: mergeMoves(state.selectedGame.moves, analysedGame.moves), accuracy: analysedGame.accuracy, classificationCounts: analysedGame.classificationCounts, analyzedAt: analysedGame.analyzedAt, analysisDepth: analysedGame.analysisDepth }
      : state.selectedGame,
  }));

  void saveCachedAnalysis(analysedGame, depth, engineVersion).catch(e => console.warn('[Cache] save failed:', e));

  const authUser = useAuthStore.getState().user;
  if (authUser != null) {
    void saveUserAnalysisStats(authUser, analysedGame, effectiveDepth)
      .catch((e: unknown) => console.warn('[Community] stats save failed:', e));
  }

  const shortId = analysedGame.shortId ?? game.shortId ?? gameId;
  void saveSharedGameToTurso(shortId, analysedGame).catch(e => console.warn('[Turso] save shared failed:', e));
  void saveGameToApi(shortId, analysedGame).catch(e => console.warn('[API] save failed:', e));

  const gameForFirestore = {
    ...analysedGame,
    moves: JSON.parse(JSON.stringify(analysedGame.moves)) as AnalyzedMove[],
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

  return true;
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
