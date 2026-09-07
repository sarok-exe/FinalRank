import type React from 'react';
import { useMemo } from 'react';
import { Trophy } from 'lucide-react';
import type { ChessGame } from '../types';
import { classificationColours } from '../constants/classifications';
import { estimateGameRating, skillLevel } from '../lib/reporter/expectedPoints';

// chess.com-style game review rows. Each maps to one or more app classification
// keys (the app doesn't produce "Great" or "Miss", so those rows show 0).
const REVIEW_ROWS: { label: string; keys: string[]; color: string }[] = [
  { label: 'Brilliant', keys: ['brilliant'], color: classificationColours.brilliant },
  { label: 'Great', keys: [], color: '#8a7bd8' },
  { label: 'Book', keys: ['book'], color: classificationColours.book },
  { label: 'Best', keys: ['best', 'critical'], color: classificationColours.best },
  { label: 'Excellent', keys: ['excellent'], color: classificationColours.excellent },
  { label: 'Good', keys: ['good', 'okay'], color: classificationColours.good },
  { label: 'Inaccuracy', keys: ['inaccuracy', 'risky'], color: classificationColours.inaccuracy },
  { label: 'Mistake', keys: ['mistake'], color: classificationColours.mistake },
  { label: 'Miss', keys: [], color: '#c93230' },
  { label: 'Blunder', keys: ['blunder'], color: classificationColours.blunder },
];

type Props = {
  readonly game: ChessGame;
}

export default function AnalysisReport({ game }: Props): React.JSX.Element {
  const moves = game.moves;
  const accuracy = game.accuracy;

  const classifiedMoves = useMemo(() => {
    return moves.filter(m => m.classification != null);
  }, [moves]);

  const hasAccuracyData = accuracy?.white != null || accuracy?.black != null || classifiedMoves.length > 0;

  // chess.com-style Game Review table. Two columns (White | Black) with the
  // player header, accuracy, classification tallies, engine-estimated game
  // rating (from accuracy) with a Professional/Amateur skill label, and
  // advanced stats (opening name).
  const renderReviewTab = (): React.JSX.Element => {
    const counts = game.classificationCounts;
    const whiteCounts = counts?.white ?? {};
    const blackCounts = counts?.black ?? {};
    const hasData = hasAccuracyData || Object.keys(whiteCounts).length > 0 || Object.keys(blackCounts).length > 0;

    if (!hasData) {
      return (
        <div className="text-xs text-[var(--color-text-muted)] italic py-8 text-center">
          Run analysis to see the game review.
        </div>
      );
    }

    const whiteName = game.white.username || 'White';
    const blackName = game.black.username || 'Black';
    const whiteRating = game.white.rating;
    const blackRating = game.black.rating;
    const opening = game.moves[0]?.opening;

    const rowCount = (counts: Record<string, number>, keys: string[]): number =>
      keys.reduce((sum, k) => sum + (counts[k] || 0), 0);

    const renderPlayerHeader = (name: string, avatar?: string, rating?: number): React.JSX.Element => (
      <div className="flex items-center gap-2 min-w-0">
        {avatar ? (
          <img src={avatar} alt={name} className="w-7 h-7 rounded-full object-cover border border-[var(--color-border)] shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] flex items-center justify-center text-xs font-black shrink-0">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-xs font-bold text-[var(--color-text)] truncate">{name}</div>
          {rating != null && <div className="text-[9px] text-[var(--color-text-muted)] font-mono">Rating {rating}</div>}
        </div>
      </div>
    );

    // Engine-estimated rating + skill level from the player's accuracy.
    const renderGameRating = (acc: number | null | undefined): React.JSX.Element => {
      if (acc == null) {
        return <div className="text-lg font-black text-[var(--color-accent)]">—</div>;
      }
      const rating = estimateGameRating(acc);
      const level = skillLevel(rating);
      return (
        <>
          <div className="text-lg font-black text-[var(--color-accent)]">{rating}</div>
          <div className={`text-[9px] font-bold mt-0.5 ${level === 'Professional' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}>
            {level}
          </div>
        </>
      );
    };

    return (
      <div className="space-y-4">
        {/* Player header */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[var(--color-background)] rounded-xl p-3 border border-[var(--color-border)]">
            {renderPlayerHeader(whiteName, game.white.avatar, whiteRating)}
          </div>
          <div className="bg-[var(--color-background)] rounded-xl p-3 border border-[var(--color-border)]">
            {renderPlayerHeader(blackName, game.black.avatar, blackRating)}
          </div>
        </div>

        {/* Accuracy */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[var(--color-background)] rounded-xl p-4 text-center border border-[var(--color-border)]">
            <div className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider mb-1">Accuracy</div>
            <div className="text-3xl font-black text-white">
              {accuracy?.white != null ? accuracy.white.toFixed(1) : '—'}
            </div>
          </div>
          <div className="bg-[var(--color-background)] rounded-xl p-4 text-center border border-[var(--color-border)]">
            <div className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider mb-1">Accuracy</div>
            <div className="text-3xl font-black text-white">
              {accuracy?.black != null ? accuracy.black.toFixed(1) : '—'}
            </div>
          </div>
        </div>

        {/* Classification tallies */}
        <div className="bg-[var(--color-background)] rounded-xl border border-[var(--color-border)] overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] items-center px-3 py-2 border-b border-[var(--color-border)]">
            <span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Move quality</span>
            <span className="w-10 text-center text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">White</span>
            <span className="w-10 text-center text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Black</span>
          </div>
          {REVIEW_ROWS.map(row => {
            const w = rowCount(whiteCounts, row.keys);
            const b = rowCount(blackCounts, row.keys);
            const hasAny = w > 0 || b > 0;
            return (
              <div key={row.label} className="grid grid-cols-[1fr_auto_auto] items-center px-3 py-1.5 border-b border-[var(--color-border)]/60 last:border-b-0">
                <span className="flex items-center gap-2 text-xs text-[var(--color-text)]">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: row.color }} />
                  {row.label}
                </span>
                <span className={`w-10 text-center text-sm font-black font-mono ${hasAny ? 'text-white' : 'text-[var(--color-text-muted)]/40'}`}>{w}</span>
                <span className={`w-10 text-center text-sm font-black font-mono ${hasAny ? 'text-white' : 'text-[var(--color-text-muted)]/40'}`}>{b}</span>
              </div>
            );
          })}
        </div>

        {/* Engine-estimated game rating */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[var(--color-background)] rounded-xl p-3 text-center border border-[var(--color-border)]">
            <div className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider mb-1">Game Rating</div>
            {renderGameRating(accuracy?.white)}
          </div>
          <div className="bg-[var(--color-background)] rounded-xl p-3 text-center border border-[var(--color-border)]">
            <div className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider mb-1">Game Rating</div>
            {renderGameRating(accuracy?.black)}
          </div>
        </div>

        {/* Advanced stats */}
        <div className="bg-[var(--color-background)] rounded-xl p-3 border border-[var(--color-border)]">
          <div className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            Advanced Stats
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--color-text-muted)]">Opening</span>
              <span className="text-[var(--color-text)] font-semibold">{opening || '—'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--color-text-muted)]">Result</span>
              <span className="text-[var(--color-text)] font-semibold">{game.result || '—'}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 space-y-4">
      {renderReviewTab()}
    </div>
  );
}