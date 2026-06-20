import { create } from 'zustand';
import { Chess } from 'chess.js';
import { ChessGame, AnalyzedMove } from '../types';
import { createGameEvaluator, getEngineVersion } from '../lib/engine/evaluate';
import { getGameAnalysis } from '../lib/reporter/report';
import { useAuthStore } from './authStore';
import { useSettingsStore } from './settingsStore';
import { getCachedAnalysis, saveCachedAnalysis, batchCheckAnalysis, hashPgn } from '../lib/tursoCache';
import { saveUserGame, fetchUserGames, deleteUserGame } from '../lib/firebase';

interface GameState {
  games: ChessGame[];
  selectedGame: ChessGame | null;
  currentMoveIndex: number;
  analyzing: boolean;
  autoAnalyzing: boolean;
  analysisProgress: number;
  importError: string | null;
  loadingGames: boolean;
  analysisCache: Record<string, ChessGame>;
  analyzedPgnHashes: Record<string, boolean>;
  linkedGames: ChessGame[];
  linkedLoading: boolean;
  linkedAnalyzing: boolean;
  linkedAnalysisProgress: string;

  importChessComGames: (username: string) => Promise<void>;
  selectGame: (gameId: string) => void;
  setCurrentMoveIndex: (index: number) => void;
  importPgnDirectly: (pgn: string) => void;
  triggerEvaluationPipeline: (depth?: number) => Promise<void>;
  autoAnalyzeGame: (gameId: string) => Promise<void>;
  setGames: (games: ChessGame[]) => void;
  fetchLinkedUserGames: () => Promise<void>;
  loadUserGames: () => Promise<void>;
  resetGameStore: () => void;
}

const pendingAnalysis = new Map<string, Promise<void>>();

export const useGameStore = create<GameState>((set, get) => ({
  games: [],
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

  setGames: (games) => set({ games }),

  selectGame: (gameId) => {
    if (!gameId) {
      set({ selectedGame: null, currentMoveIndex: -1 });
      return;
    }
    const { games, analysisCache } = get();
    const game = games.find((g) => g.id === gameId);
    if (!game) return;

    const hydratedMoves = hydratePgnMoves(game.pgn);
    const cached = analysisCache[gameId];
    const mergedMoves = hydratedMoves.map((move, i) => {
      if (cached?.moves[i]) {
        return { ...move, ...cached.moves[i] };
      }
      return move;
    });

    const updatedGame = { ...game, moves: mergedMoves };
    if (cached) {
      updatedGame.accuracy = cached.accuracy;
      updatedGame.classificationCounts = cached.classificationCounts;
      updatedGame.analyzedAt = cached.analyzedAt;
      updatedGame.analysisDurationMs = cached.analysisDurationMs;
    }

    set({ selectedGame: updatedGame, currentMoveIndex: -1 });
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
        get().autoAnalyzeGame(loaded[0].id);
      }
    } catch (err: any) {
      set({ importError: err.message || 'Failed to fetch games.', loadingGames: false });
    }
  },

  importPgnDirectly: (pgn) => {
    set({ importError: null });
    try {
      const hydratedMoves = hydratePgnMoves(pgn);
      if (hydratedMoves.length === 0) {
        throw new Error('Could not parse any chess moves from PGN.');
      }
      const whiteName = pgn.match(/\[White "(.*?)"\]/)?.[1] || 'White Player';
      const blackName = pgn.match(/\[Black "(.*?)"\]/)?.[1] || 'Black Player';
      const date = pgn.match(/\[Date "(.*?)"\]/)?.[1] || new Date().toISOString().split('T')[0];
      const result = pgn.match(/\[Result "(.*?)"\]/)?.[1] || '*';

      const newGame: ChessGame = {
        id: `pgn_custom_${Date.now()}`,
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

      get().autoAnalyzeGame(newGame.id);
    } catch (err: any) {
      set({ importError: err.message || 'PGN Parsing Failure' });
    }
  },

  autoAnalyzeGame: async (gameId) => {
    const { games, analyzing, autoAnalyzing } = get();
    if (analyzing || autoAnalyzing) return;
    if (pendingAnalysis.has(gameId)) return;

    const { linkedGames } = get();
    const game = games.find(g => g.id === gameId) || linkedGames.find(g => g.id === gameId);
    if (!game || game.moves.length === 0) return;

    const settings = useSettingsStore.getState().settings;
    const depth = settings.engineDepth;
    const autoEnabled = settings.featureToggles?.autoAnalyze ?? true;
    if (!autoEnabled) return;

    if (get().analysisCache[gameId]) return;

    const cached = await getCachedAnalysis(game.pgn, depth);
    if (cached) {
      const pgnHash = hashPgn(game.pgn);
      set(state => ({
        analysisCache: { ...state.analysisCache, [gameId]: cached },
        analyzedPgnHashes: { ...state.analyzedPgnHashes, [pgnHash]: true },
        selectedGame: state.selectedGame?.id === gameId
          ? { ...state.selectedGame, moves: mergeMoves(state.selectedGame.moves, cached.moves), accuracy: cached.accuracy, classificationCounts: cached.classificationCounts, analyzedAt: cached.analyzedAt, analysisDurationMs: cached.analysisDurationMs }
          : state.selectedGame,
      }));
      return;
    }

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

  triggerEvaluationPipeline: async (depth?: number) => {
    const { selectedGame, analyzing } = get();
    if (!selectedGame || analyzing || selectedGame.moves.length === 0) return;

    const evalDepth = depth ?? useSettingsStore.getState().settings.engineDepth;

    const cached = get().analysisCache[selectedGame.id];
    if (cached && cached.analyzedAt) {
      const isDepthSufficient = cached.moves.every(m => {
        const topDepth = m.engineLines?.reduce((d, l) => Math.max(d, l.depth || 0), 0) ?? 0;
        return topDepth >= evalDepth;
      });
      if (isDepthSufficient) {
        set(state => ({
          selectedGame: {
            ...state.selectedGame!,
            moves: mergeMoves(state.selectedGame!.moves, cached.moves),
            accuracy: cached.accuracy,
            classificationCounts: cached.classificationCounts,
            analyzedAt: cached.analyzedAt,
            analysisDurationMs: cached.analysisDurationMs,
          },
          analysisProgress: 100,
        }));
        return;
      }
    }

    const tursoCached = await getCachedAnalysis(selectedGame.pgn, evalDepth);
    if (tursoCached) {
      const pgnHash = hashPgn(selectedGame.pgn);
      set(state => ({
        analysisCache: { ...state.analysisCache, [selectedGame.id]: tursoCached },
        analyzedPgnHashes: { ...state.analyzedPgnHashes, [pgnHash]: true },
        selectedGame: {
          ...state.selectedGame!,
          moves: mergeMoves(state.selectedGame!.moves, tursoCached.moves),
          accuracy: tursoCached.accuracy,
          classificationCounts: tursoCached.classificationCounts,
          analyzedAt: tursoCached.analyzedAt,
          analysisDurationMs: tursoCached.analysisDurationMs,
        },
        analysisProgress: 100,
      }));
      return;
    }

    const pending = pendingAnalysis.get(selectedGame.id);
    if (pending) {
      set({ analyzing: true, analysisProgress: 50 });
      try {
        await pending;
        const result = get().analysisCache[selectedGame.id];
        if (result) {
          set(state => ({
            selectedGame: {
              ...state.selectedGame!,
              moves: mergeMoves(state.selectedGame!.moves, result.moves),
              accuracy: result.accuracy,
              classificationCounts: result.classificationCounts,
              analyzedAt: result.analyzedAt,
              analysisDurationMs: result.analysisDurationMs,
            },
            analysisProgress: 100,
            analyzing: false,
            autoAnalyzing: false,
          }));
        }
      } catch {
        set({ analyzing: false, analysisProgress: 0, autoAnalyzing: false });
      }
      return;
    }

    set({ analyzing: true, analysisProgress: 1 });

    try {
      await runEvaluationPipeline(selectedGame, evalDepth, selectedGame.id);

      const result = get().analysisCache[selectedGame.id];
      if (result) {
        set({
          selectedGame: result,
          analysisProgress: 100,
          analyzing: false,
        });
      }

      const authStore = useAuthStore.getState();
      if (authStore.user) {
        await authStore.incrementAnalyzedGames();
        await authStore.updateStreakOnAnalysis();
      }
    } catch (err: any) {
      if (err.message === 'aborted' || err.message === 'abort') return;
      set({ analyzing: false, analysisProgress: 0 });
    }
  },

  fetchLinkedUserGames: async () => {
    const authUser = useAuthStore.getState().user;
    const chessComUsername = authUser?.chessComUsername;
    if (!chessComUsername) return;

    set({ linkedLoading: true, linkedAnalyzing: false, linkedAnalysisProgress: '' });

    try {
      const { fetchChessComGames, fetchAvatarsForGames } = await import('../lib/chessCom');
      const raw = await fetchChessComGames(chessComUsername);
      const latest = raw.slice(0, 3);

      const withAvatars = await fetchAvatarsForGames(latest);
      const linkedIds = withAvatars.map(g => `linked-${g.id}`);
      const withIds = withAvatars.map((g, i) => ({ ...g, id: linkedIds[i] }));

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
        if (!existing) {
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
    if (!authUser || authUser.authProvider !== 'google') return;
    const raw = await fetchUserGames(authUser.id);
    if (raw.length === 0) return;
    const parsed: ChessGame[] = raw.map((r: any) => {
      const moves = typeof r.moves === 'string' ? JSON.parse(r.moves) : (r.moves || []);
      return {
        id: r.id as string,
        white: r.white as ChessGame['white'],
        black: r.black as ChessGame['black'],
        result: r.result as string,
        date: r.date as string,
        pgn: r.pgn as string,
        moves,
        accuracy: r.accuracy as ChessGame['accuracy'] || undefined,
        classificationCounts: r.classificationCounts as ChessGame['classificationCounts'] || undefined,
        analyzedAt: r.analyzedAt as string | undefined,
        analysisDurationMs: r.analysisDurationMs as number | undefined,
        initialPosition: r.initialPosition as string | undefined,
      };
    });
    const cache: Record<string, ChessGame> = {};
    const pgnMap: Record<string, boolean> = {};
    parsed.forEach(g => {
      if (g.analyzedAt) {
        cache[g.id] = g;
      }
      if (g.pgn) pgnMap[hashPgn(g.pgn)] = true;
    });
    set(state => ({
      games: [...parsed, ...state.games.filter(g => g.id.startsWith('legend-'))],
      analysisCache: { ...state.analysisCache, ...cache },
      analyzedPgnHashes: { ...state.analyzedPgnHashes, ...pgnMap },
    }));
  },

  resetGameStore: () => set({
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
  }),
}));

async function runEvaluationPipeline(game: ChessGame, depth: number, gameId: string): Promise<void> {
  const startTime = performance.now();

  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 4;
  const engineVersion = getEngineVersion(cores);

  const evaluator = createGameEvaluator(game, {
    engineVersion,
    engineDepth: depth,
    engineLinesCount: 2,
    engineConfig: (engine) => {
      engine.setLineCount(2);
      if (cores > 4) {
        engine.setThreadCount(Math.max(1, Math.round(cores * 0.7)));
      }
    },
    onProgress: (progress) => {
      useGameStore.setState({ analysisProgress: Math.round(progress * 90) });
    },
  });

  const evaluatedGame = await evaluator.evaluate();
  useGameStore.setState({ analysisProgress: 95 });

  const analysedGame = getGameAnalysis(evaluatedGame, {
    includeBrilliant: true,
    includeCritical: true,
    includeTheory: false,
  });

  const durationMs = Math.round(performance.now() - startTime);
  analysedGame.analysisDurationMs = durationMs;

  const pgnHash = hashPgn(game.pgn);
  useGameStore.setState(state => ({
    analysisCache: { ...state.analysisCache, [gameId]: analysedGame },
    analyzedPgnHashes: { ...state.analyzedPgnHashes, [pgnHash]: true },
    selectedGame: state.selectedGame?.id === gameId
      ? { ...state.selectedGame, moves: mergeMoves(state.selectedGame.moves, analysedGame.moves), accuracy: analysedGame.accuracy, classificationCounts: analysedGame.classificationCounts, analyzedAt: analysedGame.analyzedAt }
      : state.selectedGame,
  }));

  saveCachedAnalysis(analysedGame, depth);

  const authUser = useAuthStore.getState().user;
  if (authUser?.authProvider === 'google') {
    const gameForFirestore = {
      ...analysedGame,
      moves: JSON.parse(JSON.stringify(analysedGame.moves)),
    };
    saveUserGame(authUser.id, gameId || game.id, gameForFirestore as unknown as Record<string, unknown>);
  }
}

function hydratePgnMoves(pgn: string): AnalyzedMove[] {
  if (!pgn) return [];
  const chess = new Chess();
  const moves: AnalyzedMove[] = [];
  let cleanPgn = pgn.replace(/\[.*?\]/g, '').trim();
  cleanPgn = cleanPgn.replace(/\{.*?\}/g, '');
  const rawArray = cleanPgn.split(/\s+/).filter(
    word => word && !word.includes('.') && word !== '*' && !word.match(/^(1-0|0-1|1\/2-1\/2)$/)
  );
  for (let i = 0; i < rawArray.length; i++) {
    const rawMove = rawArray[i];
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
    const analyzed = analysis[i];
    if (!analyzed) return move;
    return {
      ...move,
      engineLines: analyzed.engineLines || move.engineLines,
      evaluation: analyzed.evaluation || move.evaluation,
      classification: analyzed.classification || move.classification,
      accuracy: analyzed.accuracy ?? move.accuracy,
      explanation: analyzed.explanation || move.explanation,
      opening: analyzed.opening || move.opening,
    };
  });
}
