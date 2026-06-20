import { create } from 'zustand';
import { User } from '../types';
import { signInWithGoogle, signInAnonymously, onAuthChanged, signOut as fbSignOut, isFirebaseConfigured, fetchUserProfile, saveUserProfile, updateUserProfile } from '../lib/firebase';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  loginAsGuest: (username?: string) => void;
  logout: () => void;
  incrementAnalyzedGames: () => Promise<void>;
  updateStreakOnAnalysis: () => Promise<void>;
  setChessComUsername: (username: string) => Promise<void>;
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
      coordinatesSize: 9,
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
      await signInWithGoogle();
      // onAuthChanged will fire and set the user in the store
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
  },

  logout: async () => {
    const { user } = get();
    if (user?.authProvider === 'google' || user?.authProvider === 'anonymous') {
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
    if (user.authProvider === 'google') {
      updateUserProfile(updated.id, {
        analyzedCount: updated.analyzedCount,
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
    if (user.authProvider === 'google') {
      updateUserProfile(updated.id, {
        streak: updated.streak,
        lastActiveDate: updated.lastActiveDate,
      });
    }
  },

  setChessComUsername: async (chessComUsername: string) => {
    const { user } = get();
    if (!user) return;
    const trimmed = chessComUsername.trim();
    const updated = { ...user, chessComUsername: trimmed || undefined };
    set({ user: updated });
    saveUser(updated);
    if (user.authProvider === 'google') {
      updateUserProfile(updated.id, {
        chessComUsername: updated.chessComUsername || null,
      });
    }
  },
}));

function buildGoogleUser(fbUser: { uid: string; displayName: string | null; email: string | null; photoURL: string | null }): User {
  const existing = loadUser();
  return {
    id: fbUser.uid,
    username: fbUser.displayName || fbUser.email?.split('@')[0] || 'GoogleUser',
    email: fbUser.email || '',
    avatar: fbUser.photoURL || '',
    authProvider: 'google',
    streak: existing?.streak ?? 1,
    analyzedCount: existing?.analyzedCount ?? 0,
    lastActiveDate: new Date().toISOString().split('T')[0],
    chessComUsername: existing?.chessComUsername || undefined,
    settings: existing?.settings ?? { ...DEFAULT_GUEST.settings },
  };
}

// Subscribe to Firebase auth state (handles redirect result + page refresh + sign-out)
let unsubAuth: (() => void) | null = null;

let receivedUser = false;

async function handleFirebaseUser(fbUser: { uid: string; displayName: string | null; email: string | null; photoURL: string | null; isAnonymous?: boolean } | null) {
  if (!fbUser) {
    if (!receivedUser && isFirebaseConfigured()) {
      signInAnonymously();
    }
    useAuthStore.setState({ loading: false });
    return;
  }

  if (fbUser.isAnonymous) {
    receivedUser = true;
    useAuthStore.setState({ error: null });
    const existing = loadUser();
    const user: User = {
      id: fbUser.uid,
      username: existing?.username || 'Guest',
      email: '',
      avatar: existing?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${existing?.username || 'Guest'}`,
      authProvider: 'anonymous',
      streak: existing?.streak ?? 1,
      analyzedCount: existing?.analyzedCount ?? 0,
      lastActiveDate: existing?.lastActiveDate || new Date().toISOString().split('T')[0],
      chessComUsername: existing?.chessComUsername || undefined,
      settings: existing?.settings ?? { ...DEFAULT_GUEST.settings },
    };
    saveUser(user);
    useAuthStore.setState({ user, loading: false });
    return;
  }

  receivedUser = true;
  useAuthStore.setState({ error: null });

  // Try Firestore first for existing profile data
  const existing = loadUser();
  const remoteProfile = await fetchUserProfile(fbUser.uid);
  if (remoteProfile) {
    const user: User = {
      id: fbUser.uid,
      username: fbUser.displayName || (remoteProfile.username as string) || 'GoogleUser',
      email: fbUser.email || (remoteProfile.email as string) || '',
      avatar: fbUser.photoURL || (remoteProfile.avatar as string) || '',
      authProvider: 'google',
      streak: (remoteProfile.streak as number) ?? 1,
      analyzedCount: (remoteProfile.analyzedCount as number) ?? 0,
      lastActiveDate: (remoteProfile.lastActiveDate as string) || new Date().toISOString().split('T')[0],
      chessComUsername: (remoteProfile.chessComUsername as string) || existing?.chessComUsername || undefined,
      settings: (remoteProfile.settings as User['settings']) || { ...DEFAULT_GUEST.settings },
    };
    saveUser(user);
    useAuthStore.setState({ user, loading: false });
    return;
  }

  if (existing?.id === fbUser.uid) {
    const refreshed = {
      ...existing,
      username: fbUser.displayName || existing.username,
      avatar: fbUser.photoURL || existing.avatar,
      email: fbUser.email || existing.email,
    };
    saveUser(refreshed);
    useAuthStore.setState({ user: refreshed, loading: false });
    return;
  }

  const user = buildGoogleUser(fbUser);
  saveUser(user);
  useAuthStore.setState({ user, loading: false });

  await saveUserProfile(user.id, {
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    streak: user.streak,
    analyzedCount: user.analyzedCount,
    lastActiveDate: user.lastActiveDate,
    chessComUsername: user.chessComUsername || null,
    settings: user.settings,
  });
}

export async function initAuth() {
  if (typeof window === 'undefined' || !isFirebaseConfigured()) return;
  if (unsubAuth) unsubAuth();

  receivedUser = false;

  // Only show spinner if no cached user from a previous session
  const cachedUser = loadUser();
  if (!cachedUser) {
    useAuthStore.setState({ loading: true });
  }

  unsubAuth = onAuthChanged(async (fbUser) => {
    try {
      await handleFirebaseUser(fbUser);
    } catch (err) {
      console.error('[Auth] handleFirebaseUser failed:', err);
      useAuthStore.setState({ error: 'Failed to load profile', loading: false });
    }
  });
}
