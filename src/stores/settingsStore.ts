/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { UserSettings } from '../types';

interface SettingsState {
  settings: UserSettings;
  updateSettings: (newSettings: Partial<UserSettings> | ((prev: UserSettings) => Partial<UserSettings>)) => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS: UserSettings = {
  engineDepth: 10,
  engineGoMode: 'depth',
  engineTimeLimitMs: 2000,
  boardColor: 'elegant',
  boardOrientation: 'white',
  notificationsEnabled: true,
  audioEnabled: true,
  audioVolume: 0.7,
  animationsEnabled: true,
  shortcutsEnabled: true,
  featureToggles: {
    showArrows: true,
    showCoordinates: true,
    autoAnalyze: true
  }
};

const getInitialSettings = (): UserSettings => {
  try {
    const cached = localStorage.getItem('finalrank_settings');
    if (cached) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(cached) };
    }
  } catch (error) {
    console.warn('Failed to parse settings cache:', error);
  }
  return DEFAULT_SETTINGS;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: getInitialSettings(),
  updateSettings: (newSettings) => set((state) => {
    const updated = typeof newSettings === 'function' 
      ? { ...state.settings, ...newSettings(state.settings) }
      : { ...state.settings, ...newSettings };
    
    try {
      localStorage.setItem('finalrank_settings', JSON.stringify(updated));
    } catch (e) {
      console.error('Could not cache settings:', e);
    }
    return { settings: updated };
  }),
  resetSettings: () => set(() => {
    try {
      localStorage.setItem('finalrank_settings', JSON.stringify(DEFAULT_SETTINGS));
    } catch (e) {
      console.error('Could not cache settings:', e);
    }
    return { settings: DEFAULT_SETTINGS };
  })
}));
