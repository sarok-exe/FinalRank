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

export function getStreakTier(days: number): { color: string; glow: string } {
  const col = C(days);
  return { color: col.hex(), glow: col.rgba(0.5) };
}