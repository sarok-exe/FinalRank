const STORAGE_KEY = 'streak_celebrated';

const CHESS_PHRASES = [
  (s: number, _p: number) => `Day ${s}. A passed pawn never looks back. Neither should you.`,
  (s: number, p: number) => `From ${p} to ${s}. Another move closer to the crown.`,
  (s: number, _p: number) => `Day ${s}. On the board there's no undo — your streak is the same.`,
  (s: number, _p: number) => `${s} days. You've crossed the point of no return.`,
  (s: number, _p: number) => `Day ${s}. Every grandmaster was once a beginner who refused to quit.`,
  (s: number, p: number) => `${p} → ${s}. Consistency beats talent when talent sleeps in.`,
  (s: number, _p: number) => `Day ${s}. You're past the opening — the middle game is where legends rise.`,
  (s: number, _p: number) => `${s} days strong. The board is tilted. Keep pushing.`,
  (s: number, _p: number) => `Day ${s}. The hardest move to find is the one that keeps you going. You found it.`,
  (s: number, p: number) => `${p} → ${s}. Momentum is a passed pawn — unstoppable once rolling.`,
  (s: number, _p: number) => `Day ${s}. Positional grind. You've outplayed yesterday's self.`,
  (s: number, _p: number) => `${s} days. Zwischenzug — an in-between move that changes everything. This is yours.`,
  (s: number, _p: number) => `Day ${s}. You don't need a brilliant move. Just the right one.`,
  (s: number, p: number) => `${p} → ${s}. The endgame starts here. Precision wins.`,
  (s: number, _p: number) => `Day ${s}. Fortress mentality — unbreachable.`,
  (s: number, _p: number) => `${s} days. Tempo gained. Every day is a free development move.`,
  (s: number, _p: number) => `Day ${s}. Opposite-coloured bishops? Doesn't matter. The will to win decides.`,
  (s: number, p: number) => `${p} → ${s}. Simplification is a sign of strength. Keep it simple.`,
  (s: number, _p: number) => `Day ${s}. The board remembers every move. So do we.`,
  (s: number, _p: number) => `${s} days. Pawn structure tells the story — yours is rock solid.`,
];

export function getStreakMessage(streak: number, prevStreak: number): string {
  return CHESS_PHRASES[streak % CHESS_PHRASES.length](streak, prevStreak);
}

export function shouldCelebrateStreak(currentStreak: number, previousStreak: number): boolean {
  return currentStreak > previousStreak;
}

export function getLastCelebrated(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return 0;
    const parsed = JSON.parse(raw) as { streak?: number };
    return parsed.streak ?? 0;
  } catch { console.warn('Failed to parse last celebrated'); return 0; }
}

export function markCelebrated(streak: number): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ streak, time: Date.now() })); } catch { console.warn('Failed to mark celebrated'); }
}

export function clearCelebratedCache(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { console.warn('Failed to clear cache'); }
}

export function wouldSkipCelebration(days: number): boolean {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw == null) return false;
  try {
    const p = JSON.parse(raw) as { streak: number; time: number };
    return p.streak === days && (Date.now() - p.time < 30000);
  } catch { return false; }
}
