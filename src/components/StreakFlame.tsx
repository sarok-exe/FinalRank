import { Flame } from 'lucide-react';

const TIERS = [
  { min: 0,  color: '#f97316', glow: 'rgba(249,115,22,0.4)', speed: '2s',  scale: 1 },
  { min: 7,  color: '#ea580c', glow: 'rgba(234,88,12,0.5)', speed: '1.5s', scale: 1 },
  { min: 14, color: '#c026d3', glow: 'rgba(192,38,211,0.5)', speed: '1s',  scale: 1 },
  { min: 30, color: '#7c3aed', glow: 'rgba(124,58,237,0.6)', speed: '0.7s', scale: 1 },
];

export function getStreakTier(days: number) {
  let t = TIERS[0];
  for (const entry of TIERS) {
    if (days >= entry.min) t = entry;
  }
  return t;
}

interface StreakFlameProps {
  days: number;
  size?: number;
  showCount?: boolean;
  className?: string;
}

export default function StreakFlame({ days, size = 24, showCount, className = '' }: StreakFlameProps) {
  const tier = getStreakTier(days);
  const id = `streak-flame-${days}-${Math.random().toString(36).slice(2, 6)}`;

  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <span
        style={{
          display: 'inline-flex',
          animation: `streak-fire-${id} ${tier.speed} ease-in-out infinite`,
          filter: `drop-shadow(0 0 ${days >= 30 ? 10 : days >= 14 ? 7 : 4}px ${tier.glow})`,
        }}
      >
        <Flame
          size={size}
          style={{
            color: tier.color,
            transition: 'color 0.5s ease',
          }}
        />
      </span>
      {showCount && (
        <span style={{
          fontSize: `${size * 0.8}px`,
          fontWeight: 800,
          color: tier.color,
          transition: 'color 0.5s ease',
        }}>
          {days}
        </span>
      )}
      <style>{`
        @keyframes streak-fire-${id} {
          0%, 100% { transform: scale(${tier.scale}) rotate(0deg); }
          25% { transform: scale(${tier.scale * 1.08}) rotate(-2deg); }
          50% { transform: scale(${tier.scale * 1.12}) rotate(0deg); }
          75% { transform: scale(${tier.scale * 1.08}) rotate(2deg); }
        }
        @keyframes streak-glow-${id} {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </span>
  );
}
