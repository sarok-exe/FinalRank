import { useNavigate } from 'react-router-dom';
import { X, CheckCircle2, AlertTriangle, Info, Zap } from 'lucide-react';
import { useToastStore } from '../stores/toastStore';

export default function ToastContainer(): React.ReactElement | null {
  const { toasts, removeToast } = useToastStore();
  const navigate = useNavigate();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-full max-w-md px-4">
      {toasts.map((toast) => {
        const iconMap = {
          success: CheckCircle2,
          error: AlertTriangle,
          info: Info,
          analysis: Zap,
        };
        const Icon = iconMap[toast.type];

        const colorMap = {
          success: 'border-green-600/50 bg-green-900/80',
          error: 'border-red-600/50 bg-red-900/80',
          info: 'border-blue-600/50 bg-blue-900/80',
          analysis: 'border-[var(--color-primary)]/50 bg-[var(--color-primary)]/20',
        };

        return (
          <div
            key={toast.id}
            role="alert"
            className={`flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-lg text-white text-sm animate-[slideIn_0.35s_ease-out] ${colorMap[toast.type]}`}
            style={{
              animation: 'slideUp 0.3s ease-out',
            }}
          >
            <Icon className="w-5 h-5 shrink-0 mt-0.5 text-white/80" />
            <div className="flex-1 min-w-0">
              <p className="text-xs leading-relaxed">{toast.message}</p>
              {toast.gameId && (
                <button
                  onClick={() => {
                    removeToast(toast.id);
                    navigate(`/game/${toast.gameId}`);
                  }}
                  className="text-[10px] font-bold text-white/70 hover:text-white mt-1 underline"
                >
                  View game →
                </button>
              )}
            </div>
            <button
              onClick={() => { removeToast(toast.id); }}
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5 text-white/60" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
