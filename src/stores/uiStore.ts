import { create } from 'zustand';

type UIState = {
  focusMode: boolean;
  fullscreenMode: boolean;
  toggleFocusMode(): void;
  setFullscreenMode(v: boolean): void;
  toggleFullscreenMode(): void;
}

export const useUIStore = create<UIState>((set) => ({
  focusMode: false,
  fullscreenMode: false,
  toggleFocusMode: () => { set((s) => ({ focusMode: !s.focusMode })); },
  setFullscreenMode: (v) => { set({ fullscreenMode: v }); },
  toggleFullscreenMode: () => { set((s) => ({ fullscreenMode: !s.fullscreenMode })); },
}));
