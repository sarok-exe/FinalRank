import { create } from 'zustand';
import { UserSettings } from '../types';
import { updateUserProfile } from '../lib/firebase';

interface SettingsState {
  settings: UserSettings;
  updateSettings: (newSettings: Partial<UserSettings> | ((prev: UserSettings) => Partial<UserSettings>)) => void;
  resetSettings: () => void;
}

export const THEME_PRESETS: Record<string, { siteColors: UserSettings['siteColors']; boardCustomColors: UserSettings['boardCustomColors'] }> = {
  olive: {
    siteColors: { primary: '#606c38', secondary: '#283618', accent: '#bc6c25', background: '#1a1a1a', surface: '#2a2a2a', text: '#fefae0', textMuted: '#a0a0a0', border: '#4a4a4a' },
    boardCustomColors: { lightSquare: '#f0d9b5', darkSquare: '#b58863' },
  },
  dark: {
    siteColors: { primary: '#7c7c7c', secondary: '#1a1a1a', accent: '#e0e0e0', background: '#111111', surface: '#222222', text: '#eeeeee', textMuted: '#888888', border: '#333333' },
    boardCustomColors: { lightSquare: '#b0b0b0', darkSquare: '#585858' },
  },
  ember: {
    siteColors: { primary: '#d65d0e', secondary: '#331a00', accent: '#fb4934', background: '#1b1b1b', surface: '#2b2b2b', text: '#fbf1c7', textMuted: '#a89984', border: '#504945' },
    boardCustomColors: { lightSquare: '#ebdbb2', darkSquare: '#d65d0e' },
  },
  ocean: {
    siteColors: { primary: '#458588', secondary: '#0e2433', accent: '#83a598', background: '#0f1a24', surface: '#1b2a36', text: '#ebf5f5', textMuted: '#8faebd', border: '#2e4a59' },
    boardCustomColors: { lightSquare: '#dee3e6', darkSquare: '#458588' },
  },
  forest: {
    siteColors: { primary: '#689d6a', secondary: '#142814', accent: '#8ec07c', background: '#141e14', surface: '#1f2e1f', text: '#e8f5e9', textMuted: '#8ba88b', border: '#2d4a2d' },
    boardCustomColors: { lightSquare: '#d5e6d5', darkSquare: '#689d6a' },
  },
};

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
  timeAlertEnabled: true,
  timeAlertThreshold: 10,
  timeAlertSound: true,
  themePreset: 'olive',
  siteColors: { ...THEME_PRESETS.olive.siteColors },
  boardCustomColors: { ...THEME_PRESETS.olive.boardCustomColors },
  coordinatesSize: 9,
  highlightColors: {
    moveTrail: '#f0c000',
    selectedSquare: '#ffaa00',
    rightClick: '#003088',
  },
  streakSoundEnabled: true,
  streakSoundVolume: 0.4,
  streakFlameAnimated: true,
  streakFlameColorMode: 'heat',
  featureToggles: {
    showArrows: true,
    showCoordinates: true,
    autoAnalyze: true,
  },
};

function applyThemeCss(settings: UserSettings) {
  const { siteColors, boardCustomColors } = settings;
  const root = document.documentElement;
  root.style.setProperty('--color-primary', siteColors.primary);
  root.style.setProperty('--color-secondary', siteColors.secondary);
  root.style.setProperty('--color-accent', siteColors.accent);
  root.style.setProperty('--color-background', siteColors.background);
  root.style.setProperty('--color-surface', siteColors.surface);
  root.style.setProperty('--color-text', siteColors.text);
  root.style.setProperty('--color-text-muted', siteColors.textMuted);
  root.style.setProperty('--color-border', siteColors.border);
  root.style.setProperty('--board-light', boardCustomColors.lightSquare);
  root.style.setProperty('--board-dark', boardCustomColors.darkSquare);
}

const getInitialSettings = (): UserSettings => {
  try {
    const cached = localStorage.getItem('finalrank_settings');
    if (cached) {
      const parsed = JSON.parse(cached);
      const merged = { ...DEFAULT_SETTINGS, ...parsed };
      applyThemeCss(merged);
      return merged;
    }
  } catch {}
  applyThemeCss(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
};

let settingsSyncTimeout: ReturnType<typeof setTimeout> | null = null;

function debouncedSyncSettings(settings: UserSettings) {
  if (settingsSyncTimeout) clearTimeout(settingsSyncTimeout);
  settingsSyncTimeout = setTimeout(() => {
    const userRaw = localStorage.getItem('finalrank_user');
    if (!userRaw) return;
    try {
      const user = JSON.parse(userRaw);
      if (user.authProvider === 'google') {
        updateUserProfile(user.id, { settings });
      }
    } catch {}
  }, 2000);
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: getInitialSettings(),
  updateSettings: (newSettings) => set((state) => {
    const updated = typeof newSettings === 'function'
      ? { ...state.settings, ...newSettings(state.settings) }
      : { ...state.settings, ...newSettings };
    try {
      localStorage.setItem('finalrank_settings', JSON.stringify(updated));
      applyThemeCss(updated);
      debouncedSyncSettings(updated);
    } catch {}
    return { settings: updated };
  }),
  resetSettings: () => set(() => {
    const defaults = { ...DEFAULT_SETTINGS };
    try {
      localStorage.setItem('finalrank_settings', JSON.stringify(defaults));
      applyThemeCss(defaults);
    } catch {}
    return { settings: defaults };
  }),
}));
