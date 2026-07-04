import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { Flame } from 'lucide-react';

const STREAK_COLORS = [
  { min: 0, color: '#f97316', glow: 'rgba(249,115,22,0.4)' },
  { min: 7, color: '#ea580c', glow: 'rgba(234,88,12,0.5)' },
  { min: 14, color: '#c026d3', glow: 'rgba(192,38,211,0.5)' },
  { min: 30, color: '#7c3aed', glow: 'rgba(124,58,237,0.6)' },
];

function getStreakColor(days: number) {
  let c = STREAK_COLORS[0];
  for (const entry of STREAK_COLORS) {
    if (days >= entry.min) c = entry;
  }
  return c;
}

export default function StreakNotification() {
  const toast = useAuthStore(s => s.streakToast);
  const clearToast = useAuthStore(s => s.clearStreakToast);
  const [visible, setVisible] = useState(false);
  const [content, setContent] = useState<{ newStreak: number; prevStreak: number } | null>(null);

  useEffect(() => {
    if (toast?.show && toast.newStreak > toast.prevStreak) {
      setContent({ newStreak: toast.newStreak, prevStreak: toast.prevStreak });
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(() => { clearToast(); }, 300);
      }, 4000);
      return () => { clearTimeout(timer); };
    }
  }, [toast]);

  if (!visible || !content) return null;

  const sc = getStreakColor(content.newStreak);

  return (
    <div
      style={{
        position: 'fixed', bottom: '24px', left: '50%', zIndex: 9999,
        transform: visible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(20px)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          border: `1px solid ${sc.color}44`,
          borderRadius: '16px', padding: '12px 24px',
          boxShadow: `0 0 30px ${sc.glow}, 0 4px 20px rgba(0,0,0,0.5)`,
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Flame
            className="w-7 h-7"
            style={{
              color: sc.color,
              filter: `drop-shadow(0 0 8px ${sc.color})`,
              animation: 'streak-pulse 1.2s ease-in-out infinite',
            }}
          />
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
            Day Streak +{content.newStreak - content.prevStreak}!
          </div>
          <div style={{ fontSize: '11px', color: sc.color, fontWeight: 600 }}>
            {content.newStreak} day{content.newStreak !== 1 ? 's' : ''} in a row
          </div>
        </div>
      </div>
      <style>{`
        @keyframes streak-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}
