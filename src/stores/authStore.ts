import { create } from 'zustand';
import type { User } from '../types';
import { signInWithGoogle, signInAnonymously, onAuthChanged, signOut as fbSignOut, isFirebaseConfigured, fetchUserProfile, saveUserProfile, updateUserProfile, probeFirestore } from '../lib/firebase';

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
  checkStreakOnLogin(): void;
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
      engineEffort: 'balanced',
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
        rightClick: '#003088',
      },
      rightClickHighlightColor: '#e53935',
      streakSoundEnabled: true,
      streakSoundVolume: 0.4,
      streakFlameAnimated: true,
      streakFlameColorMode: 'heat',
      parallelWorkers: 4,
      autoDepth: true,
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

type StreakResult = { streakIncremented: boolean; newStreak: number; prevStreak: number };

let streakMutationLock: Promise<StreakResult> = Promise.resolve({
  streakIncremented: false,
  newStreak: 0,
  prevStreak: 0,
});

/** Format a Date as YYYY-MM-DD in the user's local timezone. */
function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Number of whole days between two YYYY-MM-DD strings (b - a), interpreted as local dates. */
function daysBetweenLocal(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const aDate = new Date(ay, (am ?? 1) - 1, ad ?? 1);
  const bDate = new Date(by, (bm ?? 1) - 1, bd ?? 1);
  const ms = bDate.getTime() - aDate.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
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
    const existing = loadUser();
    const user: User = {
      ...DEFAULT_GUEST,
      id: existing?.id ?? `guest_user_${Date.now()}`,
      username,
      avatar: existing?.avatar ?? `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
      streak: existing?.streak ?? 0,
      analyzedCount: existing?.analyzedCount ?? 0,
      lastActiveDate: existing?.lastActiveDate ?? null,
      chessComUsername: existing?.chessComUsername,
      settings: existing?.settings ?? { ...DEFAULT_GUEST.settings },
    };
    set({ user, error: null });
    saveUser(user);
    get().checkStreakOnLogin();
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
    // Serialize streak mutations to prevent races from rapid analysis completions
    return streakMutationLock = streakMutationLock.then(async () => {
      const { user } = get();
      if (!user) return { streakIncremented: false, newStreak: 0, prevStreak: 0 };
      const now = new Date();
      const todayLocal = formatLocalDate(now);
      const lastActive = user.lastActiveDate;
      const prevStreak = user.streak;
      let newStreak = prevStreak;
      let streakIncremented = false;

      if (lastActive == null || lastActive === '') {
        // First time analyzing
        newStreak = 1;
        streakIncremented = true;
      } else if (lastActive === todayLocal) {
        // Already analyzed today, no change
        return { streakIncremented: false, newStreak: prevStreak, prevStreak };
      } else {
        // Check if consecutive day or missed days
        const diffDays = daysBetweenLocal(lastActive, todayLocal);

        if (diffDays === 1) {
          // Consecutive day - increment streak
          newStreak = prevStreak + 1;
          streakIncremented = true;
        } else if (diffDays > 1) {
          // Missed one or more days - reset to 1 (started a new streak today)
          newStreak = 1;
          streakIncremented = prevStreak > 0; // Only show notification if they had a streak before
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
    });
  },

  checkStreakOnLogin: () => {
    const { user } = get();
    if (!user || !user.lastActiveDate || user.lastActiveDate === '') return;
    
    const now = new Date();
    const todayLocal = formatLocalDate(now);
    
    if (user.lastActiveDate === todayLocal) {
      // Already active today, no change needed
      return;
    }
    
    // Check if yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayLocal = formatLocalDate(yesterday);
    
    if (user.lastActiveDate === yesterdayLocal) {
      // Active yesterday, streak is still valid
      return;
    }
    
    // Missed a day - reset streak to 1 (consistent with updateStreakOnAnalysis)
    const updated = { ...user, streak: 1 };
    set({ user: updated });
    saveUser(updated);
    if (user.authProvider === 'google') {
      void updateUserProfile(updated.id, {
        streak: updated.streak,
      });
    }
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
    lastActiveDate: existing?.lastActiveDate ?? null,
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
      streak: existing?.streak ?? 0,
      analyzedCount: existing?.analyzedCount ?? 0,
      lastActiveDate: existing?.lastActiveDate ?? null,
      chessComUsername: existing?.chessComUsername ?? undefined,
      settings: existing?.settings ?? { ...DEFAULT_GUEST.settings },
    };
    saveUser(user);
    useAuthStore.setState({ user, loading: false });
    useAuthStore.getState().checkStreakOnLogin();
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
      lastActiveDate: (remoteProfile.lastActiveDate as string | undefined) ?? existing?.lastActiveDate ?? null,
      chessComUsername: (remoteProfile.chessComUsername as string | undefined) ?? existing?.chessComUsername ?? undefined,
      settings: (remoteProfile.settings as User['settings'] | undefined) ?? { ...DEFAULT_GUEST.settings },
    };
    saveUser(user);
    useAuthStore.setState({ user, loading: false });
    useAuthStore.getState().checkStreakOnLogin();
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
    useAuthStore.getState().checkStreakOnLogin();
    return;
  }

  const user = buildGoogleUser(fbUser);
  saveUser(user);
  useAuthStore.setState({ user, loading: false });
  useAuthStore.getState().checkStreakOnLogin();

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
