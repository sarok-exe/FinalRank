import { ChessGame } from '../types';

const API_BASE = '/api';

export async function fetchGameFromApi(shortId: string): Promise<ChessGame | null> {
  try {
    const res = await fetch(`${API_BASE}/game/${encodeURIComponent(shortId)}`);
    if (!res.ok) return null;
    return await res.json() as ChessGame;
  } catch {
    return null;
  }
}
