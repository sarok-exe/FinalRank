import { create } from 'zustand';
import type { User } from '../types';
import { signInWithGoogle, signInAnonymously, onAuthChanged, signOut as fbSignOut, isFirebaseConfigured, fetchUserProfile, saveUserProfile, updateUserProfile, probeFirestore } from '../lib/firebase';

type AuthState = {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle(): Promise<void>;
  loginAsGuest(username?: string): void;
  logout(): void;
  incrementAnalyzedGames(): Promise<void>;
  setChessComUsername(username: string): Promise<void>;
  setLichessUsername(username: string): Promise<void>;
}

const DEFAULT_GUEST: User = {
  id: 'guest_user',
  username: 'ChessPro_Guest',
  email: '',
  avatar: '',
  authProvider: 'guest',
  analyzedCount: 0,
  lastActiveDate: null,
    settings: {
      engineDepth: 10,
      engineGoMode: 'depth',
      engineEffort: 'balanced',
      engineTimeLimitMs: 2000,
      engineVersion: 'stockfish-18-lite-single.js',
      engineLinesCount: 2,
      followBestLine: false,
      suggestionArrows: false,
      boardColor: 'green',
      boardOrientation: 'white',
      audioEnabled: true,
      audioVolume: 0.7,
      shortcutsEnabled: true,
      timeAlertEnabled: true,
      timeAlertThreshold: 10,
      timeAlertSound: true,
      timePressureSound: true,
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
        rightClick: '#e53935',
      },
      rightClickHighlightColor: '#e53935',
      parallelWorkers: 4,
      autoDepth: true,
      featureToggles: {
        showCoordinates: true,
        autoAnalyze: true,
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
  try {
    localStorage.setItem('finalrank_user', JSON.stringify(user));
  } catch (e) {
    console.warn('[Auth] Failed to persist user to localStorage:', e);
  }
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
    const existing = loadUser();
    const user: User = {
      ...DEFAULT_GUEST,
      id: existing?.id ?? `guest_user_${Date.now()}`,
      username,
      avatar: existing?.avatar ?? `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
      analyzedCount: existing?.analyzedCount ?? 0,
      lastActiveDate: existing?.lastActiveDate ?? null,
      chessComUsername: existing?.chessComUsername,
      lichessUsername: existing?.lichessUsername,
      settings: existing?.settings ?? { ...DEFAULT_GUEST.settings },
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

  setLichessUsername: async (lichessUsername: string) => {
    const { user } = get();
    if (!user) return;
    const trimmed = lichessUsername.trim();
    const updated = { ...user, lichessUsername: trimmed || undefined };
    set({ user: updated });
    saveUser(updated);
    if (user.authProvider === 'google') {
      void updateUserProfile(updated.id, {
        lichessUsername: updated.lichessUsername ?? null,
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
    analyzedCount: existing?.analyzedCount ?? 0,
    lastActiveDate: existing?.lastActiveDate ?? null,
    chessComUsername: existing?.chessComUsername ?? undefined,
    lichessUsername: existing?.lichessUsername ?? undefined,
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

  // Probe Firestore now that we have a token, so a healthy DB enables the SDK
  // (a broken one stays disabled — no reconnect storm, no frozen tab).
  void probeFirestore();

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
      analyzedCount: existing?.analyzedCount ?? 0,
      lastActiveDate: existing?.lastActiveDate ?? null,
      chessComUsername: existing?.chessComUsername ?? undefined,
      lichessUsername: existing?.lichessUsername ?? undefined,
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
      analyzedCount: (remoteProfile.analyzedCount as number | undefined) ?? 0,
      lastActiveDate: (remoteProfile.lastActiveDate as string | undefined) ?? existing?.lastActiveDate ?? null,
      chessComUsername: (remoteProfile.chessComUsername as string | undefined) ?? existing?.chessComUsername ?? undefined,
      lichessUsername: (remoteProfile.lichessUsername as string | undefined) ?? existing?.lichessUsername ?? undefined,
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
    analyzedCount: user.analyzedCount,
    lastActiveDate: user.lastActiveDate,
    chessComUsername: user.chessComUsername ?? null,
    lichessUsername: user.lichessUsername ?? null,
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
