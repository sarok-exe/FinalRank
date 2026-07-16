import { useMemo } from 'react';
import { Flame } from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';

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

function C(days: number): { r: number; g: number; b: number; hex(): string; rgba(alpha?: number): string; css(): string } {
  const t = Math.min(Math.max(days, 0), MAX);
  let i = 0;
  for (; i < STOPS.length - 1; i++) if (t <= STOPS[i + 1].d) break;
  const a = STOPS[i], b = STOPS[Math.min(i + 1, STOPS.length - 1)];
  const p = (t - a.d) / (b.d - a.d || 1);
  const lerp = (x: number, y: number): number => Math.round(x + (y - x) * p);
  const h = (n: number): string => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return {
    r: lerp(a.r, b.r), g: lerp(a.g, b.g), b: lerp(a.b, b.b),
    hex: () => `#${h(lerp(a.r, b.r))}${h(lerp(a.g, b.g))}${h(lerp(a.b, b.b))}`,
    rgba: (alpha = 1) => `rgba(${lerp(a.r, b.r)},${lerp(a.g, b.g)},${lerp(a.b, b.b)},${alpha})`,
    css: () => `rgb(${lerp(a.r, b.r)},${lerp(a.g, b.g)},${lerp(a.b, b.b)})`,
  };
}

function fixedColor(hex: string): { r: number; g: number; b: number; hex(): string; rgba(alpha?: number): string; css(): string } {
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

export function getHeatTier(days: number): { min: number; l: string; h: string; m: string } {
  let t = HEAT_TIERS[0];
  for (const e of HEAT_TIERS) if (days >= e.min) t = e;
  return t;
}

export function getStreakTier(days: number): { color: string; glow: string } {
  const col = C(days);
  return { color: col.hex(), glow: col.rgba(0.5) };
}

type Props = {
  readonly days: number;
  readonly size?: number;
  readonly showCount?: boolean;
  readonly className?: string;
}

export default function StreakFlame({ days, size = 24, showCount, className = '' }: Props): React.JSX.Element {
  const { streakFlameColorMode } = useSettingsStore(s => s.settings);

  const c = useMemo(() => {
    if (streakFlameColorMode === 'gold') return fixedColor('#ffd700');
    if (streakFlameColorMode === 'white') return fixedColor('#ffffff');
    return C(days);
  }, [days, streakFlameColorMode]);
  const dayFactor = Math.min(days / 365, 1);

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
      {showCount === true && (
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
