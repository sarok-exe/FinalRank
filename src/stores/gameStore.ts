import { create } from 'zustand';
import { Chess } from 'chess.js';
import { ChessGame, AnalyzedMove } from '../types';
import { createGameEvaluator } from '../lib/engine/evaluate';
import { getGameAnalysis } from '../lib/reporter/report';
import { useAuthStore } from './authStore';

interface GameState {
  games: ChessGame[];
  selectedGame: ChessGame | null;
  currentMoveIndex: number;
  analyzing: boolean;
  analysisProgress: number;
  importError: string | null;
  loadingGames: boolean;

  importChessComGames: (username: string) => Promise<void>;
  selectGame: (gameId: string) => void;
  setCurrentMoveIndex: (index: number) => void;
  importPgnDirectly: (pgn: string) => void;
  triggerEvaluationPipeline: (depth?: number) => Promise<void>;
  setGames: (games: ChessGame[]) => void;
  resetGameStore: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  games: [],
  selectedGame: null,
  currentMoveIndex: -1,
  analyzing: false,
  analysisProgress: 0,
  importError: null,
  loadingGames: false,

  setGames: (games) => set({ games }),

  selectGame: (gameId) => {
    if (!gameId) {
      set({ selectedGame: null, currentMoveIndex: -1 });
      return;
    }
    const { games } = get();
    const game = games.find((g) => g.id === gameId);
    if (game) {
      const hydratedMoves = hydratePgnMoves(game.pgn);
      const updatedGame = { ...game, moves: hydratedMoves };
      set({ selectedGame: updatedGame, currentMoveIndex: -1 });
    }
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
        get().selectGame(loaded[0].id);
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
    } catch (err: any) {
      set({ importError: err.message || 'PGN Parsing Failure' });
    }
  },

  triggerEvaluationPipeline: async (depth = 10) => {
    const { selectedGame, analyzing } = get();
    if (!selectedGame || analyzing || selectedGame.moves.length === 0) return;

    set({ analyzing: true, analysisProgress: 1 });

    try {
      const evaluator = createGameEvaluator(selectedGame, {
        engineVersion: 'stockfish-17-lite-single.js',
        engineDepth: depth,
        engineLinesCount: 2,
        maxEngineCount: 4,
        engineConfig: (engine) => engine.setLineCount(2),
        onProgress: (progress) => {
          set({ analysisProgress: Math.round(progress * 90) });
        },
      });

      const evaluatedGame = await evaluator.evaluate();

      set({ analysisProgress: 95 });

      const analysedGame = getGameAnalysis(evaluatedGame, {
        includeBrilliant: true,
        includeCritical: true,
        includeTheory: false,
      });

      set({
        selectedGame: analysedGame,
        analysisProgress: 100,
      });

      await new Promise(resolve => setTimeout(resolve, 400));

      set({ analyzing: false });

      const authStore = useAuthStore.getState();
      if (authStore.user) {
        await authStore.incrementAnalyzedGames();
        await authStore.updateStreakOnAnalysis();
      }
    } catch (err: any) {
      if (err.message === 'abort') return;
      console.error(err);
      set({ analyzing: false, analysisProgress: 0 });
    }
  },

  resetGameStore: () => set({
    games: [],
    selectedGame: null,
    currentMoveIndex: -1,
    analyzing: false,
    analysisProgress: 0,
    importError: null,
  }),
}));

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
    } catch (e) {
      console.warn(`PGN hydration stopped at move: ${rawMove}`, e);
      break;
    }
  }
  return moves;
}
