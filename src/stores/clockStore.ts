/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { ClockPreset } from '../types';

interface ClockState {
  presets: ClockPreset[];
  activePresetId: string;
  whiteTime: number; // in Milliseconds
  blackTime: number; // in Milliseconds
  activeColor: 'w' | 'b' | null;
  isRunning: boolean;
  winner: 'w' | 'b' | 'draw' | null;
  reason: string | null;
  
  selectPreset: (id: string) => void;
  setCustomTime: (minutes: number, incrementSec: number) => void;
  startClock: () => void;
  pauseClock: () => void;
  resetClock: () => void;
  switchTurn: (color: 'w' | 'b') => void;
  tick: (elapsedMs: number) => void;
}

export const CLOCK_PRESETS: ClockPreset[] = [
  { id: '1+0', name: 'Bullet 1+0', timeLimit: 60, increment: 0, type: 'bullet' },
  { id: '3+0', name: 'Blitz 3+0', timeLimit: 180, increment: 0, type: 'blitz' },
  { id: '5+0', name: 'Blitz 5+0', timeLimit: 300, increment: 0, type: 'blitz' },
  { id: '10+0', name: 'Rapid 10+0', timeLimit: 600, increment: 0, type: 'rapid' },
  { id: '15+10', name: 'Rapid 15+10', timeLimit: 900, increment: 10, type: 'rapid' },
  { id: '30+0', name: 'Classic 30+0', timeLimit: 1800, increment: 0, type: 'classic' }
];

export const useClockStore = create<ClockState>((set, get) => ({
  presets: CLOCK_PRESETS,
  activePresetId: '3+0',
  whiteTime: 180 * 1000,
  blackTime: 180 * 1000,
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
      activeColor: null,
      isRunning: false,
      winner: null,
      reason: null
    });
  },

  setCustomTime: (minutes, incrementSec) => {
    const timeMs = minutes * 60 * 1000;
    set({
      activePresetId: 'custom',
      whiteTime: timeMs,
      blackTime: timeMs,
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
    const preset = presets.find((p) => p.id === activePresetId) || CLOCK_PRESETS[1];
    set({
      whiteTime: preset.timeLimit * 1000,
      blackTime: preset.timeLimit * 1000,
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
