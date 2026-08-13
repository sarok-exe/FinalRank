/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import { fetchCommunityUserStats } from '../lib/tursoCache';
import { estimateRating } from '../lib/community';
import type { CommunityMatchSummary, CommunityUserStats } from '../lib/community';
import CommunityAvatar from '../components/CommunityAvatar';

function formatAccuracy(accuracy: number | null): string {
  return accuracy != null ? `${accuracy.toFixed(1)}%` : '—';
}

function formatAnalyzedAt(raw: string): string {
  if (raw === '') return '—';
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(raw) ? `${raw.replace(' ', 'T')}Z` : raw;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatCard({ label, value, accent = false, note }: {
  readonly label: string;
  readonly value: string;
  readonly accent?: boolean;
  readonly note?: string;
}): React.ReactElement {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 flex flex-col items-center text-center">
      <span className={`text-xl font-black font-mono ${accent ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)]'}`}>
        {value}
      </span>
      <span className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">{label}</span>
      {note != null && <span className="text-[9px] text-[var(--color-text-muted)] mt-0.5">{note}</span>}
    </div>
  );
}

function StrongestCard({ summary }: { readonly summary: CommunityMatchSummary }): React.ReactElement {
  const { gameLabel, brilliantCount, accuracy, shortId } = summary;
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-bold text-[var(--color-text)]">{gameLabel}</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          {brilliantCount} brilliant move{brilliantCount === 1 ? '' : 's'} · {formatAccuracy(accuracy)} accuracy
        </p>
      </div>
      <Link
        to={`/game/${shortId}`}
        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 px-3 py-1.5 rounded-lg hover:brightness-110 transition-all"
      >
        Open game
        <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

function SummaryRow({ summary }: { readonly summary: CommunityMatchSummary }): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-[var(--color-text)] truncate">{summary.gameLabel}</p>
        <p className="text-[10px] text-[var(--color-text-muted)] font-mono mt-0.5">{formatAnalyzedAt(summary.analyzedAt)}</p>
      </div>
      <div className="flex items-center gap-4 text-right shrink-0">
        <div>
          <div className="text-xs font-black font-mono text-[var(--color-accent)]">{summary.brilliantCount}</div>
          <div className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">brilliants</div>
        </div>
        <div>
          <div className="text-xs font-black font-mono text-[var(--color-text)]">{formatAccuracy(summary.accuracy)}</div>
          <div className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">accuracy</div>
        </div>
      </div>
    </div>
  );
}

export default function CommunityUser(): React.ReactElement {
  const { userId } = useParams<{ userId: string }>();
  const [stats, setStats] = useState<CommunityUserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId == null) return;
    let cancelled = false;
    setLoading(true);
    setStats(null);
    void fetchCommunityUserStats(userId)
      .then(s => { if (!cancelled) setStats(s); })
      .catch(() => { if (!cancelled) setStats(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="h-5 w-24 bg-[var(--color-border)] rounded animate-pulse" />
        <div className="flex flex-col items-center space-y-3">
          <div className="w-20 h-20 rounded-full bg-[var(--color-border)] animate-pulse" />
          <div className="h-6 w-40 bg-[var(--color-border)] rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (stats == null) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col items-center text-center py-16 px-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl space-y-3">
          <div className="w-14 h-14 rounded-full bg-[var(--color-primary)]/15 flex items-center justify-center">
            <UserIcon className="w-7 h-7 text-[var(--color-text-muted)]" />
          </div>
          <p className="text-sm font-bold text-[var(--color-text)]">Player not found</p>
          <p className="text-xs text-[var(--color-text-muted)] max-w-sm">This player has no qualifying analyses yet</p>
          <Link
            to="/community"
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 px-3 py-1.5 rounded-lg hover:brightness-110 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Community</span>
          </Link>
        </div>
      </div>
    );
  }

  const rating = estimateRating(stats.avgAccuracy, stats.matches);
  const ratingLabel = rating != null ? `≈ ${rating}` : '—';

  return (
    <div className="max-w-3xl mx-auto space-y-5" id="community-user-page">
      <Link
        to="/community"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-text-muted)] hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Community</span>
      </Link>

      <div className="flex flex-col items-center text-center space-y-3">
        <CommunityAvatar avatar={stats.avatar} username={stats.username} size={80} />
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--color-text)] tracking-tight">{stats.username}</h1>
          <p className="text-xs text-[var(--color-text-muted)] font-mono">Depth 15+ analyses</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Matches" value={String(stats.matches)} />
        <StatCard label="Avg. Accuracy" value={formatAccuracy(stats.avgAccuracy)} />
        <StatCard label="Brilliants" value={String(stats.brilliants)} accent />
        <StatCard
          label="Est. Rating"
          value={ratingLabel}
          note={rating == null ? 'needs 3+ analyzed games' : undefined}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl p-4 space-y-3">
          <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-[var(--color-primary)] block flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-[var(--color-accent)]" />
            Strongest Match
          </span>
          {stats.strongest != null ? (
            <StrongestCard summary={stats.strongest} />
          ) : (
            <p className="text-xs text-[var(--color-text-muted)]">No qualifying games yet.</p>
          )}
        </div>

        <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl p-4 space-y-2.5">
          <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-[var(--color-primary)] block flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-[var(--color-accent)]" />
            Recent Matches
          </span>
          {stats.recent.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">No qualifying games analyzed yet.</p>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {stats.recent.map((summary, i) => (
                <SummaryRow key={`${summary.pgnHash}-${i}`} summary={summary} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
