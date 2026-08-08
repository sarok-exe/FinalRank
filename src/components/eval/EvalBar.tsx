import { memo, useMemo } from 'react';

type EvalBarProps = {
  score: number | null;
  mate?: number | null;
  flipped?: boolean;
  horizontal?: boolean;
}

const EvalBar = memo(function EvalBar({ score, mate, flipped = false, horizontal = false }: EvalBarProps) {
  const displayText = useMemo(() => {
    if (mate !== null && mate !== undefined) {
      return mate > 0 ? `M${Math.abs(mate)}` : `-M${Math.abs(mate)}`;
    }
    if (score === null) return '';
    return score > 0 ? `+${score.toFixed(1)}` : score.toFixed(1);
  }, [score, mate]);

  const whitePercent = useMemo(() => {
    if (mate !== null && mate !== undefined) {
      if (mate > 0) return 95;
      if (mate < 0) return 5;
      return 50;
    }
    if (score === null) return 50;
    // wintrchess-style linear mapping: clamp(50 - cp/20, 5, 95)
    // cp = score * 100, so cp/20 = score * 5
    // Inverted for two-div layout: whitePercent = 50 + score * 5
    const raw = 50 + score * 5;
    return Math.max(5, Math.min(95, raw));
  }, [score, mate]);

  const whiteHeight = flipped ? 100 - whitePercent : whitePercent;
  const blackHeight = flipped ? whitePercent : 100 - whitePercent;
  const whiteAdvantage = whitePercent > 50;

  if (horizontal) {
    const whiteWidth = flipped ? 100 - whitePercent : whitePercent;
    return (
      <div className="relative w-full h-full rounded overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] flex-shrink-0">
        <div
          className="h-full transition-all duration-300 ease-out"
          style={{ width: `${whiteWidth}%`, backgroundColor: '#ffffff' }}
        />
        {displayText && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[10px] font-black font-mono text-[#2a2a2a] bg-white/75 rounded px-1.5 py-0.5 select-none leading-none">
              {displayText}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-[30px] h-full rounded overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] flex-shrink-0">
      <div
        className="w-full transition-all duration-300 ease-out flex flex-col"
        style={{ height: `${whiteHeight}%` }}
      >
        <div className="flex-1 bg-white" />
        {whiteAdvantage && displayText && (
          <span className="text-[8px] font-black font-mono text-[#2a2a2a] text-center pb-0.5 select-none leading-none">
            {displayText}
          </span>
        )}
      </div>
      <div
        className="w-full transition-all duration-300 ease-out flex flex-col"
        style={{ height: `${blackHeight}%` }}
      >
        {!whiteAdvantage && displayText && (
          <span className="text-[8px] font-black font-mono text-white text-center pt-0.5 select-none leading-none">
            {displayText}
          </span>
        )}
        <div className="flex-1 bg-[var(--color-surface)]" />
      </div>
    </div>
  );
});

export default EvalBar;
