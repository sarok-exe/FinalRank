import { create } from 'zustand';
import type { User } from '../types';
import { signInWithGoogle, signInAnonymously, onAuthChanged, signOut as fbSignOut, isFirebaseConfigured, fetchUserProfile, saveUserProfile, updateUserProfile } from '../lib/firebase';

export type StreakToast = { show: boolean; newStreak: number; prevStreak: number };

type AuthState = {
  user: User | null;
  loading: boolean;
  error: string | null;
  streakToast: StreakToast | null;
  signInWithGoogle(): Promise<void>;
  loginAsGuest(username?: string): void;
  logout(): void;
  incrementAnalyzedGames(): Promise<void>;
  updateStreakOnAnalysis(): Promise<{ streakIncremented: boolean; newStreak: number; prevStreak: number }>;
  setChessComUsername(username: string): Promise<void>;
  clearStreakToast(): void;
}

const DEFAULT_GUEST: User = {
  id: 'guest_user',
  username: 'ChessPro_Guest',
  email: '',
  avatar: '',
  authProvider: 'guest',
  streak: 0,
  analyzedCount: 0,
  lastActiveDate: null,
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
        remoteEvaluation: true,
        distributedAnalysis: false,
      },
    },
};

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem('finalrank_user');
    return raw != null ? JSON.parse(raw) as User : null;
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
  streakToast: null,

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

  logout: () => {
    const { user } = get();
    if (user?.authProvider === 'google' || user?.authProvider === 'anonymous') {
      void fbSignOut().catch(() => {});
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
      void updateUserProfile(updated.id, {
        analyzedCount: updated.analyzedCount,
      });
    }
  },

  updateStreakOnAnalysis: async () => {
    const { user } = get();
    if (!user) return { streakIncremented: false, newStreak: 0, prevStreak: 0 };
    const now = new Date();
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const lastActive = user.lastActiveDate;
    const prevStreak = user.streak;
    let newStreak = prevStreak;
    let streakIncremented = false;

    if (lastActive == null) {
      newStreak = 1;
      streakIncremented = true;
    } else {
      const diffDays = Math.ceil(Math.abs(new Date(todayLocal).getTime() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        newStreak = prevStreak + 1;
        streakIncremented = true;
      } else if (diffDays > 1) {
        newStreak = 1;
        streakIncremented = true;
      }
    }

    const updated = { ...user, streak: newStreak, lastActiveDate: todayLocal };
    set({ user: updated });
    saveUser(updated);
    if (user.authProvider === 'google') {
      void updateUserProfile(updated.id, {
        streak: updated.streak,
        lastActiveDate: updated.lastActiveDate,
      });
    }
    return { streakIncremented, newStreak, prevStreak };
  },

  clearStreakToast: () => { set({ streakToast: null }); },

  setChessComUsername: async (chessComUsername: string) => {
    const { user } = get();
    if (!user) return;
    const trimmed = chessComUsername.trim();
    const updated = { ...user, chessComUsername: trimmed || undefined };
    set({ user: updated });
    saveUser(updated);
    if (user.authProvider === 'google') {
      void updateUserProfile(updated.id, {
        chessComUsername: updated.chessComUsername ?? null,
      });
    }
  },
}));

function buildGoogleUser(fbUser: { uid: string; displayName: string | null; email: string | null; photoURL: string | null }): User {
  const existing = loadUser();
  return {
    id: fbUser.uid,
    username: fbUser.displayName ?? fbUser.email?.split('@')[0] ?? 'GoogleUser',
    email: fbUser.email ?? '',
    avatar: fbUser.photoURL ?? '',
    authProvider: 'google',
    streak: existing?.streak ?? 0,
    analyzedCount: existing?.analyzedCount ?? 0,
    lastActiveDate: null,
    chessComUsername: existing?.chessComUsername ?? undefined,
    settings: existing?.settings ?? { ...DEFAULT_GUEST.settings },
  };
}

// Subscribe to Firebase auth state (handles redirect result + page refresh + sign-out)
let unsubAuth: (() => void) | null = null;

let receivedUser = false;

async function handleFirebaseUser(fbUser: { uid: string; displayName: string | null; email: string | null; photoURL: string | null; isAnonymous?: boolean } | null) {
  if (!fbUser) {
    if (!receivedUser && isFirebaseConfigured()) {
      void signInAnonymously();
    }
    useAuthStore.setState({ loading: false });
    return;
  }

  if (fbUser.isAnonymous === true) {
    receivedUser = true;
    useAuthStore.setState({ error: null });
    const existing = loadUser();
    const user: User = {
      id: fbUser.uid,
      username: existing?.username ?? 'Guest',
      email: '',
      avatar: existing?.avatar ?? `https://api.dicebear.com/7.x/bottts/svg?seed=${existing?.username ?? 'Guest'}`,
      authProvider: 'anonymous',
      streak: existing?.streak ?? 0,
      analyzedCount: existing?.analyzedCount ?? 0,
      lastActiveDate: existing?.lastActiveDate ?? null,
      chessComUsername: existing?.chessComUsername ?? undefined,
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
      username: fbUser.displayName ?? (remoteProfile.username as string | undefined) ?? 'GoogleUser',
      email: fbUser.email ?? (remoteProfile.email as string | undefined) ?? '',
      avatar: fbUser.photoURL ?? (remoteProfile.avatar as string | undefined) ?? '',
      authProvider: 'google',
      streak: (remoteProfile.streak as number | undefined) ?? 0,
      analyzedCount: (remoteProfile.analyzedCount as number | undefined) ?? 0,
      lastActiveDate: (remoteProfile.lastActiveDate as string | undefined) ?? null,
      chessComUsername: (remoteProfile.chessComUsername as string | undefined) ?? existing?.chessComUsername ?? undefined,
      settings: (remoteProfile.settings as User['settings'] | undefined) ?? { ...DEFAULT_GUEST.settings },
    };
    saveUser(user);
    useAuthStore.setState({ user, loading: false });
    return;
  }

  if (existing?.id === fbUser.uid) {
    const refreshed = {
      ...existing,
      username: fbUser.displayName ?? existing.username,
      avatar: fbUser.photoURL ?? existing.avatar,
      email: fbUser.email ?? existing.email,
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
    chessComUsername: user.chessComUsername ?? null,
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

  unsubAuth = onAuthChanged((fbUser) => {
    void handleFirebaseUser(fbUser).catch((err) => {
      console.error('[Auth] handleFirebaseUser failed:', err);
      useAuthStore.setState({ error: 'Failed to load profile', loading: false });
    });
  });
}
