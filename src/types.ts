export interface User {
  id: string;
  username: string;
  email: string;
  avatar: string;
  streak: number;
  analyzedCount: number;
  lastActiveDate: string | null;
  settings: UserSettings;
}

export type EngineGoMode = 'depth' | 'time';

export interface UserSettings {
  engineDepth: number;
  engineGoMode: EngineGoMode;
  engineTimeLimitMs: number;
  boardColor: 'green' | 'blue' | 'brown' | 'charcoal' | 'elegant';
  boardOrientation: 'white' | 'black';
  notificationsEnabled: boolean;
  audioEnabled: boolean;
  audioVolume: number;
  animationsEnabled: boolean;
  shortcutsEnabled: boolean;
  featureToggles: {
    showArrows: boolean;
    showCoordinates: boolean;
    autoAnalyze: boolean;
  };
}

export const CLASSIFICATION_VALUES = {
  blunder: 0,
  mistake: 1,
  inaccuracy: 2,
  risky: 2,
  okay: 3,
  good: 3,
  book: 5,
  excellent: 4,
  best: 5,
  critical: 5,
  brilliant: 5,
  forced: 5,
} as const;

export const CLASSIFICATION_NAGS: Record<string, string | undefined> = {
  brilliant: '$3',
  critical: '$1',
  inaccuracy: '$6',
  mistake: '$2',
  blunder: '$4',
  risky: '$5',
};

export type MoveClassification =
  | 'brilliant'
  | 'critical'
  | 'best'
  | 'excellent'
  | 'good'
  | 'okay'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'forced'
  | 'risky';

export enum EngineVersion {
  LICHESS_CLOUD = 'lichess-cloud',
  STOCKFISH_17_LITE = 'stockfish-17-lite-single.js',
  STOCKFISH_18_LITE = 'stockfish-18-lite-single.js',
  STOCKFISH_OFFICIAL = 'stockfish-official.js',
}

export interface Evaluation {
  type: 'centipawn' | 'mate';
  value: number;
}

export interface EngineLineMove {
  uci: string;
  san: string;
}

export interface EngineLine {
  evaluation: Evaluation;
  source: string;
  depth: number;
  index: number;
  moves: EngineLineMove[];
}

export interface EvaluationResult {
  score: number;
  isMate: boolean;
  mateIn?: number;
  bestMove?: string;
  pv?: string[];
  depthReached?: number;
}

export interface AnalyzedMove {
  index: number;
  san: string;
  from: string;
  to: string;
  fen: string;
  color: 'w' | 'b';
  evaluation?: EvaluationResult;
  engineLines?: EngineLine[];
  classification?: MoveClassification;
  accuracy?: number;
  explanation?: string;
  opening?: string;
}

export interface ChessGame {
  id: string;
  white: { username: string; rating?: number; avatar?: string };
  black: { username: string; rating?: number; avatar?: string };
  result: string;
  date: string;
  initialPosition?: string;
  pgn: string;
  moves: AnalyzedMove[];
  accuracy?: {
    white: number;
    black: number;
  };
  classificationCounts?: {
    white: Record<string, number>;
    black: Record<string, number>;
  };
  analyzedAt?: string;
}

export interface ClockPreset {
  id: string;
  name: string;
  timeLimit: number;
  increment: number;
  type: 'bullet' | 'blitz' | 'rapid' | 'classic' | 'custom';
}

export const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const PIECE_VALUES: Record<string, number> = {
  p: 1, n: 3, b: 3, r: 5, q: 9, k: Infinity,
  P: 1, N: 3, B: 3, R: 5, Q: 9, K: Infinity,
};

export const PIECE_NAMES: Record<string, string> = {
  p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King',
  P: 'Pawn', N: 'Knight', B: 'Bishop', R: 'Rook', Q: 'Queen', K: 'King',
};
