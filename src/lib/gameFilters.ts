import type { ChessGame } from '../types';

export type DateRange = 'all' | 'today' | 'week' | 'month';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse a game date in chess.com ("YYYY.MM.DD") or ISO ("YYYY-MM-DD...") form. */
function parseGameDate(date: string): Date | null {
  const chessCom = /^(\d{4})\.(\d{2})\.(\d{2})/.exec(date);
  if (chessCom) {
    const d = new Date(Number(chessCom[1]), Number(chessCom[2]) - 1, Number(chessCom[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Filter games by opponent username (case-insensitive substring) and by date
 * range. 'today' keeps the same calendar day, 'week' the last 7 days, 'month'
 * the last 30 days; 'all' applies no date filter. Games whose date cannot be
 * parsed are kept when no date filter is active and dropped otherwise.
 */
export function filterGames(
  games: ChessGame[],
  searchQuery: string,
  dateRange: DateRange,
): ChessGame[] {
  const query = searchQuery.trim().toLowerCase();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return games.filter(game => {
    if (query) {
      const white = (game.white?.username ?? '').toLowerCase();
      const black = (game.black?.username ?? '').toLowerCase();
      if (!white.includes(query) && !black.includes(query)) return false;
    }
    if (dateRange !== 'all') {
      const date = parseGameDate(game.date);
      if (!date) return false;
      const days = Math.floor((startOfToday.getTime() - date.getTime()) / DAY_MS);
      if (days < 0) return false;
      if (dateRange === 'today' && days !== 0) return false;
      if (dateRange === 'week' && days > 7) return false;
      if (dateRange === 'month' && days > 30) return false;
    }
    return true;
  });
}