import type { ChessGame } from '../types';
import { getFirebaseUser } from './firebase';

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

export async function saveGameToApi(shortId: string, gameData: ChessGame): Promise<boolean> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const user = getFirebaseUser();
    if (user) {
      try {
        headers['Authorization'] = `Bearer ${await user.getIdToken()}`;
      } catch { /* token unavailable — send without auth */ }
    }
    const res = await fetch(`${API_BASE}/game/save`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        shortId,
        gameData: {
          ...gameData,
          moves: JSON.parse(JSON.stringify(gameData.moves)) as typeof gameData.moves,
        },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}