import { create } from 'zustand';
import type { UserSettings } from '../types';
import { updateUserProfile } from '../lib/firebase';
import { useAuthStore } from './authStore';
import { detectDeviceTier, recommendedWorkers } from '../lib/deviceTier';

type SettingsState = {
  settings: UserSettings;
  updateSettings(newSettings: Partial<UserSettings> | ((prev: UserSettings) => Partial<UserSettings>)): void;
  resetSettings(): void;
}

export const THEME_PRESETS: Record<string, {
  siteColors: UserSettings['siteColors'];
  boardCustomColors: UserSettings['boardCustomColors'];
  highlightColors: UserSettings['highlightColors'];
  mood: 'calm' | 'energetic' | 'professional' | 'warm';
  suggestedBoardColor: UserSettings['boardColor'];
}> = {
  olive: {
    siteColors: { primary: '#606c38', secondary: '#283618', accent: '#bc6c25', background: '#1a1a1a', surface: '#2a2a2a', text: '#fefae0', textMuted: '#a0a0a0', border: '#4a4a4a' },
    boardCustomColors: { lightSquare: '#f0d9b5', darkSquare: '#b58863' },
    highlightColors: { moveTrail: '#dda15e', selectedSquare: '#bc6c25', rightClick: '#283618' },
    mood: 'warm',
    suggestedBoardColor: 'brown',
  },
  dark: {
    siteColors: { primary: '#7c7c7c', secondary: '#1a1a1a', accent: '#e0e0e0', background: '#111111', surface: '#222222', text: '#eeeeee', textMuted: '#888888', border: '#333333' },
    boardCustomColors: { lightSquare: '#b0b0b0', darkSquare: '#585858' },
    highlightColors: { moveTrail: '#e0e0e0', selectedSquare: '#7c7c7c', rightClick: '#333333' },
    mood: 'professional',
    suggestedBoardColor: 'charcoal',
  },
  ember: {
    siteColors: { primary: '#d65d0e', secondary: '#331a00', accent: '#fb4934', background: '#1b1b1b', surface: '#2b2b2b', text: '#fbf1c7', textMuted: '#a89984', border: '#504945' },
    boardCustomColors: { lightSquare: '#ebdbb2', darkSquare: '#d65d0e' },
    highlightColors: { moveTrail: '#fb4934', selectedSquare: '#d65d0e', rightClick: '#331a00' },
    mood: 'energetic',
    suggestedBoardColor: 'brown',
  },
  ocean: {
    siteColors: { primary: '#458588', secondary: '#0e2433', accent: '#83a598', background: '#0f1a24', surface: '#1b2a36', text: '#ebf5f5', textMuted: '#8faebd', border: '#2e4a59' },
    boardCustomColors: { lightSquare: '#dee3e6', darkSquare: '#458588' },
    highlightColors: { moveTrail: '#83a598', selectedSquare: '#458588', rightClick: '#0e2433' },
    mood: 'professional',
    suggestedBoardColor: 'blue',
  },
  forest: {
    siteColors: { primary: '#689d6a', secondary: '#142814', accent: '#8ec07c', background: '#141e14', surface: '#1f2e1f', text: '#e8f5e9', textMuted: '#8ba88b', border: '#2d4a2d' },
    boardCustomColors: { lightSquare: '#d5e6d5', darkSquare: '#689d6a' },
    highlightColors: { moveTrail: '#8ec07c', selectedSquare: '#689d6a', rightClick: '#142814' },
    mood: 'calm',
    suggestedBoardColor: 'green',
  },
  'leafy-green': {
    siteColors: { primary: '#90a955', secondary: '#132a13', accent: '#ecf39e', background: '#0a1a0a', surface: '#132a13', text: '#ecf39e', textMuted: '#90a955', border: '#31572c' },
    boardCustomColors: { lightSquare: '#d4e6b5', darkSquare: '#4f772d' },
    highlightColors: { moveTrail: '#ecf39e', selectedSquare: '#90a955', rightClick: '#31572c' },
    mood: 'calm',
    suggestedBoardColor: 'green',
  },
  'neutral-harmony': {
    siteColors: { primary: '#e07a5f', secondary: '#3d405b', accent: '#81b29a', background: '#1a1a24', surface: '#2a2a35', text: '#f4f1de', textMuted: '#81b29a', border: '#3d405b' },
    boardCustomColors: { lightSquare: '#f4f1de', darkSquare: '#81b29a' },
    highlightColors: { moveTrail: '#f2cc8f', selectedSquare: '#e07a5f', rightClick: '#3d405b' },
    mood: 'calm',
    suggestedBoardColor: 'elegant',
  },
  'nature-harmony': {
    siteColors: { primary: '#bcbd8b', secondary: '#373d20', accent: '#717744', background: '#1a1a14', surface: '#2a2a20', text: '#eff1ed', textMuted: '#bcbd8b', border: '#373d20' },
    boardCustomColors: { lightSquare: '#eff1ed', darkSquare: '#717744' },
    highlightColors: { moveTrail: '#bcbd8b', selectedSquare: '#717744', rightClick: '#373d20' },
    mood: 'calm',
    suggestedBoardColor: 'green',
  },
  'soft-lavender': {
    siteColors: { primary: '#9a8c98', secondary: '#22223b', accent: '#c9ada7', background: '#181824', surface: '#22223b', text: '#f2e9e4', textMuted: '#9a8c98', border: '#4a4e69' },
    boardCustomColors: { lightSquare: '#f2e9e4', darkSquare: '#c9ada7' },
    highlightColors: { moveTrail: '#c9ada7', selectedSquare: '#9a8c98', rightClick: '#4a4e69' },
    mood: 'calm',
    suggestedBoardColor: 'elegant',
  },
  'cherry-blossom': {
    siteColors: { primary: '#ff4d6d', secondary: '#800f2f', accent: '#ffb3c1', background: '#1a0a0f', surface: '#2a1018', text: '#fff0f3', textMuted: '#ffb3c1', border: '#800f2f' },
    boardCustomColors: { lightSquare: '#fff0f3', darkSquare: '#ffb3c1' },
    highlightColors: { moveTrail: '#ffccd5', selectedSquare: '#ff4d6d', rightClick: '#800f2f' },
    mood: 'calm',
    suggestedBoardColor: 'cherry-blossom',
  },
  'gothic-glam': {
    siteColors: { primary: '#da4167', secondary: '#3d2645', accent: '#832161', background: '#000000', surface: '#1a0a1a', text: '#f0eff4', textMuted: '#832161', border: '#3d2645' },
    boardCustomColors: { lightSquare: '#f0eff4', darkSquare: '#3d2645' },
    highlightColors: { moveTrail: '#da4167', selectedSquare: '#832161', rightClick: '#3d2645' },
    mood: 'energetic',
    suggestedBoardColor: 'charcoal',
  },
  'fiery-ocean': {
    siteColors: { primary: '#c1121f', secondary: '#003049', accent: '#669bbc', background: '#0a0a14', surface: '#1a1a28', text: '#fdf0d5', textMuted: '#669bbc', border: '#003049' },
    boardCustomColors: { lightSquare: '#fdf0d5', darkSquare: '#003049' },
    highlightColors: { moveTrail: '#669bbc', selectedSquare: '#c1121f', rightClick: '#003049' },
    mood: 'energetic',
    suggestedBoardColor: 'blue',
  },
  'warm-autumn': {
    siteColors: { primary: '#f77f00', secondary: '#003049', accent: '#fcbf49', background: '#14100a', surface: '#241a10', text: '#eae2b7', textMuted: '#fcbf49', border: '#003049' },
    boardCustomColors: { lightSquare: '#eae2b7', darkSquare: '#d62828' },
    highlightColors: { moveTrail: '#fcbf49', selectedSquare: '#f77f00', rightClick: '#003049' },
    mood: 'energetic',
    suggestedBoardColor: 'brown',
  },
  'autumn-sunset': {
    siteColors: { primary: '#b23a48', secondary: '#461220', accent: '#fcb9b2', background: '#1a0a0f', surface: '#2a1018', text: '#fed0bb', textMuted: '#fcb9b2', border: '#461220' },
    boardCustomColors: { lightSquare: '#fed0bb', darkSquare: '#b23a48' },
    highlightColors: { moveTrail: '#fcb9b2', selectedSquare: '#b23a48', rightClick: '#461220' },
    mood: 'energetic',
    suggestedBoardColor: 'brown',
  },
  'deep-sea': {
    siteColors: { primary: '#384e77', secondary: '#0d0630', accent: '#8bbeb2', background: '#060318', surface: '#0d0630', text: '#e6f9af', textMuted: '#8bbeb2', border: '#18314f' },
    boardCustomColors: { lightSquare: '#d4e8e2', darkSquare: '#384e77' },
    highlightColors: { moveTrail: '#8bbeb2', selectedSquare: '#384e77', rightClick: '#0d0630' },
    mood: 'professional',
    suggestedBoardColor: 'blue',
  },
  'mystic-mauve': {
    siteColors: { primary: '#96705b', secondary: '#1a1423', accent: '#684756', background: '#0f0a14', surface: '#1a1423', text: '#ded0c8', textMuted: '#684756', border: '#3d314a' },
    boardCustomColors: { lightSquare: '#e0d0c8', darkSquare: '#684756' },
    highlightColors: { moveTrail: '#96705b', selectedSquare: '#684756', rightClick: '#3d314a' },
    mood: 'professional',
    suggestedBoardColor: 'elegant',
  },
  'coastal-blues': {
    siteColors: { primary: '#2a6f97', secondary: '#012a4a', accent: '#89c2d9', background: '#000d18', surface: '#012a4a', text: '#a9d6e5', textMuted: '#89c2d9', border: '#013a63' },
    boardCustomColors: { lightSquare: '#d4ecf5', darkSquare: '#2a6f97' },
    highlightColors: { moveTrail: '#89c2d9', selectedSquare: '#2a6f97', rightClick: '#012a4a' },
    mood: 'professional',
    suggestedBoardColor: 'blue',
  },
  'golden-twilight': {
    siteColors: { primary: '#ffc300', secondary: '#001d3d', accent: '#ffd60a', background: '#000810', surface: '#001d3d', text: '#ffffff', textMuted: '#ffc300', border: '#003566' },
    boardCustomColors: { lightSquare: '#fff8dc', darkSquare: '#003566' },
    highlightColors: { moveTrail: '#ffd60a', selectedSquare: '#ffc300', rightClick: '#001d3d' },
    mood: 'professional',
    suggestedBoardColor: 'golden-blue',
  },
  'fresh-greens': {
    siteColors: { primary: '#a7c957', secondary: '#386641', accent: '#f2e8cf', background: '#141a14', surface: '#1a2a1a', text: '#f2e8cf', textMuted: '#a7c957', border: '#386641' },
    boardCustomColors: { lightSquare: '#f2e8cf', darkSquare: '#6a994e' },
    highlightColors: { moveTrail: '#a7c957', selectedSquare: '#6a994e', rightClick: '#386641' },
    mood: 'warm',
    suggestedBoardColor: 'fresh-greens',
  },
  'mocha-latte': {
    siteColors: { primary: '#a9927d', secondary: '#22333b', accent: '#f2f4f3', background: '#0a0908', surface: '#1a1815', text: '#f2f4f3', textMuted: '#a9927d', border: '#22333b' },
    boardCustomColors: { lightSquare: '#f2f4f3', darkSquare: '#a9927d' },
    highlightColors: { moveTrail: '#f2f4f3', selectedSquare: '#a9927d', rightClick: '#22333b' },
    mood: 'warm',
    suggestedBoardColor: 'elegant',
  },
};

const DEFAULT_SETTINGS: UserSettings = {
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
  parallelWorkers: recommendedWorkers(detectDeviceTier()),
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
  updateSettings: (newSettings) => { set((state) => {
    const updated = typeof newSettings === 'function'
      ? { ...state.settings, ...newSettings(state.settings) }
      : { ...state.settings, ...newSettings };
    try {
      localStorage.setItem('finalrank_settings', JSON.stringify(updated));
      applyThemeCss(updated);
      debouncedSyncSettings(updated);
      // sync into auth store user
      const auth = useAuthStore.getState();
      if (auth.user) {
        const synced = { ...auth.user, settings: updated };
        useAuthStore.setState({ user: synced });
        localStorage.setItem('finalrank_user', JSON.stringify(synced));
      }
    } catch {}
    return { settings: updated };
  }); },
  resetSettings: () => { set(() => {
    const defaults = { ...DEFAULT_SETTINGS };
    try {
      localStorage.setItem('finalrank_settings', JSON.stringify(defaults));
      applyThemeCss(defaults);
      const auth = useAuthStore.getState();
      if (auth.user) {
        const synced = { ...auth.user, settings: defaults };
        useAuthStore.setState({ user: synced });
        localStorage.setItem('finalrank_user', JSON.stringify(synced));
      }
    } catch {}
    return { settings: defaults };
  }); },
}));
