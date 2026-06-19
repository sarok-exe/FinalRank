import openings from '../../../resources/openings.json';

const db = openings as Record<string, string>;

export function getOpeningName(fen: string): string | undefined {
  const fenPieces = fen.split(' ')[0];
  if (!fenPieces) return undefined;
  return db[fenPieces];
}
