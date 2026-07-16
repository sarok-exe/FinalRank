import { useEffect, useState } from 'react';
import { Activity, CheckCircle2 } from 'lucide-react';
import { useGameStore } from '../stores/gameStore';

export default function AnalysisOverlay(): React.JSX.Element | null {
  const analyzing = useGameStore(s => s.analyzing);
  const progress = useGameStore(s => s.analysisProgress);
  const selectedGame = useGameStore(s => s.selectedGame);

  const [showComplete, setShowComplete] = useState(false);

  // When analysis finishes, flash the checkmark briefly then dismiss
  useEffect(() => {
    if (!analyzing && progress >= 100) {
      setShowComplete(true);
      const t = setTimeout(() => { setShowComplete(false); }, 1200);
      return () => { clearTimeout(t); };
    }
    if (analyzing) {
      setShowComplete(false);
    }
  }, [analyzing, progress]);

  // Lock body scroll while visible
  useEffect(() => {
    if (analyzing || showComplete) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [analyzing, showComplete]);

  if (!analyzing && !showComplete) return null;

  const isDone = showComplete;
  const displayProgress = isDone ? 100 : Math.min(100, Math.max(0, progress));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Analysis progress"
      className="fixed inset-0 flex items-center justify-center z-[10000]"
      style={{
        background: 'rgba(10, 10, 10, 0.55)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        animation: isDone
          ? 'backdrop-out 280ms ease forwards'
          : 'backdrop-in 200ms ease forwards',
      }}
    >
      <div
        className="relative w-full max-w-sm mx-4"
        style={{
          animation: isDone
            ? 'modal-out 240ms ease forwards'
            : 'modal-in 240ms ease forwards',
        }}
      >
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 sm:p-8 shadow-2xl text-center">
          {/* Icon */}
          <div className="mb-5 flex justify-center">
            {isDone ? (
              <div
                className="w-14 h-14 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center"
                style={{ animation: 'success-burst 500ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
              >
                <CheckCircle2 className="w-7 h-7 text-green-400" strokeWidth={2.5} />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-full border-2 border-[var(--color-primary)] flex items-center justify-center animate-spin">
                <Activity className="w-7 h-7 text-[var(--color-primary)]" strokeWidth={2} />
              </div>
            )}
          </div>

          {/* Title */}
          <h2 className="text-lg font-extrabold text-white tracking-tight mb-1.5">
            {isDone ? 'Analysis Complete' : 'Analyzing'}
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mb-5">
            {isDone
              ? 'Your game has been fully evaluated.'
              : selectedGame
                ? `${selectedGame.white?.username ?? 'White'} vs ${selectedGame.black?.username ?? 'Black'}`
                : 'Evaluating every position in the game'}
          </p>

          {/* Progress bar */}
          <div className="w-full h-2.5 bg-[var(--color-background)] rounded-full overflow-hidden border border-[var(--color-border)]">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${displayProgress}%`,
                background: isDone
                  ? 'linear-gradient(90deg, #4ade80, #22c55e)'
                  : 'linear-gradient(90deg, var(--color-primary), var(--color-accent))',
              }}
            />
          </div>
          <p className="text-[10px] font-mono text-[var(--color-text-muted)] mt-2">
            {displayProgress}%
          </p>
        </div>
      </div>
    </div>
  );
}
