import type React from 'react';
import { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, PieChart, ClipboardList, Trophy } from 'lucide-react';
import type { ChessGame } from '../types';
import { classificationColours, classificationNames } from '../constants/classifications';
import { useAuthStore } from '../stores/authStore';

type ReportTab = 'review' | 'accuracy' | 'eval' | 'classifications';

const REPORT_TABS: { id: ReportTab; label: string; icon: React.ElementType }[] = [
  { id: 'review', label: 'Game Review', icon: ClipboardList },
  { id: 'accuracy', label: 'Accuracy', icon: BarChart3 },
  { id: 'eval', label: 'Evaluation', icon: TrendingUp },
  { id: 'classifications', label: 'Classifications', icon: PieChart },
];

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
  const [activeTab, setActiveTab] = useState<ReportTab>('review');

  const moves = game.moves;
  const accuracy = game.accuracy;

  const classifiedMoves = useMemo(() => {
    return moves.filter(m => m.classification != null);
  }, [moves]);

  const evalData = useMemo(() => {
    return moves.map((m, i) => ({
      moveNumber: i + 1,
      score: m.evaluation?.score ?? null,
      isMate: m.evaluation?.isMate ?? false,
      mateIn: m.evaluation?.mateIn ?? null,
      color: m.color,
    }));
  }, [moves]);

  const classificationAgg = useMemo(() => {
    const white: Record<string, number> = {};
    const black: Record<string, number> = {};
    classifiedMoves.forEach(m => {
      if (m.classification) {
        const target = m.color === 'w' ? white : black;
        target[m.classification] = (target[m.classification] || 0) + 1;
      }
    });
    return { white, black };
  }, [classifiedMoves]);

  const whiteMoves = moves.filter(m => m.color === 'w');
  const blackMoves = moves.filter(m => m.color === 'b');
  const whiteAccuracies = whiteMoves.map(m => m.accuracy ?? null).filter(Boolean) as number[];
  const blackAccuracies = blackMoves.map(m => m.accuracy ?? null).filter(Boolean) as number[];

  const whiteAvgAcc = whiteAccuracies.length > 0
    ? whiteAccuracies.reduce((a, b) => a + b, 0) / whiteAccuracies.length
    : 0;
  const blackAvgAcc = blackAccuracies.length > 0
    ? blackAccuracies.reduce((a, b) => a + b, 0) / blackAccuracies.length
    : 0;

  const hasAccuracyData = accuracy?.white != null || accuracy?.black != null || classifiedMoves.length > 0;

  // "My side" — the logged-in user's color in this game. Defaults to White when
  // the username doesn't match either side (or there's no logged-in user).
  const myUsername = useAuthStore.getState().user?.username;
  const mySide: 'w' | 'b' = myUsername && myUsername === game.black.username ? 'b' : 'w';

  // Shared chess.com-style player header: avatar (or initial circle), name,
  // rating, accuracy, and a "You" badge when it's the logged-in user's side.
  const renderPlayerHeader = (side: 'w' | 'b'): React.JSX.Element => {
    const player = side === 'w' ? game.white : game.black;
    const name = player.username || (side === 'w' ? 'White' : 'Black');
    const isYou = mySide === side;
    return (
      <div className={`flex items-center gap-2 min-w-0 rounded-xl p-3 border ${isYou ? 'border-[var(--color-primary)]/50 bg-[var(--color-primary)]/5' : 'border-[var(--color-border)] bg-[var(--color-background)]'}`}>
        {player.avatar ? (
          <img src={player.avatar} alt={name} className="w-8 h-8 rounded-full object-cover border border-[var(--color-border)] shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] flex items-center justify-center text-sm font-black shrink-0">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-bold text-[var(--color-text)] truncate">{name}</span>
            {isYou && (
              <span className="shrink-0 text-[9px] font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/15 px-1.5 py-0.5 rounded">You</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[9px] text-[var(--color-text-muted)] font-mono">
            {player.rating != null && <span>Rating {player.rating}</span>}
            <span>Acc {side === 'w' ? (accuracy?.white != null ? accuracy.white.toFixed(1) : '—') : (accuracy?.black != null ? accuracy.black.toFixed(1) : '—')}</span>
          </div>
        </div>
      </div>
    );
  };

  // chess.com-style Game Review table. Two columns (White | Black) with the
  // player header, accuracy, classification tallies, game rating, and advanced
  // stats (opening name).
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

        {/* Game rating */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[var(--color-background)] rounded-xl p-3 text-center border border-[var(--color-border)]">
            <div className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider mb-1">Game Rating</div>
            <div className="text-lg font-black text-[var(--color-accent)]">{whiteRating ?? '—'}</div>
          </div>
          <div className="bg-[var(--color-background)] rounded-xl p-3 text-center border border-[var(--color-border)]">
            <div className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider mb-1">Game Rating</div>
            <div className="text-lg font-black text-[var(--color-accent)]">{blackRating ?? '—'}</div>
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

  const renderAccuracyTab = (): React.JSX.Element => (
    <div className="space-y-6">
      {hasAccuracyData ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[var(--color-background)] rounded-xl p-4 text-center border border-[var(--color-border)]">
              <div className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider mb-1">White</div>
              <div className="text-2xl font-black text-white">{accuracy?.white ?? whiteAvgAcc.toFixed(1)}%</div>
              <div className="text-[10px] text-[var(--color-text-muted)] mt-1">{whiteMoves.length} moves</div>
            </div>
            <div className="bg-[var(--color-background)] rounded-xl p-4 text-center border border-[var(--color-border)]">
              <div className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider mb-1">Black</div>
              <div className="text-2xl font-black text-white">{accuracy?.black ?? blackAvgAcc.toFixed(1)}%</div>
              <div className="text-[10px] text-[var(--color-text-muted)] mt-1">{blackMoves.length} moves</div>
            </div>
          </div>


        </>
      ) : (
        <div className="text-xs text-[var(--color-text-muted)] italic py-8 text-center">
          No analyzed moves yet. Run analysis to see accuracy data.
        </div>
      )}
    </div>
  );

  type EvalChartItem = { moveNumber: number; score: number; isMate: boolean; mateIn: number | null; color: 'w' | 'b'; classification: string | null; };
  const renderEvalTab = (): React.JSX.Element => {
    // Build chart data with classification, and orient scores from the user's
    // perspective: if the user is Black, invert cp so positive = good for them.
    const chartMoves: EvalChartItem[] = evalData
      .map((d, i) => ({
        moveNumber: d.moveNumber,
        isMate: d.isMate,
        mateIn: d.mateIn,
        color: d.color,
        classification: (moves[i]?.classification ?? null) as string | null,
        score: d.score != null && mySide === 'b' ? -d.score : d.score,
      }))
      .filter((d): d is EvalChartItem => d.score !== null);
    if (chartMoves.length === 0) {
      return (
        <div className="text-xs text-[var(--color-text-muted)] italic py-8 text-center">
          No evaluation data. Run analysis to see the evaluation graph.
        </div>
      );
    }

    const scores = chartMoves.map(d => d.score);
    const maxScore = Math.max(...scores.map(Math.abs), 100);
    const minScore = -maxScore;
    const range = maxScore - minScore || 1;
    const chartW = 600;
    const chartH = 200;
    const padding = { top: 20, right: 20, bottom: 30, left: 50 };
    const plotW = chartW - padding.left - padding.right;
    const plotH = chartH - padding.top - padding.bottom;
    const totalMoves = chartMoves.length;
    const stepX = totalMoves > 1 ? plotW / (totalMoves - 1) : plotW;

    const toX = (i: number): number => padding.left + i * stepX;
    const toY = (score: number): number => padding.top + plotH - ((score - minScore) / range) * plotH;

    const linePath = chartMoves.map((d, i) =>
      `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.score)}`
    ).join(' ');
    // Subtle area fill under the line, down to the bottom of the plot.
    const areaPath = `${linePath} L${toX(totalMoves - 1)},${padding.top + plotH} L${toX(0)},${padding.top + plotH} Z`;

    const zeroY = toY(0);

    const yTicks = 5;
    const yLabels = Array.from({ length: yTicks + 1 }, (_, i) =>
      Math.round(minScore + (range * i) / yTicks)
    );
    const xTicks = Math.max(2, Math.min(10, Math.floor(totalMoves / 5)));
    const xStep = Math.max(1, Math.floor(totalMoves / xTicks));

    const pointColor = (classification?: string | null): string =>
      classification ? (classificationColours[classification] || '#666') : '#666';

    return (
      <div className="space-y-4">
        {/* Player header */}
        <div className="grid grid-cols-2 gap-3">
          {renderPlayerHeader('w')}
          {renderPlayerHeader('b')}
        </div>

        <div className="bg-[var(--color-background)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="text-xs font-bold text-[var(--color-text)] mb-3">
            Evaluation Trend (cp){mySide === 'b' ? ' — from Black\'s perspective' : ''}
          </div>
          <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto" style={{ maxHeight: 220 }}>
            <rect x={padding.left} y={padding.top} width={plotW} height={plotH} fill="none" stroke="var(--color-border)" strokeWidth="0.5" />
            {yLabels.map((label, i) => {
              const y = padding.top + (plotH * i) / yTicks;
              return (
                <g key={i}>
                  <line x1={padding.left} y1={y} x2={chartW - padding.right} y2={y} stroke="var(--color-border)" strokeWidth="0.5" strokeDasharray="4 4" />
                  <text x={padding.left - 8} y={y + 3} textAnchor="end" fill="var(--color-text-muted)" fontSize="9" fontFamily="monospace">
                    {label}
                  </text>
                </g>
              );
            })}
            <line x1={padding.left} y1={zeroY} x2={chartW - padding.right} y2={zeroY} stroke="var(--color-text-muted)" strokeWidth="1" strokeDasharray="6 3" />
            {Array.from({ length: xTicks + 1 }).map((_, i) => {
              const idx = Math.min(i * xStep, totalMoves - 1);
              const x = toX(idx);
              return (
                <text key={i} x={x} y={chartH - 5} textAnchor="middle" fill="var(--color-text-muted)" fontSize="8" fontFamily="monospace">
                  {chartMoves[idx].moveNumber}
                </text>
              );
            })}
            <path d={areaPath} fill="var(--color-primary)" opacity="0.08" stroke="none" />
            <path d={linePath} fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {chartMoves.map((d, i) => {
              const cx = toX(i);
              const cy = toY(d.score);
              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r="3.5"
                  fill={pointColor(d.classification)}
                  stroke="var(--color-background)"
                  strokeWidth="1"
                />
              );
            })}
          </svg>
          <div className="flex items-center justify-center gap-4 text-[10px] text-[var(--color-text-muted)] mt-2">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-white border border-[var(--color-primary)]" /> White
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#333] border border-[var(--color-primary)]" /> Black
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderClassificationTab = (): React.JSX.Element => {
    const hasData = Object.keys(classificationAgg.white).length > 0 || Object.keys(classificationAgg.black).length > 0;

    if (!hasData) {
      return (
        <div className="text-xs text-[var(--color-text-muted)] italic py-8 text-center">
          No classification data. Run analysis to see the move quality breakdown.
        </div>
      );
    }

    // chess.com-style move-quality bar: one colored rectangle per move, in move
    // order, colored by that move's classification. Two rows (White / Black).
    const renderBar = (side: 'w' | 'b'): React.JSX.Element => {
      const sideMoves = moves.filter(m => m.color === side);
      if (sideMoves.length === 0) {
        return (
          <div className="text-xs text-[var(--color-text-muted)] italic py-4 text-center">
            No {side === 'w' ? 'white' : 'black'} moves.
          </div>
        );
      }
      return (
        <div className="flex items-center gap-2">
          <span className="w-10 shrink-0 text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
            {side === 'w' ? 'White' : 'Black'}
          </span>
          <div className="flex-1 flex gap-px overflow-hidden rounded-sm">
            {sideMoves.map((m, i) => {
              const color = m.classification ? (classificationColours[m.classification] || '#666') : '#666';
              return (
                <div
                  key={i}
                  className="flex-1 h-5"
                  style={{ backgroundColor: color, opacity: m.classification ? 1 : 0.25 }}
                  title={m.classification ? `${classificationNames[m.classification] || m.classification} — ${m.san}` : `${m.san}`}
                />
              );
            })}
          </div>
        </div>
      );
    };

    // Legend: each classification present, with swatch, label, and count.
    const legendEntries = Object.keys(classificationAgg.white)
      .concat(Object.keys(classificationAgg.black))
      .filter((k, i, arr) => arr.indexOf(k) === i)
      .sort((a, b) => (classificationAgg.white[b] || 0) + (classificationAgg.black[b] || 0) - ((classificationAgg.white[a] || 0) + (classificationAgg.black[a] || 0)));

    return (
      <div className="space-y-4">
        <div className="bg-[var(--color-background)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="text-xs font-bold text-[var(--color-text)] mb-3">Move Quality</div>
          <div className="space-y-2">
            {renderBar('w')}
            {renderBar('b')}
          </div>
        </div>

        <div className="bg-[var(--color-background)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider mb-2">Legend</div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {legendEntries.map(key => {
              const count = (classificationAgg.white[key] || 0) + (classificationAgg.black[key] || 0);
              return (
                <div key={key} className="flex items-center gap-1.5 text-xs">
                  <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: classificationColours[key] || '#666' }} />
                  <span className="text-[var(--color-text-muted)]">{classificationNames[key] || key}</span>
                  <span className="text-white font-bold">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 space-y-4">
      <div className="flex gap-1 border-b border-[var(--color-border)] pb-2">
        {REPORT_TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                active
                  ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                  : 'text-[var(--color-text-muted)] hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>
      {activeTab === 'review' && renderReviewTab()}
      {activeTab === 'accuracy' && renderAccuracyTab()}
      {activeTab === 'eval' && renderEvalTab()}
      {activeTab === 'classifications' && renderClassificationTab()}
    </div>
  );
}
