/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { fetchCommunityLeaderboard } from '../lib/tursoCache';
import { estimateRating } from '../lib/community';
import type { LeaderboardEntry } from '../lib/community';
import CommunityAvatar from '../components/CommunityAvatar';

function rankBadgeClass(index: number): string {
  if (index === 0) return 'bg-[#f5c542]/15 text-[#f5c542] border-[#f5c542]/40';
  if (index === 1) return 'bg-slate-300/10 text-slate-300 border-slate-300/30';
  if (index === 2) return 'bg-[#cd7f32]/15 text-[#cd7f32] border-[#cd7f32]/40';
  return 'bg-[var(--color-background)] text-[var(--color-text-muted)] border-[var(--color-border)]';
}

function formatAccuracy(avgAccuracy: number | null): string {
  return avgAccuracy != null ? `${avgAccuracy.toFixed(1)}%` : '—';
}

function formatRating(avgAccuracy: number | null, matches: number): string {
  const rating = estimateRating(avgAccuracy, matches);
  return rating != null ? `≈ ${rating}` : '—';
}

function RowStat({ label, value, accent = false }: {
  readonly label: string;
  readonly value: string;
  readonly accent?: boolean;
}): React.ReactElement {
  return (
    <div className="text-right">
      <div className={`text-sm font-black font-mono ${accent ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)]'}`}>
        {value}
      </div>
      <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{label}</div>
    </div>
  );
}

function LeaderboardSkeleton(): React.ReactElement {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 sm:gap-4 px-4 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] animate-pulse"
        >
          <div className="w-8 h-8 rounded-lg bg-[var(--color-border)]" />
          <div className="w-9 h-9 rounded-full bg-[var(--color-border)]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-28 bg-[var(--color-border)] rounded" />
            <div className="h-2.5 w-20 bg-[var(--color-border)] rounded" />
          </div>
          <div className="hidden sm:block h-4 w-16 bg-[var(--color-border)] rounded" />
        </div>
      ))}
    </div>
  );
}

export default function Community(): React.ReactElement {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchCommunityLeaderboard(50)
      .then(list => { if (!cancelled) setEntries(list); })
      .catch(() => { if (!cancelled) setEntries([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const renderContent = (): React.ReactElement => {
    if (loading) return <LeaderboardSkeleton />;
    if (entries.length === 0) {
      return (
        <div className="flex flex-col items-center text-center py-16 px-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl space-y-3">
          <div className="w-14 h-14 rounded-full bg-[var(--color-primary)]/15 flex items-center justify-center">
            <Trophy className="w-7 h-7 text-[var(--color-accent)]" />
          </div>
          <p className="text-sm font-bold text-[var(--color-text)]">No analyzers yet</p>
          <p className="text-xs text-[var(--color-text-muted)] max-w-sm">
            No analysis data yet — analyze a game at depth 15+ to join the board.
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {entries.map((entry, index) => (
          <button
            key={entry.userId}
            onClick={() => { void navigate(`/community/${entry.userId}`); }}
            className="w-full flex items-center gap-3 sm:gap-4 px-4 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-background)] transition-all text-left"
          >
            <span className={`w-8 h-8 shrink-0 rounded-lg border flex items-center justify-center text-sm font-black font-mono ${rankBadgeClass(index)}`}>
              {index + 1}
            </span>

            <CommunityAvatar avatar={entry.avatar} username={entry.username} size={36} />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[var(--color-text)] truncate">{entry.username}</p>
              <p className="text-[10px] text-[var(--color-text-muted)] font-mono truncate">
                {entry.matches} game{entry.matches === 1 ? '' : 's'} · {entry.brilliants} brilliant{entry.brilliants === 1 ? '' : 's'}
              </p>
            </div>

            <div className="hidden sm:flex items-center gap-5 md:gap-6 shrink-0">
              <RowStat label="Matches" value={String(entry.matches)} />
              <RowStat label="Brilliants" value={String(entry.brilliants)} accent />
              <RowStat label="Accuracy" value={formatAccuracy(entry.avgAccuracy)} />
              <RowStat label="Rating" value={formatRating(entry.avgAccuracy, entry.matches)} />
            </div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5" id="community-page">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 flex items-center justify-center shrink-0">
          <Trophy className="w-5 h-5 text-[var(--color-primary)]" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--color-text)] tracking-tight">Community</h1>
          <p className="text-xs text-[var(--color-text-muted)]">Top analyzers — ranked by analyzed games (depth 15+).</p>
        </div>
      </div>

      {renderContent()}
    </div>
  );
}
