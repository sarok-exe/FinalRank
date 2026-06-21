import { useRef, useEffect, useMemo } from 'react';
import { Flame } from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';
import { renderLayerDispatch, PRESET_TEMPLATES, OMEGA_TEMPLATE, ParticleSystem, CubicBezier, type LayerConfig } from '../lib/chronolayers';

const MAX = 365;

const STOPS = [
  { d: 0,   r: 255, g: 30,  b: 0   },
  { d: 15,  r: 255, g: 90,  b: 0   },
  { d: 30,  r: 255, g: 160, b: 0   },
  { d: 48,  r: 255, g: 220, b: 60  },
  { d: 65,  r: 255, g: 255, b: 180 },
  { d: 85,  r: 190, g: 225, b: 255 },
  { d: 105, r: 110, g: 140, b: 255 },
  { d: 130, r: 140, g: 50,  b: 226 },
  { d: 160, r: 170, g: 25,  b: 245 },
  { d: 210, r: 200, g: 15,  b: 210 },
  { d: 280, r: 230, g: 30,  b: 160 },
  { d: MAX, r: 255, g: 180, b: 255 },
];

function C(days: number) {
  const t = Math.min(Math.max(days, 0), MAX);
  let i = 0;
  for (; i < STOPS.length - 1; i++) if (t <= STOPS[i + 1].d) break;
  const a = STOPS[i], b = STOPS[Math.min(i + 1, STOPS.length - 1)];
  const p = (t - a.d) / (b.d - a.d || 1);
  const lerp = (x: number, y: number) => Math.round(x + (y - x) * p);
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return {
    r: lerp(a.r, b.r), g: lerp(a.g, b.g), b: lerp(a.b, b.b),
    hex: () => `#${h(lerp(a.r, b.r))}${h(lerp(a.g, b.g))}${h(lerp(a.b, b.b))}`,
    rgba: (alpha = 1) => `rgba(${lerp(a.r, b.r)},${lerp(a.g, b.g)},${lerp(a.b, b.b)},${alpha})`,
    css: () => `rgb(${lerp(a.r, b.r)},${lerp(a.g, b.g)},${lerp(a.b, b.b)})`,
  };
}

function fixedColor(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return {
    r, g, b,
    hex: () => hex,
    rgba: (alpha = 1) => `rgba(${r},${g},${b},${alpha})`,
    css: () => hex,
  };
}

export const HEAT_TIERS = [
  { min: 0,   l: 'Normal Day',          h: '25°C',    m: 'Every streak starts with a single step. Keep it alive!' },
  { min: 3,   l: 'Warming Up',          h: '45°C',    m: 'You\'re finding your rhythm. Don\'t look back.' },
  { min: 7,   l: 'Australian Summer',   h: '50°C',    m: 'The heat is rising! Real momentum building here.' },
  { min: 14,  l: 'Arabian Desert',      h: '65°C',    m: 'Scorching discipline. Habits this hot shape mountains.' },
  { min: 21,  l: 'Heat Wave',           h: '85°C',    m: 'Blazing focus — most people never get this far.' },
  { min: 30,  l: 'Gas Cylinder Flame',  h: '150°C',   m: 'Pressurized determination. Ready to explode with progress!' },
  { min: 45,  l: 'Lava Flow',           h: '800°C',   m: 'You\'re flowing like lava — unstoppable and untouchable.' },
  { min: 60,  l: 'Volcanic Eruption',   h: '1 200°C', m: 'Erupting with power! Magma-level dedication!' },
  { min: 90,  l: 'Forge Fire',          h: '1 500°C', m: 'Steel is forged in extreme heat. You\'re becoming unbreakable.' },
  { min: 120, l: 'Sun Surface',         h: '5 500°C', m: 'Solar intensity! You burn brighter with every single day.' },
  { min: 150, l: 'Solar Flare',         h: '8 000°C', m: 'Explosive dedication! A force of nature.' },
  { min: 200, l: 'Giant Gas Star',      h: '15 000°C',m: 'Stellar endurance. You\'ve entered the big leagues.' },
  { min: 250, l: 'Supergiant Star',     h: '30 000°C',m: 'Cosmic-level consistency. Truly astronomical.' },
  { min: 300, l: 'Supernova',           h: '10⁹°C',   m: 'Beyond imagination. Legendary status achieved!' },
  { min: 365, l: 'Pulsar Beam',         h: '10¹²°C',  m: 'Pulsar precision. You radiate pure power.' },
  { min: 450, l: 'Quasar Core',         h: '10¹⁵°C',  m: 'Quasar-level intensity. Entire galaxies feel your fire.' },
  { min: 550, l: 'Gamma-Ray Burst',     h: '10¹⁸°C',  m: 'The most energetic event in the universe. That\'s you.' },
  { min: 700, l: 'Event Horizon',       h: '10²⁰°C',  m: 'Beyond the horizon. Space and time bend around your streak.' },
  { min: 850, l: 'Big Bang Echo',       h: '10³²°C',  m: 'Echo of creation. You carry the fire of the universe.' },
  { min: MAX, l: 'Omega Flame',         h: '∞°C',     m: 'The final form. Beyond heat, beyond time. You are eternal.' },
];

export function getHeatTier(days: number) {
  let t = HEAT_TIERS[0];
  for (const e of HEAT_TIERS) if (days >= e.min) t = e;
  return t;
}

export function getStreakTier(days: number) {
  const col = C(days);
  return { color: col.hex(), glow: col.rgba(0.5) };
}

function getTemplateForStreak(days: number) {
  if (days >= 365) return OMEGA_TEMPLATE;
  if (days >= 100) return PRESET_TEMPLATES[1];
  if (days >= 30)  return PRESET_TEMPLATES[0];
  if (days >= 14)  return PRESET_TEMPLATES[4];
  return PRESET_TEMPLATES[4];
}

function getVarIdx(days: number) {
  if (days >= 365) return 4;
  if (days >= 200) return 3;
  if (days >= 90)  return 2;
  if (days >= 30)  return 1;
  return 0;
}

interface Props {
  days: number;
  size?: number;
  showCount?: boolean;
  className?: string;
}

export default function StreakFlame({ days, size = 24, showCount, className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const animCtx = useRef<{ running: boolean }>({ running: false });

  const { streakFlameAnimated, streakFlameColorMode } = useSettingsStore(s => s.settings);

  const c = useMemo(() => {
    if (streakFlameColorMode === 'gold') return fixedColor('#ffd700');
    if (streakFlameColorMode === 'white') return fixedColor('#ffffff');
    return C(days);
  }, [days, streakFlameColorMode]);
  const dayFactor = Math.min(days / 365, 1);
  const template = useMemo(() => getTemplateForStreak(days), [days]);
  const varIdx = useMemo(() => getVarIdx(days), [days]);
  const easeObj = useMemo(() => new CubicBezier(...(template.bezier as [number, number, number, number])), [template]);

  const useCanvas = size >= 28 && streakFlameAnimated;

  useEffect(() => {
    if (!useCanvas) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const CANVAS_SIZE = 200;
    canvas.width = CANVAS_SIZE * dpr;
    canvas.height = CANVAS_SIZE * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const particles = new ParticleSystem();
    particles.init(CANVAS_SIZE, CANVAS_SIZE, c.hex());
    let running = true;
    animCtx.current.running = true;

    const layerIds = template.layers;

    function makeConfig(): LayerConfig {
      return {
        color: c.hex(),
        opacity: 0.6 + dayFactor * 0.4,
        speed: 0.6 + dayFactor * 0.4,
        blendMode: 'lighter',
        customParams: {
          zoom: 1 + dayFactor * 0.6,
          circles: 4 + Math.floor(dayFactor * 6),
          thickness: 1.5 + dayFactor * 2,
          scale: 1.2,
          waves: 3 + Math.floor(dayFactor * 3),
          frequency: 0.015 - dayFactor * 0.003,
          symmetry: 8 + Math.floor(dayFactor * 6),
          dotCount: 40 + Math.floor(dayFactor * 50),
          maxDistance: 100,
          windX: 0,
          windY: 0.08,
          glitchFrequency: 0.12,
          vortexSpeed: 1.2 + dayFactor * 0.8,
        },
      };
    }

    function render(time: number) {
      if (!running || !ctx) return;
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      const t = time / 1000;
      const easeVal = easeObj.evaluate((Math.sin(t * 0.15 + 1) + 1) / 2);

      const bg = ctx.createRadialGradient(
        CANVAS_SIZE / 2, CANVAS_SIZE / 2, 0,
        CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2,
      );
      bg.addColorStop(0, c.rgba(0.02 + dayFactor * 0.08));
      bg.addColorStop(1, 'transparent');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      const varKey = `var${varIdx + 1}`;
      const conf = makeConfig();

      layerIds.forEach((lid) => {
        ctx.save();
        ctx.globalAlpha = conf.opacity;
        ctx.globalCompositeOperation = 'lighter';
        renderLayerDispatch(
          ctx, lid, varKey, t * conf.speed, conf, easeVal,
          CANVAS_SIZE, CANVAS_SIZE,
          CANVAS_SIZE / 2, CANVAS_SIZE / 2,
          dayFactor,
          lid === 'layer4' ? particles : null,
        );
        ctx.restore();
      });

      const vig = ctx.createRadialGradient(
        CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE * 0.3,
        CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE * 0.6,
      );
      vig.addColorStop(0, 'transparent');
      vig.addColorStop(1, `rgba(0,0,0,${0.1 + dayFactor * 0.15})`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      ctx.fillStyle = c.rgba(0.1 + dayFactor * 0.12);
      ctx.beginPath();
      ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE * 0.45, 0, Math.PI * 2);
      ctx.fill();

      animRef.current = requestAnimationFrame(render);
    }

    animRef.current = requestAnimationFrame(render);

    return () => {
      running = false;
      animCtx.current.running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [days, useCanvas, template, varIdx, c, dayFactor, easeObj, size]);

  if (!useCanvas) {
    return (
      <span className={className} style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        position: 'relative', userSelect: 'none',
      }}>
        <Flame
          size={size}
          style={{
            color: c.hex(), transition: 'color 0.6s ease',
            filter: `drop-shadow(0 0 ${3 + dayFactor * 10}px ${c.rgba(0.3 + dayFactor * 0.3)})`,
          }}
        />
        {showCount && (
          <span style={{
            fontSize: `${size * 0.85}px`, fontWeight: 800,
            color: c.hex(), transition: 'color 0.6s ease',
            textShadow: `0 0 ${4 + dayFactor * 8}px ${c.rgba(0.4 + dayFactor * 0.3)}`,
          }}>
            {days}
          </span>
        )}
      </span>
    );
  }

  return (
    <span className={className} style={{
      display: 'inline-flex', alignItems: 'center', gap: showCount ? '6px' : '0',
      position: 'relative', userSelect: 'none',
    }}>
      <span style={{
        position: 'relative', display: 'inline-flex',
        width: size, height: size, flexShrink: 0,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <canvas
          ref={canvasRef}
          style={{
            width: size, height: size,
            borderRadius: '50%',
            display: 'block',
          }}
        />
      </span>
      {showCount && (
        <span style={{
          fontSize: `${size * 0.85}px`, fontWeight: 800,
          color: c.hex(), transition: 'color 0.6s ease',
          textShadow: `0 0 ${4 + dayFactor * 10}px ${c.rgba(0.4 + dayFactor * 0.3)}`,
        }}>
          {days}
        </span>
      )}
    </span>
  );
}
