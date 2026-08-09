export type Puzzle = {
  id: string;
  fen: string;
  moves: string;
  rating: number;
  popularity: number;
  plays: number;
  themes: string[];
  opening: string;
  dailyDate?: string;
};

export type PuzzleBatch = {
  puzzles: Puzzle[];
  count: number;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

export async function fetchPuzzles(options?: {
  count?: number;
  min?: number;
  max?: number;
  theme?: string;
}): Promise<PuzzleBatch> {
  const params = new URLSearchParams();
  if (options?.count) params.set('count', String(options.count));
  if (options?.min) params.set('min', String(options.min));
  if (options?.max) params.set('max', String(options.max));
  if (options?.theme) params.set('theme', options.theme);

  const res = await fetch(`${API_BASE}/api/puzzles${params.size ? `?${params}` : ''}`);
  if (!res.ok) {
    throw new Error(`Puzzle fetch failed (${res.status})`);
  }
  return res.json() as Promise<PuzzleBatch>;
}
