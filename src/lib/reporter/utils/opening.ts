import openings from '../../../resources/openings.json';

const db = openings as Record<string, string>;

/** Book classifications only apply inside the first N plies; after that the game
 *  is out of opening theory even if the piece placement re-transposes into book. */
export const BOOK_MAX_PLY = 20;

export function getOpeningName(fen: string): string | undefined {
  const parts = fen.split(' ');
  const fenPieces = parts[0];
  if (!fenPieces) return undefined;
  const fullmove = parseInt(parts[5] ?? '1', 10);
  if (isNaN(fullmove) || fullmove <= 0) return undefined;
  const sideToMove = parts[1] ?? 'w';
  const ply = (fullmove - 1) * 2 + (sideToMove === 'b' ? 1 : 0);
  if (ply > BOOK_MAX_PLY) return undefined;
  return db[fenPieces];
}
