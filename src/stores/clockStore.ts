/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import type { ClockPreset } from '../types';

type ClockState = {
  presets: ClockPreset[];
  activePresetId: string;
  whiteTime: number; // in Milliseconds
  blackTime: number; // in Milliseconds
  initialWhiteTime: number;
  initialBlackTime: number;
  activeColor: 'w' | 'b' | null;
  isRunning: boolean;
  winner: 'w' | 'b' | 'draw' | null;
  reason: string | null;
  
  selectPreset(id: string): void;
  setCustomTime(whiteTimeMs: number, blackTimeMs: number, incrementSec?: number): void;
  startClock(): void;
  pauseClock(): void;
  resetClock(): void;
  switchTurn(color: 'w' | 'b'): void;
  tick(elapsedMs: number): void;
}

export const CLOCK_PRESETS: ClockPreset[] = [
  { id: '1+0', name: 'Bullet 1+0', timeLimit: 60, increment: 0, type: 'bullet' },
  { id: '1+1', name: 'Bullet 1+1', timeLimit: 60, increment: 1, type: 'bullet' },
  { id: '2+1', name: 'Bullet 2+1', timeLimit: 120, increment: 1, type: 'bullet' },
  { id: '3+0', name: 'Blitz 3+0', timeLimit: 180, increment: 0, type: 'blitz' },
  { id: '3+2', name: 'Blitz 3+2', timeLimit: 180, increment: 2, type: 'blitz' },
  { id: '3+15', name: 'Blitz 3+15', timeLimit: 180, increment: 15, type: 'blitz' },
  { id: '5+0', name: 'Blitz 5+0', timeLimit: 300, increment: 0, type: 'blitz' },
  { id: '10+0', name: 'Rapid 10+0', timeLimit: 600, increment: 0, type: 'rapid' },
  { id: '10+5', name: 'Rapid 10+5', timeLimit: 600, increment: 5, type: 'rapid' },
  { id: '15+10', name: 'Rapid 15+10', timeLimit: 900, increment: 10, type: 'rapid' },
  { id: '30+0', name: 'Classic 30+0', timeLimit: 1800, increment: 0, type: 'classic' },
  { id: '30+20', name: 'Classic 30+20', timeLimit: 1800, increment: 20, type: 'classic' },
  { id: '60+0', name: 'Classic 60+0', timeLimit: 3600, increment: 0, type: 'classic' },
  { id: '60+30', name: 'Classic 60+30', timeLimit: 3600, increment: 30, type: 'classic' }
];

export const useClockStore = create<ClockState>((set, get) => ({
  presets: CLOCK_PRESETS,
  activePresetId: '3+0',
  whiteTime: 180 * 1000,
  blackTime: 180 * 1000,
  initialWhiteTime: 180 * 1000,
  initialBlackTime: 180 * 1000,
  activeColor: null,
  isRunning: false,
  winner: null,
  reason: null,

  selectPreset: (id) => {
    const preset = CLOCK_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    
    set({
      activePresetId: id,
      whiteTime: preset.timeLimit * 1000,
      blackTime: preset.timeLimit * 1000,
      initialWhiteTime: preset.timeLimit * 1000,
      initialBlackTime: preset.timeLimit * 1000,
      activeColor: null,
      isRunning: false,
      winner: null,
      reason: null
    });
  },

  setCustomTime: (whiteTimeMs, blackTimeMs, incrementSec = 0) => {
    set({
      activePresetId: 'custom',
      whiteTime: whiteTimeMs,
      blackTime: blackTimeMs,
      initialWhiteTime: whiteTimeMs,
      initialBlackTime: blackTimeMs,
      activeColor: null,
      isRunning: false,
      winner: null,
      reason: null
    });
  },

  startClock: () => {
    const { activeColor, isRunning, winner } = get();
    if (winner) return;
    set({
      isRunning: true,
      activeColor: activeColor || 'w' // Defaults White starting
    });
  },

  pauseClock: () => {
    set({ isRunning: false });
  },

  resetClock: () => {
    const { activePresetId, presets } = get();
    if (activePresetId === 'custom') {
      set({ activeColor: null, isRunning: false, winner: null, reason: null });
      return;
    }
    const preset = presets.find((p) => p.id === activePresetId) || CLOCK_PRESETS[1];
    set({
      whiteTime: preset.timeLimit * 1000,
      blackTime: preset.timeLimit * 1000,
      initialWhiteTime: preset.timeLimit * 1000,
      initialBlackTime: preset.timeLimit * 1000,
      activeColor: null,
      isRunning: false,
      winner: null,
      reason: null
    });
  },

  switchTurn: (color) => {
    const { isRunning, activeColor, activePresetId, presets } = get();
    if (!isRunning || activeColor !== color) return;

    const preset = presets.find((p) => p.id === activePresetId);
    const incMs = preset ? preset.increment * 1000 : 0;

    if (color === 'w') {
      set({
        whiteTime: get().whiteTime + incMs,
        activeColor: 'b'
      });
    } else {
      set({
        blackTime: get().blackTime + incMs,
        activeColor: 'w'
      });
    }
  },

  tick: (elapsedMs) => {
    const { activeColor, isRunning, whiteTime, blackTime } = get();
    if (!isRunning || !activeColor) return;

    if (activeColor === 'w') {
      const remaining = Math.max(0, whiteTime - elapsedMs);
      if (remaining === 0) {
        set({
          whiteTime: 0,
          isRunning: false,
          winner: 'b',
          reason: 'Time Out'
        });
      } else {
        set({ whiteTime: remaining });
      }
    } else {
      const remaining = Math.max(0, blackTime - elapsedMs);
      if (remaining === 0) {
        set({
          blackTime: 0,
          isRunning: false,
          winner: 'w',
          reason: 'Time Out'
        });
      } else {
        set({ blackTime: remaining });
      }
    }
  }
}));
