import type React from 'react';
import { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, PieChart } from 'lucide-react';
import type { ChessGame } from '../types';
import { classificationColours } from '../constants/classifications';

type ReportTab = 'accuracy' | 'eval' | 'classifications';

const REPORT_TABS: { id: ReportTab; label: string; icon: React.ElementType }[] = [
  { id: 'accuracy', label: 'Accuracy', icon: BarChart3 },
  { id: 'eval', label: 'Evaluation', icon: TrendingUp },
  { id: 'classifications', label: 'Classifications', icon: PieChart },
];

const CLASSIFICATION_LABELS: Record<string, string> = {
  brilliant: 'Brilliant',
  critical: 'Critical',
  best: 'Best',
  excellent: 'Excellent',
  good: 'Good',
  okay: 'Okay',
  book: 'Book',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
  forced: 'Forced',
  risky: 'Risky',
};

type Props = {
  readonly game: ChessGame;
}

export default function AnalysisReport({ game }: Props): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<ReportTab>('accuracy');

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

  type EvalChartItem = { moveNumber: number; score: number | null; isMate: boolean; mateIn: number | null; color: 'w' | 'b'; };
  const renderEvalTab = (): React.JSX.Element => {
    const chartMoves = evalData.filter(
      (d): d is EvalChartItem & { score: number } => d.score !== null
    );
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

    const zeroY = toY(0);

    const yTicks = 5;
    const yLabels = Array.from({ length: yTicks + 1 }, (_, i) =>
      Math.round(minScore + (range * i) / yTicks)
    );
    const xTicks = Math.max(2, Math.min(10, Math.floor(totalMoves / 5)));
    const xStep = Math.max(1, Math.floor(totalMoves / xTicks));

    return (
      <div className="bg-[var(--color-background)] rounded-xl p-4 border border-[var(--color-border)]">
        <div className="text-xs font-bold text-[var(--color-text)] mb-3">Evaluation Trend (cp)</div>
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
          <path d={linePath} fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {chartMoves.map((d, i) => {
            const cx = toX(i);
            const cy = toY(d.score);
            const isWhite = d.color === 'w';
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r="3"
                fill={isWhite ? '#ffffff' : '#333333'}
                stroke="var(--color-primary)"
                strokeWidth="1.5"
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
    );
  };

  const renderClassificationTab = (): React.JSX.Element => {
    const hasData = Object.keys(classificationAgg.white).length > 0 || Object.keys(classificationAgg.black).length > 0;

    if (!hasData) {
      return (
        <div className="text-xs text-[var(--color-text-muted)] italic py-8 text-center">
          No classification data. Run analysis to see classification breakdown.
        </div>
      );
    }

    const renderPie = (data: Record<string, number>, label: string): React.JSX.Element | null => {
      const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
      const total = entries.reduce((s, [, v]) => s + v, 0);
      if (total === 0) return null;

      let cumulativeAngle = -90;
      const segments = entries.map(([key, count]) => {
        const angle = (count / total) * 360;
        const startAngle = cumulativeAngle;
        cumulativeAngle += angle;
        const endAngle = cumulativeAngle;
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;
        const r = 60;
        const cx = 80;
        const cy = 80;
        const x1 = cx + r * Math.cos(startRad);
        const y1 = cy + r * Math.sin(startRad);
        const x2 = cx + r * Math.cos(endRad);
        const y2 = cy + r * Math.sin(endRad);
        const largeArc = angle > 180 ? 1 : 0;
        const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
        const midAngle = startAngle + angle / 2;
        const midRad = (midAngle * Math.PI) / 180;
        const labelR = r * 0.65;
        const lx = cx + labelR * Math.cos(midRad);
        const ly = cy + labelR * Math.sin(midRad);
        return { key, count, path, color: classificationColours[key] || '#666', lx, ly, pct: Math.round((count / total) * 100) };
      });

      return (
        <div className="flex flex-col items-center">
          <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">{label}</div>
          <svg width="160" height="160" viewBox="0 0 160 160">
            {segments.map(s => (
              <path key={s.key} d={s.path} fill={s.color} stroke="var(--color-background)" strokeWidth="2" />
            ))}
            {segments.map(s => {
              if (s.pct < 8) return null;
              return (
                <text key={s.key} x={s.lx} y={s.ly} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="8" fontFamily="monospace" fontWeight="bold">
                  {s.pct}%
                </text>
              );
            })}
          </svg>
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {segments.map(s => (
              <div key={s.key} className="flex items-center gap-1 text-[9px]">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-[var(--color-text-muted)]">{CLASSIFICATION_LABELS[s.key] || s.key}</span>
                <span className="text-white font-bold">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      );
    };

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {renderPie(classificationAgg.white, 'White') ?? (
          <div className="text-xs text-[var(--color-text-muted)] italic py-8 text-center">No white classification data.</div>
        )}
        {renderPie(classificationAgg.black, 'Black') ?? (
          <div className="text-xs text-[var(--color-text-muted)] italic py-8 text-center">No black classification data.</div>
        )}
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
      {activeTab === 'accuracy' && renderAccuracyTab()}
      {activeTab === 'eval' && renderEvalTab()}
      {activeTab === 'classifications' && renderClassificationTab()}
    </div>
  );
}
