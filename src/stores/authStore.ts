import { create } from 'zustand';
import { User } from '../types';
import { signInWithGoogle, signOut as fbSignOut, isFirebaseConfigured } from '../lib/firebase';
import { syncUserProfile, fetchUserSettings, isSupabaseConfigured } from '../lib/supabase';
import { initTursoSchema } from '../lib/turso';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  loginAsGuest: (username?: string) => void;
  logout: () => void;
  incrementAnalyzedGames: () => Promise<void>;
  updateStreakOnAnalysis: () => Promise<void>;
}

const DEFAULT_GUEST: User = {
  id: 'guest_user',
  username: 'ChessPro_Guest',
  email: '',
  avatar: '',
  authProvider: 'guest',
  streak: 3,
  analyzedCount: 14,
  lastActiveDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  settings: {
    engineDepth: 10,
    engineGoMode: 'depth',
    engineTimeLimitMs: 2000,
    boardColor: 'green',
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
    siteColors: {
      primary: '#606c38',
      secondary: '#283618',
      accent: '#bc6c25',
      background: '#1a1a1a',
      surface: '#2a2a2a',
      text: '#fefae0',
      textMuted: '#a0a0a0',
      border: '#4a4a4a',
    },
    boardCustomColors: {
      lightSquare: '#f0d9b5',
      darkSquare: '#b58863',
    },
    featureToggles: {
      showArrows: true,
      showCoordinates: true,
      autoAnalyze: true,
    },
  },
};

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem('finalrank_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveUser(user: User) {
  localStorage.setItem('finalrank_user', JSON.stringify(user));
}

function removeUser() {
  localStorage.removeItem('finalrank_user');
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: loadUser(),
  loading: false,
  error: null,

  signInWithGoogle: async () => {
    set({ loading: true, error: null });
    try {
      if (!isFirebaseConfigured()) {
        set({ error: 'Firebase not configured. Set VITE_FIREBASE_* env vars.', loading: false });
        return;
      }
      const fbUser = await signInWithGoogle();
      if (!fbUser) {
        set({ error: 'Google sign-in failed.', loading: false });
        return;
      }
      const user: User = {
        id: fbUser.uid,
        username: fbUser.displayName || fbUser.email?.split('@')[0] || 'GoogleUser',
        email: fbUser.email || '',
        avatar: fbUser.photoURL || '',
        authProvider: 'google',
        streak: 1,
        analyzedCount: 0,
        lastActiveDate: new Date().toISOString().split('T')[0],
        settings: {
          ...DEFAULT_GUEST.settings,
        },
      };
      set({ user, loading: false, error: null });
      saveUser(user);

      if (isSupabaseConfigured()) {
        syncUserProfile(user.id, {
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          streak: user.streak,
          analyzedCount: user.analyzedCount,
          lastActiveDate: user.lastActiveDate,
        });
        const remoteSettings = await fetchUserSettings(user.id);
        if (remoteSettings) {
          const { useSettingsStore } = await import('./settingsStore');
          useSettingsStore.getState().updateSettings(remoteSettings as any);
        }
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Sign-in failed.', loading: false });
    }
  },

  loginAsGuest: (username = 'ChessPro_Guest') => {
    const user: User = {
      ...DEFAULT_GUEST,
      username,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
    };
    set({ user, error: null });
    saveUser(user);
    initTursoSchema();
  },

  logout: async () => {
    const { user } = get();
    if (user?.authProvider === 'google') {
      try { await fbSignOut(); } catch {}
    }
    set({ user: null, error: null });
    removeUser();
  },

  incrementAnalyzedGames: async () => {
    const { user } = get();
    if (!user) return;
    const updated = { ...user, analyzedCount: user.analyzedCount + 1 };
    set({ user: updated });
    saveUser(updated);
    if (isSupabaseConfigured() && user.authProvider === 'google') {
      syncUserProfile(updated.id, {
        username: updated.username,
        email: updated.email,
        avatar: updated.avatar,
        streak: updated.streak,
        analyzedCount: updated.analyzedCount,
        lastActiveDate: updated.lastActiveDate,
      });
    }
  },

  updateStreakOnAnalysis: async () => {
    const { user } = get();
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const lastActive = user.lastActiveDate;
    let newStreak = user.streak;
    if (!lastActive) {
      newStreak = 1;
    } else {
      const diffDays = Math.ceil(Math.abs(new Date(today).getTime() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24));
      newStreak = diffDays === 1 ? newStreak + 1 : diffDays > 1 ? 1 : newStreak;
    }
    const updated = { ...user, streak: newStreak, lastActiveDate: today };
    set({ user: updated });
    saveUser(updated);
    if (isSupabaseConfigured() && user.authProvider === 'google') {
      syncUserProfile(updated.id, {
        username: updated.username,
        email: updated.email,
        avatar: updated.avatar,
        streak: updated.streak,
        analyzedCount: updated.analyzedCount,
        lastActiveDate: updated.lastActiveDate,
      });
    }
  },
}));
