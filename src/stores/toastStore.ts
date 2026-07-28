import { create } from 'zustand';

// Toast notification store — bottom notification system
// Displays analysis-complete, errors, and other events with dismiss (X) buttons.

type ToastType = 'success' | 'error' | 'info' | 'analysis';

type Toast = {
  id: string;
  type: ToastType;
  message: string;
  gameId?: string;
  createdAt: number;
};

type ToastState = {
  toasts: Toast[];
  addToast(toast: Omit<Toast, 'id' | 'createdAt'>): void;
  removeToast(id: string): void;
  clearAll(): void;
};

function generateToastId(): string {
  return `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = generateToastId();
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id, createdAt: Date.now() }].slice(-3),
    }));
    // Auto-dismiss after 5 seconds
    const timeout = toast.type === 'analysis' ? 8000 : 5000;
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, timeout);
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
  clearAll: () => {
    set({ toasts: [] });
  },
}));
