import { useMemo } from 'react';

interface EvalBarProps {
  score: number | null;
  mate?: number | null;
  flipped?: boolean;
}

export default function EvalBar({ score, mate, flipped = false }: EvalBarProps) {
  const displayText = useMemo(() => {
    if (mate !== null && mate !== undefined) {
      return mate > 0 ? `M${Math.abs(mate)}` : `-M${Math.abs(mate)}`;
    }
    if (score === null) return '';
    return score > 0 ? `+${score.toFixed(1)}` : score.toFixed(1);
  }, [score, mate]);

  const whitePercent = useMemo(() => {
    if (mate !== null && mate !== undefined) {
      if (mate > 0) return 100;
      if (mate < 0) return 0;
      return 50;
    }
    if (score === null) return 50;
    const capped = Math.max(-8, Math.min(8, score));
    return ((capped + 8) / 16) * 100;
  }, [score, mate]);

  const whiteHeight = flipped ? 100 - whitePercent : whitePercent;
  const blackHeight = flipped ? whitePercent : 100 - whitePercent;

  return (
    <div className="relative w-[30px] h-full rounded overflow-hidden border border-[#4a4a4a] bg-[#333333] flex-shrink-0">
      <div
        className="w-full transition-all duration-300 ease-out flex flex-col"
        style={{ height: `${whiteHeight}%` }}
      >
        <div className="flex-1 bg-white" />
        {displayText && whitePercent > 50 && (
          <span className="text-[8px] font-black font-mono text-[#2a2a2a] text-center pb-1 select-none leading-none">
            {displayText}
          </span>
        )}
      </div>
      <div
        className="w-full transition-all duration-300 ease-out flex flex-col"
        style={{ height: `${blackHeight}%` }}
      >
        <div className="flex-1 bg-[#2a2a2a]" />
        {displayText && whitePercent <= 50 && (
          <span className="text-[8px] font-black font-mono text-white text-center pb-1 select-none leading-none">
            {displayText}
          </span>
        )}
      </div>
    </div>
  );
}
