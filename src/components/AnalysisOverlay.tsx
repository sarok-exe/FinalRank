import { useEffect, useRef, useState } from 'react';
import { Activity, CheckCircle2, Sparkles } from 'lucide-react';
import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';

type OverlayPhase = 'analyzing' | 'complete' | 'hiding' | 'hidden';

export default function AnalysisOverlay(): React.JSX.Element | null {
  const analyzing = useGameStore(s => s.analyzing);
  const progress = useGameStore(s => s.analysisProgress);
  const selectedGame = useGameStore(s => s.selectedGame);

  const [phase, setPhase] = useState<OverlayPhase>('hidden');
  const [smoothProgress, setSmoothProgress] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const targetProgressRef = useRef(0);
  const wasAnalyzingRef = useRef(false);
  const completeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Smoothly interpolate the progress bar towards the target value so it doesn't jump
  useEffect(() => {
    if (phase === 'analyzing') {
      targetProgressRef.current = Math.max(targetProgressRef.current, Math.min(100, progress));
    } else if (phase === 'complete') {
      targetProgressRef.current = 100;
    } else {
      targetProgressRef.current = 0;
    }
  }, [progress, phase]);

  useEffect(() => {
    if (phase !== 'analyzing' && phase !== 'complete') return;
    if (startTimeRef.current == null) startTimeRef.current = performance.now();

    const tick = (): void => {
      const target = targetProgressRef.current;
      setSmoothProgress(prev => {
        // ease toward target
        const diff = target - prev;
        if (Math.abs(diff) < 0.1) return target;
        // Different rates for analyzing vs completing
        const rate = phase === 'complete' ? 0.18 : 0.08;
        return prev + diff * rate;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [phase]);

  // Watch the analyzing state and switch phases accordingly
  useEffect(() => {
    if (analyzing) {
      wasAnalyzingRef.current = true;
      if (phase === 'hidden' || phase === 'hiding') {
        if (hideTimeoutRef.current != null) { clearTimeout(hideTimeoutRef.current); hideTimeoutRef.current = null; }
        if (completeTimeoutRef.current != null) { clearTimeout(completeTimeoutRef.current); completeTimeoutRef.current = null; }
        startTimeRef.current = performance.now();
        setSmoothProgress(0);
        targetProgressRef.current = 0;
        setPhase('analyzing');
      }
    } else if (wasAnalyzingRef.current) {
      // Analysis just ended — show success, then auto-dismiss
      wasAnalyzingRef.current = false;
      targetProgressRef.current = 100;
      setPhase('complete');
      if (completeTimeoutRef.current != null) clearTimeout(completeTimeoutRef.current);
      completeTimeoutRef.current = setTimeout(() => {
        setPhase('hiding');
        if (hideTimeoutRef.current != null) clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = setTimeout(() => {
          setPhase('hidden');
          setSmoothProgress(0);
        }, 360);
      }, 1400);
    }

    return () => {
      // Don't clear timeouts here
    };
  }, [analyzing, phase]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (completeTimeoutRef.current != null) clearTimeout(completeTimeoutRef.current);
      if (hideTimeoutRef.current != null) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  // Prevent body scroll when overlay is visible
  useEffect(() => {
    if (phase !== 'hidden') {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [phase]);

  // Get the current user streak for the completion view (must be before early return!)
  const user = useAuthStore(s => s.user);
  const streakIncremented = useAuthStore.getState().streakToast?.show ?? false;

  if (phase === 'hidden') return null;

  const isComplete = phase === 'complete' || phase === 'hiding';
  const isHiding = phase === 'hiding';
  const displayProgress = Math.round(smoothProgress);

  // Estimated time remaining (very rough)
  const elapsedSec = startTimeRef.current != null ? (performance.now() - startTimeRef.current) / 1000 : 0;
  const rate = elapsedSec > 0 ? smoothProgress / elapsedSec : 0;
  const remainingSec = rate > 0 && smoothProgress < 100 ? Math.max(0, (100 - smoothProgress) / rate) : 0;

  const showStreak = isComplete && streakIncremented && user != null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="analysis-overlay-title"
      aria-live="polite"
      className="fixed inset-0 flex items-center justify-center"
      style={{
        zIndex: 10000,
        animation: isHiding
          ? 'backdrop-out 360ms cubic-bezier(0.4, 0, 0.2, 1) forwards'
          : 'backdrop-in 280ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
        background: 'rgba(10, 10, 10, 0.55)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        padding: 'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
      }}
    >
      {/* The actual modal card */}
      <div
        className="relative w-full max-w-md"
        style={{
          animation: isHiding
            ? 'modal-out 320ms cubic-bezier(0.4, 0, 0.2, 1) forwards'
            : 'modal-in 320ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
        }}
      >
        <div
          className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
          style={{
            boxShadow: '0 30px 80px -20px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.04)',
          }}
        >
          {/* Decorative gradient top stripe */}
          <div
            className="absolute top-0 left-0 right-0 h-1"
            style={{
              background: isComplete
                ? 'linear-gradient(90deg, #4ade80, #22c55e, #16a34a)'
                : 'linear-gradient(90deg, var(--color-primary), var(--color-accent), var(--color-primary))',
              backgroundSize: '200% 100%',
              animation: isComplete ? 'none' : 'shimmer 3s linear infinite',
            }}
          />

          <div className="p-6 sm:p-8">
            {/* Icon */}
            <div className="flex items-center justify-center mb-5">
              {isComplete ? (
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: 'rgba(74, 222, 128, 0.25)',
                      animation: 'success-ring 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards',
                    }}
                  />
                  <div
                    className="relative w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center"
                    style={{ animation: 'success-burst 600ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
                  >
                    <CheckCircle2 className="w-9 h-9 text-green-400" strokeWidth={2.5} />
                  </div>
                </div>
              ) : (
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: 'radial-gradient(circle, rgba(96, 108, 56, 0.4) 0%, transparent 70%)',
                      animation: 'pulse-glow 2s ease-in-out infinite',
                    }}
                  />
                  <div
                    className="relative w-16 h-16 rounded-full bg-[var(--color-primary)]/20 border-2 border-[var(--color-primary)] flex items-center justify-center"
                    style={{ animation: 'spin-slow 8s linear infinite' }}
                  >
                    <Activity className="w-8 h-8 text-[var(--color-primary)]" strokeWidth={2.5} />
                  </div>
                </div>
              )}
            </div>

            {/* Title & subtitle */}
            <div className="text-center space-y-1.5 mb-6">
              <h2
                id="analysis-overlay-title"
                className="text-xl sm:text-2xl font-extrabold text-white tracking-tight"
              >
                {isComplete
                  ? (showStreak ? 'Streak Updated!' : 'Analysis Complete')
                  : 'Analyzing with Stockfish'}
              </h2>
              <p className="text-xs sm:text-sm text-[var(--color-text-muted)] leading-relaxed">
                {isComplete
                  ? (showStreak
                      ? `You're on a ${user?.streak ?? 0}-day streak. Keep it alive!`
                      : 'Your game has been fully evaluated.')
                  : (selectedGame
                      ? `${selectedGame.white?.username ?? 'White'} vs ${selectedGame.black?.username ?? 'Black'}`
                    : 'Evaluating every position in the game')}
              </p>
            </div>

            {/* Progress bar */}
            <div className="space-y-2.5">
              <div className="relative w-full h-3 bg-[var(--color-background)] rounded-full overflow-hidden border border-[var(--color-border)]">
                {/* Shimmer track */}
                <div
                  className="absolute inset-0 opacity-30"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
                    backgroundSize: '200% 100%',
                    animation: isComplete ? 'none' : 'shimmer 2s linear infinite',
                  }}
                />
                {/* Actual progress */}
                <div
                  className="relative h-full rounded-full will-anim"
                  style={{
                    width: `${displayProgress}%`,
                    background: isComplete
                      ? 'linear-gradient(90deg, #4ade80, #22c55e)'
                      : 'linear-gradient(90deg, var(--color-primary), var(--color-accent))',
                    transition: 'width 120ms linear, background 300ms ease',
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-bold text-[var(--color-primary)]">
                  {displayProgress}%
                </span>
                <span className="text-[var(--color-text-muted)] font-mono">
                  {isComplete
                    ? (showStreak ? '🔥 Streak +1' : '✓ Done')
                    : remainingSec > 1
                      ? `~${Math.ceil(remainingSec)}s remaining`
                      : 'Almost there…'}
                </span>
              </div>
            </div>

            {/* Streak celebration note */}
            {showStreak && isComplete && (
              <div
                className="mt-5 flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/30"
                style={{ animation: 'page-enter 400ms 200ms cubic-bezier(0.4, 0, 0.2, 1) both' }}
              >
                <Sparkles className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0" />
                <span className="text-xs text-[var(--color-accent)] font-semibold">
                  New milestone reached
                </span>
              </div>
            )}

            {/* Hint to close */}
            <p className="text-center text-[10px] text-[var(--color-text-muted)] mt-5">
              {isComplete ? 'Closing automatically…' : 'Please don\'t navigate away'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
