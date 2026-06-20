/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { User } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  loginAsGuest: (username?: string) => void;
  logout: () => void;
  incrementAnalyzedGames: () => Promise<void>;
  updateStreakOnAnalysis: () => Promise<void>;
  syncProfileWithBackend: () => Promise<void>;
}

const DEFAULT_GUEST: User = {
  id: 'guest_user',
  username: 'ChessPro_Guest',
  email: 'guesthunter@chess.com',
  avatar: 'https://images.unsplash.com/photo-1548142813-c348350df52b?auto=format&fit=crop&q=80&w=150',
  streak: 3, // Starter streak to demonstrate styling
  analyzedCount: 14,
  lastActiveDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0], // yesterday
  settings: {
    engineDepth: 10,
    engineGoMode: 'depth',
    engineTimeLimitMs: 2000,
    boardColor: 'green',
    notificationsEnabled: true,
    audioEnabled: true,
    audioVolume: 0.7,
    animationsEnabled: true,
    featureToggles: {
      showArrows: true,
      showCoordinates: true,
      autoAnalyze: true
    },
    boardOrientation: 'white',
    shortcutsEnabled: true,
    timeAlertEnabled: true,
    timeAlertThreshold: 10,
    timeAlertSound: true
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: typeof localStorage !== 'undefined' && localStorage.getItem('finalrank_user')
    ? JSON.parse(localStorage.getItem('finalrank_user')!)
    : null,
  loading: false,
  error: null,

  loginAsGuest: (username = 'ChessPro_Guest') => {
    const user: User = {
      ...DEFAULT_GUEST,
      username,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`
    };
    set({ user });
    localStorage.setItem('finalrank_user', JSON.stringify(user));
  },

  logout: () => {
    set({ user: null });
    localStorage.removeItem('finalrank_user');
  },

  incrementAnalyzedGames: async () => {
    const { user } = get();
    if (!user) return;

    const updatedUser = {
      ...user,
      analyzedCount: user.analyzedCount + 1
    };

    set({ user: updatedUser });
    localStorage.setItem('finalrank_user', JSON.stringify(updatedUser));
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
      const lastDate = new Date(lastActive);
      const currentDate = new Date(today);
      const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // Active yesterday, increment streak
        newStreak += 1;
      } else if (diffDays > 1) {
        // Streak broken, reset to 1
        newStreak = 1;
      }
    }

    const updatedUser = {
      ...user,
      streak: newStreak,
      lastActiveDate: today
    };

    set({ user: updatedUser });
    localStorage.setItem('finalrank_user', JSON.stringify(updatedUser));
  },

  syncProfileWithBackend: async () => {
    const { user } = get();
    if (!user) return;

    // Silent skip — no backend server running yet
    set({ loading: false });
  }
}));
