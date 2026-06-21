import { useRef, useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getStreakMessage, markCelebrated, wouldSkipCelebration, shouldCelebrateStreak } from '../lib/streakMilestones';
import { playVictorySound } from '../lib/victorySound';
import { ParticleSystem } from '../lib/chronolayers';

export default function StreakCelebration() {
  const user = useAuthStore(s => s.user);
  const settings = useSettingsStore(s => s.settings);
  const days = user?.streak ?? 0;
  const prevRef = useRef(days);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
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

    const t1 = setTimeout(() => setPhase('flip'), 1000);
    const t2 = setTimeout(() => setPhase('new'), 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [days, settings.streakSoundEnabled, settings.streakSoundVolume]);

  useEffect(() => {
    if (!show) return;
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    const ps1 = new ParticleSystem();
    ps1.init(W, H, '#ffaa44');
    const ps2 = new ParticleSystem();
    ps2.init(W, H, '#ff4400');

    let running = true;

    function render(t: number) {
      if (!running || !ctx) return;
      ctx.clearRect(0, 0, W, H);
      const time = t / 1000;

      ctx.globalCompositeOperation = 'lighter';
      drawParticles(ctx, ps1, W, H, '#ffaa44', 0.03, 0.005, 0.97, 1.5, time);
      drawParticles(ctx, ps2, W, H, '#ff4400', -0.02, 0.003, 0.96, 1.0, time);

      ctx.globalCompositeOperation = 'source-over';
      const fade = 1 - Math.min(time / 3, 1);
      ctx.globalAlpha = 0.12 * fade;
      const glow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.min(W, H) * 0.4);
      glow.addColorStop(0, '#ffaa44');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;

      animRef.current = requestAnimationFrame(render);
    }

    animRef.current = requestAnimationFrame(render);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [show]);

  if (!show) return null;

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        animation: 'fade-in 0.3s ease-out',
      }} />
      <canvas ref={overlayRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

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

function drawParticles(
  ctx: CanvasRenderingContext2D, ps: ParticleSystem,
  w: number, h: number, color: string,
  wx: number, wy: number, drag: number, sz: number, t: number
) {
  const windX = wx + Math.sin(t * 0.5) * 0.02;
  const windY = wy + Math.cos(t * 0.7) * 0.01;
  ps.particles.forEach(p => {
    const tx = w / 2 + Math.cos(t * 0.3 + p.x * 0.03) * (w * 0.4);
    const ty = h / 2 + Math.sin(t * 0.4 + p.y * 0.03) * (h * 0.3);
    p.vx += (tx - p.x) * 0.001;
    p.vy += (ty - p.y) * 0.001;
  });
  ps.updateAndDraw(ctx, w, h, windX, windY, drag, color, sz);
}
