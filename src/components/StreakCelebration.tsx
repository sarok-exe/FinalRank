import { useRef, useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getStreakMessage, markCelebrated, wouldSkipCelebration, shouldCelebrateStreak } from '../lib/streakMilestones';
import { playVictorySound } from '../lib/victorySound';

export default function StreakCelebration() {
  const user = useAuthStore(s => s.user);
  const settings = useSettingsStore(s => s.settings);
  const days = user?.streak ?? 0;
  const prevRef = useRef(days);
  const [show, setShow] = useState<{ prev: number; current: number; message: string } | null>(null);
  const [phase, setPhase] = useState<'old' | 'flip' | 'new' | null>(null);

  const dismiss = useCallback(() => {
    setShow(null);
    setPhase(null);
  }, []);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = days;

    if (days === prev) return;
    if (!shouldCelebrateStreak(days, prev)) return;
    if (wouldSkipCelebration(days)) return;

    markCelebrated(days);
    if (settings.streakSoundEnabled) {
      playVictorySound(settings.streakSoundVolume);
    }
    const msg = getStreakMessage(days, prev);
    setShow({ prev, current: days, message: msg });
    setPhase('old');

    const t1 = setTimeout(() => { setPhase('flip'); }, 1000);
    const t2 = setTimeout(() => { setPhase('new'); }, 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [days, settings.streakSoundEnabled, settings.streakSoundVolume]);

  if (!show) return null;

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        background: 'radial-gradient(circle at center, rgba(255,170,68,0.08) 0%, rgba(0,0,0,0.6) 60%)',
        animation: 'celebration-fade-in 0.4s ease-out',
      }}
    >
      {/* Decorative glow rings (CSS only, no canvas) */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        width: 'min(90vw, 600px)', height: 'min(90vw, 600px)',
        transform: 'translate(-50%, -50%)',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,170,68,0.15) 0%, transparent 70%)',
        animation: 'celebration-pulse 2s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        width: 'min(70vw, 450px)', height: 'min(70vw, 450px)',
        transform: 'translate(-50%, -50%)',
        borderRadius: '50%',
        border: '1px solid rgba(255,170,68,0.2)',
        animation: 'celebration-ring 3s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        width: 'min(50vw, 300px)', height: 'min(50vw, 300px)',
        transform: 'translate(-50%, -50%)',
        borderRadius: '50%',
        border: '1px solid rgba(255,170,68,0.3)',
        animation: 'celebration-ring 3s ease-in-out infinite 0.5s',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'relative', zIndex: 1, textAlign: 'center',
        perspective: '600px', pointerEvents: 'none',
      }}>
        {/* = DIGITAL CLOCK FLIP = */}
        <div style={{
          position: 'relative',
          height: 'clamp(80px, 22vw, 220px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '16px',
        }}>
          {(phase === 'old' || phase === 'flip') && (
            <span style={{
              position: 'absolute',
              fontSize: 'clamp(80px, 22vw, 220px)', fontWeight: 900,
              color: phase === 'old' ? '#fff' : 'rgba(255,255,255,0.6)',
              textShadow: phase === 'old'
                ? '0 0 50px rgba(255,170,68,0.5), 0 0 100px rgba(255,170,68,0.2)'
                : '0 0 30px rgba(255,170,68,0.2)',
              transformOrigin: 'bottom center',
              animation: phase === 'flip' ? 'flip-down 0.5s ease-in forwards' : 'none',
            }}>
              {show.prev}
            </span>
          )}

          {(phase === 'flip' || phase === 'new') && (
            <span style={{
              position: 'relative',
              fontSize: 'clamp(80px, 22vw, 220px)', fontWeight: 900,
              color: '#fff',
              textShadow: '0 0 60px rgba(255,170,68,0.6), 0 0 120px rgba(255,170,68,0.3)',
              transformOrigin: 'top center',
              animation: phase === 'flip'
                ? 'flip-up 0.5s ease-out forwards'
                : phase === 'new'
                ? 'color-pulse 0.8s ease-out 0.1s both'
                : 'none',
            }}>
              {show.current}
            </span>
          )}
        </div>

        {phase === 'new' && (
          <div style={{
            fontSize: 'clamp(12px, 1.8vw, 20px)', fontWeight: 600,
            color: 'rgba(255,200,100,0.5)',
            letterSpacing: '0.3em', textTransform: 'uppercase',
            marginBottom: '14px',
            animation: 'fade-in 0.4s ease-out',
          }}>
            Day Streak
          </div>
        )}

        {phase === 'new' && (
          <p style={{
            fontSize: 'clamp(14px, 2.5vw, 24px)', fontWeight: 500,
            color: 'rgba(255,255,255,0.85)',
            textShadow: '0 0 20px rgba(0,0,0,0.5)',
            maxWidth: '650px', margin: '0 auto', padding: '0 24px',
            lineHeight: 1.5,
            animation: 'fade-in 0.5s ease-out',
          }}>
            {show.message}
          </p>
        )}

        {phase === 'new' && (
          <p style={{
            fontSize: 'clamp(11px, 1.2vw, 14px)', fontWeight: 400,
            color: 'rgba(255,255,255,0.3)',
            marginTop: '32px',
            animation: 'fade-in 0.8s ease-out 0.5s both',
          }}>
            Tap anywhere to dismiss
          </p>
        )}
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes celebration-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes celebration-pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
          50%      { transform: translate(-50%, -50%) scale(1.05); opacity: 1; }
        }
        @keyframes celebration-ring {
          0%   { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
          50%  { transform: translate(-50%, -50%) scale(1.0); opacity: 0.6; }
          100% { transform: translate(-50%, -50%) scale(1.2); opacity: 0; }
        }
        @keyframes flip-down {
          0%   { transform: rotateX(0deg); opacity: 1; }
          100% { transform: rotateX(-90deg); opacity: 0; }
        }
        @keyframes flip-up {
          0%   { transform: rotateX(90deg); opacity: 0; }
          100% { transform: rotateX(0deg); opacity: 1; }
        }
        @keyframes color-pulse {
          0%   { color: #fff; text-shadow: 0 0 60px rgba(255,255,255,0.8), 0 0 120px rgba(255,255,255,0.4); }
          40%  { color: #ffe066; text-shadow: 0 0 70px rgba(255,224,102,0.7), 0 0 140px rgba(255,224,102,0.35); }
          100% { color: #fff; text-shadow: 0 0 60px rgba(255,170,68,0.6), 0 0 120px rgba(255,170,68,0.3); }
        }
      `}</style>
    </div>
  );
}
