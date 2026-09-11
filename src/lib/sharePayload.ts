import LZString from 'lz-string';
import type { ChessGame, AnalyzedMove } from '../types';

const SHARE_PAYLOAD_VERSION = 1;

type SharePayload = {
  v: typeof SHARE_PAYLOAD_VERSION;
  game: ChessGame;
};

// Strip AI-coach explanations (bulky, not needed to render moves/classifications).
function stripForShare(game: ChessGame): ChessGame {
  return {
    ...game,
    moves: game.moves.map((m) => {
      const { explanation, ...rest } = m;
      return rest as AnalyzedMove;
    }),
  };
}

export function buildShareUrl(game: ChessGame): string {
  const base = `${window.location.origin}/game/${game.shortId || game.id}`;
  if (!game.moves || game.moves.length === 0) return base;
  try {
    const payload: SharePayload = { v: SHARE_PAYLOAD_VERSION, game: stripForShare(game) };
    const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(payload));
    return `${base}#d=${encoded}`;
  } catch {
    return base;
  }
}

export function decodeSharePayload(hash: string): ChessGame | null {
  const match = hash.match(/[#&]d=([^&]+)/);
  if (!match) return null;
  try {
    const json = LZString.decompressFromEncodedURIComponent(match[1]);
    if (!json) return null;
    const payload = JSON.parse(json) as SharePayload;
    if (payload?.v !== SHARE_PAYLOAD_VERSION || !payload?.game?.moves) return null;
    return payload.game;
  } catch {
    return null;
  }
}