import type React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User as UserIcon, Flame, Trophy, Volume2,
  Bell, Palette, Zap, LogOut, Keyboard, Clock,
  Eye, Monitor, ChevronRight, Paintbrush,
  BookOpen,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore, THEME_PRESETS } from '../stores/settingsStore';
import { fetchUserGames } from '../lib/firebase';
import ColorPicker from '../components/ColorPicker';
import StreakFlame, { getStreakTier } from '../components/StreakFlame';
import { Search } from 'lucide-react';
import type { UserSettings } from '../types';

type Tab = 'account' | 'engine' | 'board' | 'audio' | 'clock' | 'colors' | 'streak';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'account', label: 'Account', icon: UserIcon },
  { id: 'engine', label: 'Engine', icon: Zap },
  { id: 'board', label: 'Board', icon: Monitor },
  { id: 'audio', label: 'Audio', icon: Volume2 },
  { id: 'streak', label: 'Streak', icon: Flame },
  { id: 'clock', label: 'Clock', icon: Clock },
  { id: 'colors', label: 'Colors', icon: Paintbrush },
];

const AVAILABLE_THEMES = [
  { id: 'green', name: 'Forest Green', light: '#769656', dark: '#4b6d32' },
  { id: 'blue', name: 'Royal Blue', light: '#4b73be', dark: '#2b4f8a' },
  { id: 'brown', name: 'Classic Wood', light: '#f0d9b5', dark: '#b58863' },
  { id: 'charcoal', name: 'Space Slate', light: '#b7c0d8', dark: '#4d5d75' },
  { id: 'elegant', name: 'Elegant', light: '#f0f0f0', dark: '#b7c0d8' },
  { id: 'ocean-sunset', name: 'Ocean Sunset', light: '#F2E8CF', dark: '#0A9396' },
  { id: 'fresh-greens', name: 'Fresh Greens', light: '#F2E8CF', dark: '#6A994E' },
  { id: 'cherry-blossom', name: 'Cherry Blossom', light: '#FFCCD5', dark: '#C9184A' },
  { id: 'golden-blue', name: 'Golden Blue', light: '#FFF3B0', dark: '#003566' },
  { id: 'pine-forest', name: 'Pine Forest', light: '#EDEDE9', dark: '#3A5A40' },
  { id: 'coastal', name: 'Coastal', light: '#CAF0F8', dark: '#0077B6' },
  { id: 'amber-glow', name: 'Amber Glow', light: '#FEFAE0', dark: '#D62828' },
  { id: 'soft-sand', name: 'Soft Sand', light: '#F5EBE0', dark: '#A9927D' },
];

const shortcutsList = [
  { key: 'flip', label: 'Flip board', keyDisplay: 'F' },
  { key: 'analyze', label: 'Analyze game', keyDisplay: 'A' },
  { key: 'next', label: 'Next move', keyDisplay: '\u2192' },
  { key: 'prev', label: 'Previous move', keyDisplay: '\u2190' },
  { key: 'first', label: 'First move', keyDisplay: 'Home' },
  { key: 'last', label: 'Last move', keyDisplay: 'End' },
  { key: 'shortcuts', label: 'Show shortcuts', keyDisplay: '?' },
];

type SavedGame = {
  id: string;
  shortId?: string;
  date?: string;
  white?: { username?: string };
  black?: { username?: string };
  result?: string;
  accuracy?: { white?: number; black?: number };
  userSaved?: boolean;
};

export default function Profile(): React.ReactElement {
  const { user, loading: authLoading, error: authError } = useAuthStore();
  const loginAsGuest = (name: string): void => { useAuthStore.getState().loginAsGuest(name); };
  const logout = (): void => { useAuthStore.getState().logout(); };
  const signInWithGoogle = (): void => { void useAuthStore.getState().signInWithGoogle(); };
  const { settings } = useSettingsStore();
  const updateSettings = (newSettings: Partial<UserSettings>): void => { useSettingsStore.getState().updateSettings(newSettings); };
  const resetSettings = (): void => { useSettingsStore.getState().resetSettings(); };
  const navigate = useNavigate();
  const [typedName, setTypedName] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('account');
  const [colorPickerTarget, setColorPickerTarget] = useState<'site' | 'board' | null>(null);
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  useEffect(() => {
    if (user != null && (user.authProvider === 'google' || user.authProvider === 'anonymous')) {
      setLoadingSaved(true);
      fetchUserGames(user.id).then(games => {
        setSavedGames((games as SavedGame[]).filter(g => g.userSaved === true));
        setLoadingSaved(false);
      }).catch(() => { setLoadingSaved(false); });
    } else {
      setSavedGames([]);
    }
  }, [user?.id, user?.authProvider]);

  const handleGuestLogin = (e: SubmitEvent): void => {
    e.preventDefault();
    if (typedName.trim()) {
      loginAsGuest(typedName.trim());
      setTypedName('');
    }
  };

  const SettingToggle = ({ label, desc, checked, onChange, id }: {
    label: string; desc: string; checked: boolean; onChange(this: undefined, v: boolean): void; id?: string;
  }): React.ReactElement => (
    <label className="flex items-center justify-between bg-[var(--color-background)] px-3.5 py-2.5 rounded-lg border border-[var(--color-border)] cursor-pointer">
      <div>
        <div className="text-xs font-semibold text-[var(--color-text)]">{label}</div>
        <div className="text-[10px] text-[var(--color-text-muted)]">{desc}</div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => { onChange(e.target.checked); }}
        id={id}
        className="w-9 h-5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-full appearance-none checked:bg-[var(--color-primary)] relative cursor-pointer outline-none before:content-[''] before:absolute before:w-4 before:h-4 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 checked:before:left-4 before:transition-all"
      />
    </label>
  );

  const renderTabNav = (): React.ReactElement => (
    <div className="flex md:flex-col flex-row gap-1.5 md:space-y-1 md:gap-0 overflow-x-auto md:overflow-x-visible -mx-1 px-1 md:mx-0 md:px-0 scrollbar-thin">
      {TABS.map(tab => {
        const Icon = tab.icon;
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); }}
            className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 md:w-full ${
              active
                ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-background)] border border-transparent'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{tab.label}</span>
            {active && <ChevronRight className="w-3.5 h-3.5 ml-auto hidden md:block" />}
          </button>
        );
      })}
    </div>
  );

  const renderAccountTab = (): React.ReactElement => {
    if (authLoading && !user) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    if (!user) {
      return (
        <div className="space-y-5">
          <div className="text-center space-y-2 mb-2">
            <h2 className="text-lg font-extrabold text-[var(--color-text)]">Welcome to FinalRank</h2>
            <p className="text-sm text-[var(--color-text-muted)]">Sign in to save games, track your streak, and customize your experience.</p>
          </div>

          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 space-y-5">
            <form onSubmit={handleGuestLogin} className="space-y-3">
              <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-[var(--color-primary)] block">Guest Login</span>
              <input
                type="text"
                required
                value={typedName}
                onChange={e => { setTypedName(e.target.value); }}
                placeholder="Choose a display name"
                className="bg-[var(--color-background)] border border-[var(--color-border)] w-full rounded-lg px-4 py-2 text-xs text-[var(--color-text)] placeholder-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)]"
              />
              <button type="submit" className="w-full bg-[var(--color-primary)] text-white py-2 rounded-lg font-bold text-xs hover:brightness-110 transition-all">
                Sign In as Guest
              </button>
            </form>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-[var(--color-border)]" />
              <span className="text-[10px] text-[var(--color-text-muted)] font-mono">OR</span>
              <div className="flex-1 h-px bg-[var(--color-border)]" />
            </div>

            <div className="space-y-2">
              <button
                onClick={() => { signInWithGoogle(); }}
                disabled={authLoading}
                className="w-full bg-white text-[var(--color-background)] py-2.5 rounded-lg flex items-center justify-center gap-2 font-bold text-xs hover:brightness-110 transition-all disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5.04c1.67 0 3.14.59 4.3 1.62l3.12-3.12C17.5 1.84 15 1 12 1 7.42 1 3.53 3.63 1.62 7.46l3.82 2.96c.92-2.76 3.51-4.38 6.56-4.38z" />
                  <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.44h6.46c-.28 1.48-1.12 2.73-2.38 3.58l3.71 2.88c2.17-2 3.7-4.94 3.7-8.56z" />
                  <path fill="#FBBC05" d="M5.44 14.5c-.24-.72-.38-1.5-.38-2.3s.14-1.58.38-2.3L1.62 6.94C.58 8.97 0 11.16 0 13.5s.58 4.53 1.62 6.56l3.82-3.06z" />
                  <path fill="#34A853" d="M12 22.8c3.24 0 5.97-1.07 7.96-2.91l-3.71-2.88c-1.03.69-2.35 1.1-4.25 1.1-3.05 0-5.64-1.62-6.56-4.38L1.62 16.8c1.91 3.83 5.8 6 10.38 6z" />
                </svg>
                <span>{authLoading ? 'Signing in...' : 'Sign in with Google'}</span>
              </button>
              {authError != null && authError !== '' && (
                <p className="text-[10px] text-[#fb4934] text-center">{authError}</p>
              )}
              <p className="text-[10px] text-[var(--color-text-muted)] text-center">Link your Google account to save your progress across devices.</p>
            </div>
          </div>

          {authError != null && authError !== '' && authError.includes('configured') && (
            <div className="bg-[var(--color-surface)] border border-[#d65d0e] rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-[#d65d0e]">Firebase not configured</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">To enable Google sign-in, create a <code className="text-[var(--color-accent)]">.env</code> file with your Firebase config:</p>
              <pre className="text-[10px] font-mono text-[var(--color-text-muted)] bg-[var(--color-background)] p-2 rounded-lg">
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id</pre>
            </div>
          )}
        </div>
      );
    }

    const providerLabel = user.authProvider === 'google' ? 'Google Account' : 'Guest';
    const emailDisplay = user.email
      ? `${user.email.slice(0, 3)}...${user.email.split('@')[1] ?? ''}`
      : providerLabel;
    const savedGamesContent = savedGames.length === 0
      ? (
        <p className="text-[10px] text-[var(--color-text-muted)]">No saved games yet. Analyze a game on the Analysis page to save it.</p>
      )
      : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto scrollbar-thin">
          {savedGames.map((g: SavedGame) => (
            <button
              key={g.id}
              onClick={() => {
                const shortId = g.shortId ?? g.id;
                void navigate(`/game/${shortId}`);
              }}
              className="text-left p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:scale-[1.02] transition-all"
            >
              <div className="text-[10px] text-[var(--color-text-muted)] font-semibold mb-0.5">{g.date}</div>
              <div className="text-xs font-bold text-white truncate">
                {g.white?.username} vs {g.black?.username}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-mono text-white bg-[var(--color-surface)] px-1.5 py-0.5 rounded">{g.result}</span>
                {g.accuracy != null && (
                  <span className="text-[10px] text-green-500">W: {g.accuracy.white}% B: {g.accuracy.black}%</span>
                )}
              </div>
            </button>
          ))}
        </div>
      );
    return (
      <div className="space-y-5">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="relative">
            {user.avatar ? (
              <img src={user.avatar} className="w-20 h-20 rounded-full border-4 border-[var(--color-border)] object-cover" alt={user.username} />
            ) : (
              <div className="w-20 h-20 rounded-full border-4 border-[var(--color-border)] bg-[var(--color-primary)] flex items-center justify-center">
                <UserIcon className="w-8 h-8 text-white" />
              </div>
            )}
            <div className="absolute bottom-0 right-0 h-5 w-5 rounded-full bg-[var(--color-primary)] border-2 border-[var(--color-surface)]" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-[var(--color-text)]">{user.username}</h2>
            <p className="text-xs text-[var(--color-text-muted)] font-mono">
              {emailDisplay}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl p-4 flex flex-col items-center text-center relative overflow-hidden">
            <StreakFlame days={user.streak} size={28} />
            <span className="text-xl font-mono font-black mt-1" style={{ color: getStreakTier(user.streak).color }}>
              {user.streak}
            </span>
            <span className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Day Streak</span>
          </div>
          <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl p-3 flex flex-col items-center text-center">
            <Trophy className="w-6 h-6 text-[var(--color-accent)] mb-1" />
            <span className="text-xl font-mono font-black text-[var(--color-accent)]">{user.analyzedCount}</span>
            <span className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Analyzed</span>
          </div>
        </div>

        {user.authProvider === 'google' && (
          <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl p-4 space-y-2.5">
            <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-[var(--color-primary)] block flex items-center gap-1.5">
              <BookOpen className="w-3 h-3" />
              Saved Games
            </span>
            {loadingSaved ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="animate-pulse bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-3 space-y-2">
                    <div className="h-3 w-20 bg-[var(--color-border)] rounded" />
                    <div className="h-3 w-3/4 bg-[var(--color-border)] rounded" />
                    <div className="flex gap-2">
                      <div className="h-3 w-12 bg-[var(--color-border)] rounded" />
                      <div className="h-3 w-24 bg-[var(--color-border)] rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : savedGamesContent}
          </div>
        )}

        <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl p-4 space-y-2.5">
          <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-[var(--color-primary)] block flex items-center gap-1.5">
            <Search className="w-3 h-3" />
            Link Chess.com
          </span>
          <p className="text-[10px] text-[var(--color-text-muted)]">Auto-fetch your last 3 games on the Analysis page.</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              defaultValue={user.chessComUsername ?? ''}
              placeholder="Chess.com username"
              id="chesscom-link-input"
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-white placeholder-[var(--color-text-muted)] flex-1 min-w-0 outline-none focus:border-[var(--color-primary)]"
            />
            <button
              onClick={(e) => {
                const input = (e.target as HTMLElement).parentElement?.querySelector('input');
                if (input != null) void useAuthStore.getState().setChessComUsername(input.value);
              }}
              className="bg-[var(--color-primary)] text-white text-[11px] font-bold px-3 py-2 rounded-lg"
            >
              Save
            </button>
          </div>
        </div>

        <button
          onClick={() => { logout(); }}
          className="w-full flex items-center justify-center gap-2 text-xs text-[var(--color-accent)] border border-[var(--color-border)] px-4 py-2 rounded-lg hover:bg-[var(--color-background)] transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{user.authProvider === 'google' ? 'Sign Out' : 'Disconnect'}</span>
        </button>
      </div>
    );
  };

  const renderEngineTab = (): React.ReactElement => (
    <div className="space-y-5">
      <div className="space-y-2.5">
        <label className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5 uppercase tracking-wider">
          <Zap className="w-4 h-4 text-[var(--color-accent)]" />
          <span>Engine Depth</span>
        </label>
        <select
          value={settings.engineDepth}
          onChange={e => { updateSettings({ engineDepth: parseInt(e.target.value, 10) }); }}
          className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-text)] w-full outline-none focus:border-[var(--color-primary)]"
        >
          <option value={6}>Depth 6 (Fast)</option>
          <option value={8}>Depth 8</option>
          <option value={10}>Depth 10</option>
          <option value={12}>Depth 12</option>
          <option value={15}>Depth 15 (Default)</option>
          <option value={18}>Depth 18 (Max)</option>
        </select>
      </div>

      <div className="space-y-2.5">
        <label className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider">Go Mode</label>
        <div className="flex gap-2">
          {(['depth', 'time'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => { updateSettings({ engineGoMode: mode }); }}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                settings.engineGoMode === mode
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-background)] text-[var(--color-text-muted)] border border-[var(--color-border)]'
              }`}
            >
              {mode === 'depth' ? 'Depth' : 'Time'}
            </button>
          ))}
        </div>
      </div>

      {settings.engineGoMode === 'time' && (
        <div className="space-y-2.5">
          <label className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider">Time Limit</label>
          <input
            type="range"
            min={500}
            max={30000}
            step={500}
            value={settings.engineTimeLimitMs}
            onChange={e => { updateSettings({ engineTimeLimitMs: parseInt(e.target.value, 10) }); }}
            className="w-full accent-[var(--color-primary)] h-1 bg-[var(--color-border)] rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] font-mono text-[var(--color-text-muted)]">
            <span>0.5s</span>
            <span className="font-bold text-[var(--color-accent)]">{(settings.engineTimeLimitMs / 1000).toFixed(1)}s</span>
            <span>30s</span>
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        <span className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider flex items-center gap-1.5">
          <Keyboard className="w-4 h-4 text-[var(--color-accent)]" />
          Keyboard Shortcuts
        </span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {shortcutsList.map(s => (
            <div key={s.key} className="flex items-center justify-between bg-[var(--color-background)] px-3 py-2 rounded-lg border border-[var(--color-border)]">
              <span className="text-xs text-[var(--color-text)]">{s.label}</span>
              <span className="text-[10px] font-mono text-[var(--color-text-muted)] bg-[var(--color-surface)] px-2 py-0.5 rounded">{s.keyDisplay}</span>
            </div>
          ))}
        </div>
        <SettingToggle label="Enable shortcuts" desc="Toggle keyboard navigation" checked={settings.shortcutsEnabled} onChange={v => { updateSettings({ shortcutsEnabled: v }); }} />
      </div>

      <div className="space-y-2.5 pt-3 border-t border-[var(--color-border)]">
        <span className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider">Advanced</span>
        <SettingToggle
          label="Remote Evaluation"
          desc="Use cloud servers to speed up analysis (recommended)"
          checked={settings.featureToggles.remoteEvaluation}
          onChange={v => { updateSettings({ featureToggles: { ...settings.featureToggles, remoteEvaluation: v } }); }}
        />
        <SettingToggle
          label="Community Acceleration"
          desc="Opt-in to share your device to help others analyze faster. No penalty for disabling."
          checked={settings.featureToggles.distributedAnalysis}
          onChange={v => { updateSettings({ featureToggles: { ...settings.featureToggles, distributedAnalysis: v } }); }}
        />
      </div>

      {/* Cache Management */}
      <div className="space-y-2.5 pt-3 border-t border-[var(--color-border)]">
        <span className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider">Cache</span>
        <p className="text-[10px] text-[var(--color-text-muted)]">
          Clear cached sounds, images, and engine files to free up disk space.
        </p>
        <button
          onClick={async () => {
            if (!window.confirm('Clear all cached site files (images, sounds, engines)? This will not affect your saved games or settings.')) return;
            // Clear Service Worker caches
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
            }
            // Also clear Cache Storage directly as a fallback
            if ('caches' in window) {
              const keys = await caches.keys();
              await Promise.all(keys.map(k => caches.delete(k)));
            }
            alert('Cache cleared! The site will reload to apply changes.');
            window.location.reload();
          }}
          className="w-full bg-[var(--color-background)] border border-[var(--color-accent)] text-[var(--color-accent)] py-2 rounded-lg text-xs font-bold hover:bg-[var(--color-accent)] hover:text-white transition-all"
        >
          Clear Cache
        </button>
      </div>
    </div>
  );

  const renderBoardTab = (): React.ReactElement => (
    <div className="space-y-5">
      <div className="space-y-2.5">
        <label className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5 uppercase tracking-wider">
          <Palette className="w-4 h-4 text-[var(--color-accent)]" />
          <span>Board Theme</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {AVAILABLE_THEMES.map(theme => {
            const sel = settings.boardColor === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => { updateSettings({ boardColor: theme.id }); }}
                className={`rounded-xl border p-3 flex flex-col items-center gap-2 text-center h-20 transition-all ${
                  sel
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'border-[var(--color-border)] bg-[var(--color-background)]'
                }`}
              >
                <div className="flex gap-0.5">
                  <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: theme.light }} />
                  <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: theme.dark }} />
                </div>
                <span className="text-[9px] font-bold text-[var(--color-text)] leading-none">{theme.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <SettingToggle
        label="Show Coordinates"
        desc="Display a-h, 1-8 labels on the board"
        checked={settings.featureToggles.showCoordinates}
        onChange={v => { updateSettings({ featureToggles: { ...settings.featureToggles, showCoordinates: v } }); }}
      />

      <div className="flex items-center justify-between bg-[var(--color-background)] px-3.5 py-2.5 rounded-lg border border-[var(--color-border)]">
        <div>
          <div className="text-xs font-semibold text-[var(--color-text)]">Coordinates Size</div>
          <div className="text-[10px] text-[var(--color-text-muted)]">{settings.coordinatesSize}px</div>
        </div>
        <input
          type="range"
          min={6}
          max={20}
          value={settings.coordinatesSize}
          onChange={e => { updateSettings({ coordinatesSize: parseInt(e.target.value, 10) }); }}
          className="w-28 h-1.5 bg-[var(--color-border)] rounded-full appearance-none cursor-pointer accent-[var(--color-primary)]"
        />
      </div>

      <div className="space-y-2.5">
        <label className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider">Board Orientation</label>
        <div className="flex gap-2">
          {(['white', 'black'] as const).map(side => (
            <button
              key={side}
              onClick={() => { updateSettings({ boardOrientation: side }); }}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold capitalize transition-all ${
                settings.boardOrientation === side
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-background)] text-[var(--color-text-muted)] border border-[var(--color-border)]'
              }`}
            >
              {side === 'white' ? 'White Bottom' : 'Black Bottom'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        <label className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5 uppercase tracking-wider">
          <Eye className="w-4 h-4 text-[var(--color-accent)]" />
          <span>Highlight Colors</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {([
            { key: 'moveTrail', label: 'Move Trail', desc: 'From/to squares' },
            { key: 'selectedSquare', label: 'Selected', desc: 'Clicked piece' },
            { key: 'rightClick', label: 'Right-Click', desc: 'Right-click markers' },
          ] as const).map(({ key, label, desc }) => (
            <div key={key} className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-2.5 space-y-1.5">
              <div className="text-[10px] font-semibold text-[var(--color-text)]">{label}</div>
              <div className="text-[9px] text-[var(--color-text-muted)]">{desc}</div>
              <input
                type="color"
                value={settings.highlightColors[key]}
                onChange={e => { updateSettings({
                  highlightColors: { ...settings.highlightColors, [key]: e.target.value }
                }); }}
                className="w-full h-8 rounded border border-[var(--color-border)] cursor-pointer [&::-webkit-color-swatch-wrapper]:p-1 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderAudioTab = (): React.ReactElement => (
    <div className="space-y-5">
      <SettingToggle
        label="Sound Effects"
        desc="Play sounds for moves and alerts"
        checked={settings.audioEnabled}
        onChange={v => { updateSettings({ audioEnabled: v }); }}
      />

      <div className="flex items-center justify-between bg-[var(--color-background)] px-3.5 py-2.5 rounded-lg border border-[var(--color-border)]">
        <div className="flex items-center gap-2.5">
          <div>
            <div className="text-xs font-semibold text-[var(--color-text)]">Volume</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">{Math.round(settings.audioVolume * 100)}%</div>
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(settings.audioVolume * 100)}
          onChange={e => { updateSettings({ audioVolume: parseInt(e.target.value, 10) / 100 }); }}
          className="w-24 accent-[var(--color-primary)] h-1 bg-[var(--color-border)] rounded-lg cursor-pointer"
        />
      </div>

      <div className="space-y-3 pt-3 border-t border-[var(--color-border)]">
        <span className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider flex items-center gap-1.5">
          <Bell className="w-4 h-4 text-[var(--color-accent)]" />
          Notifications
        </span>
        <SettingToggle
          label="Analysis Notifications"
          desc="Show legendary alerts after analysis"
          checked={settings.notificationsEnabled}
          onChange={v => { updateSettings({ notificationsEnabled: v }); }}
        />
      </div>
    </div>
  );

  const renderClockTab = (): React.ReactElement => (
    <div className="space-y-5">
      <div className="space-y-3">
        <span className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-[var(--color-accent)]" />
          Clock Alerts
        </span>
        <div className="grid grid-cols-1 gap-3">
          <SettingToggle
            label="Time Alert"
            desc="Warn when time is low"
            checked={settings.timeAlertEnabled}
            onChange={v => { updateSettings({ timeAlertEnabled: v }); }}
          />
          <SettingToggle
            label="Alert Sound"
            desc="Play warning beep"
            checked={settings.timeAlertSound}
            onChange={v => { updateSettings({ timeAlertSound: v }); }}
          />
        </div>
      </div>

      <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3.5 py-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-[var(--color-text)]">Alert Threshold</span>
          <span className="text-[10px] font-mono font-bold text-[var(--color-accent)] bg-[var(--color-surface)] px-2 py-0.5 rounded">{settings.timeAlertThreshold}s</span>
        </div>
        <input
          type="range"
          min={5}
          max={120}
          step={5}
          value={settings.timeAlertThreshold}
          onChange={e => { updateSettings({ timeAlertThreshold: parseInt(e.target.value, 10) }); }}
          className="w-full accent-[var(--color-primary)] h-1 bg-[var(--color-border)] rounded-lg cursor-pointer"
          disabled={!settings.timeAlertEnabled}
        />
        <div className="flex justify-between text-[9px] text-[var(--color-text-muted)] font-mono mt-0.5">
          <span>5s</span>
          <span>30s</span>
          <span>60s</span>
          <span>120s</span>
        </div>
      </div>
    </div>
  );

  const renderStreakTab = (): React.ReactElement => (
    <div className="space-y-5">
      {/* streak preview */}
      <div className="flex flex-col items-center py-6 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl">
        <StreakFlame days={user?.streak ?? 0} size={64} showCount />
        <span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider mt-2">
          Current streak: {user?.streak ?? 0} days
        </span>
      </div>

      {/* victory sound */}
      <div className="space-y-3">
        <span className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider flex items-center gap-1.5">
          <Volume2 className="w-4 h-4 text-[var(--color-accent)]" />
          Victory Sound
        </span>
        <SettingToggle
          label="Play Sound"
          desc="Celebration chime when streak increases"
          checked={settings.streakSoundEnabled}
          onChange={v => { updateSettings({ streakSoundEnabled: v }); }}
        />
        <div className="flex items-center justify-between bg-[var(--color-background)] px-3.5 py-2.5 rounded-lg border border-[var(--color-border)]">
          <div>
            <div className="text-xs font-semibold text-[var(--color-text)]">Volume</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">{Math.round(settings.streakSoundVolume * 100)}%</div>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(settings.streakSoundVolume * 100)}
            onChange={e => { updateSettings({ streakSoundVolume: parseInt(e.target.value, 10) / 100 }); }}
            className="w-24 accent-[var(--color-primary)] h-1 bg-[var(--color-border)] rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* flame style */}
      <div className="space-y-3 pt-3 border-t border-[var(--color-border)]">
        <span className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider flex items-center gap-1.5">
          <Flame className="w-4 h-4 text-[var(--color-accent)]" />
          Flame Appearance
        </span>
        <SettingToggle
          label="Animated Canvas"
          desc="Rich particle animation (larger badges)"
          checked={settings.streakFlameAnimated}
          onChange={v => { updateSettings({ streakFlameAnimated: v }); }}
        />
        <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3.5 py-3">
          <div className="text-xs font-semibold text-[var(--color-text)] mb-2">Color Mode</div>
          <div className="flex gap-2">
            {(['heat', 'gold', 'white'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => { updateSettings({ streakFlameColorMode: mode }); }}
                className={`flex-1 text-[11px] font-bold py-2 rounded-lg capitalize transition-all ${
                  settings.streakFlameColorMode === mode
                    ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderColorsTab = (): React.ReactElement => {
    const themeKeys = Object.keys(THEME_PRESETS);

    return (
      <div className="space-y-5">
        <div className="space-y-2.5">
          <label className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5 uppercase tracking-wider">
            <Paintbrush className="w-4 h-4 text-[var(--color-accent)]" />
            <span>Theme Preset</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {themeKeys.map(key => {
              const preset = THEME_PRESETS[key];
              const sel = settings.themePreset === key;
              return (
                <button
                  key={key}
                  onClick={() => {
                    updateSettings({
                      themePreset: key,
                      siteColors: { ...preset.siteColors },
                      boardCustomColors: { ...preset.boardCustomColors },
                    });
                  }}
                  className={`rounded-xl border p-3 flex flex-col items-center gap-1.5 transition-all ${
                    sel
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                      : 'border-[var(--color-border)] bg-[var(--color-background)]'
                  }`}
                >
                  <div className="flex gap-1">
                    <div className="w-5 h-5 rounded" style={{ backgroundColor: preset.siteColors.primary }} />
                    <div className="w-5 h-5 rounded" style={{ backgroundColor: preset.siteColors.accent }} />
                    <div className="w-5 h-5 rounded" style={{ backgroundColor: preset.siteColors.background }} />
                  </div>
                  <span className="text-[9px] font-bold text-[var(--color-text)] capitalize leading-none">{key}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2.5 pt-4 border-t border-[var(--color-border)]">
          <label className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider">Site Colors</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(settings.siteColors).map(([key, value]) => (
              <button
                key={key}
                onClick={() => { setColorPickerTarget('site'); }}
                className="flex items-center gap-3 bg-[var(--color-background)] px-3 py-2 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-primary)] transition-all text-left"
              >
                <div className="w-8 h-8 rounded-lg border border-[var(--color-border)] shrink-0" style={{ backgroundColor: value }} />
                <div>
                  <div className="text-xs font-semibold text-[var(--color-text)] capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                  <div className="text-[10px] font-mono text-[var(--color-text-muted)]">{value}</div>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => { setColorPickerTarget('site'); }}
            className="w-full mt-2 bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg font-bold text-xs hover:brightness-110 transition-all"
          >
            Customize Site Colors
          </button>
        </div>

        <div className="space-y-2.5 pt-4 border-t border-[var(--color-border)]">
          <label className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider">Board Colors</label>
          <div className="flex gap-3">
            {Object.entries(settings.boardCustomColors).map(([key, value]) => (
              <button
                key={key}
                onClick={() => { setColorPickerTarget('board'); }}
                className="flex-1 flex items-center gap-3 bg-[var(--color-background)] px-3 py-2 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-primary)] transition-all text-left"
              >
                <div className="w-8 h-8 rounded-lg border border-[var(--color-border)] shrink-0" style={{ backgroundColor: value }} />
                <div>
                  <div className="text-xs font-semibold text-[var(--color-text)] capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                  <div className="text-[10px] font-mono text-[var(--color-text-muted)]">{value}</div>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => { setColorPickerTarget('board'); }}
            className="w-full mt-2 bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg font-bold text-xs hover:brightness-110 transition-all"
          >
            Customize Board Colors
          </button>
        </div>
      </div>
    );
  };

  const renderTabContent = (): React.ReactElement => {
    switch (activeTab) {
      case 'account': return renderAccountTab();
      case 'engine': return renderEngineTab();
      case 'board': return renderBoardTab();
      case 'audio': return renderAudioTab();
      case 'clock': return renderClockTab();
      case 'colors': return renderColorsTab();
      case 'streak': return renderStreakTab();
    }
  };

  const handleColorSave = (fields: { key: string; label: string; value: string }[]): void => {
    if (colorPickerTarget === 'site') {
      const siteColors = { ...settings.siteColors };
      fields.forEach(f => { (siteColors as Record<string, string>)[f.key] = f.value; });
      updateSettings({ siteColors, themePreset: 'custom' });
    } else if (colorPickerTarget === 'board') {
      const boardCustomColors = { ...settings.boardCustomColors };
      fields.forEach(f => { (boardCustomColors as Record<string, string>)[f.key] = f.value; });
      updateSettings({ boardCustomColors, themePreset: 'custom' });
    }
    setColorPickerTarget(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5" id="profile-container">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--color-text)] tracking-tight">Profile</h1>
        {user != null && (
          <button
            onClick={resetSettings}
            className="text-xs font-semibold px-3 py-1.5 bg-[var(--color-surface)] text-[var(--color-text-muted)] rounded-lg border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-all"
          >
            Reset Defaults
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="md:col-span-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-2.5 md:p-4 min-w-0">
          {renderTabNav()}
        </div>

        <div className="md:col-span-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 md:p-6 min-h-[400px] min-w-0">
          {renderTabContent()}
        </div>
      </div>

      {colorPickerTarget && (
        <ColorPicker
          title={colorPickerTarget === 'site' ? 'Customize Site Colors' : 'Customize Board Colors'}
          fields={
            colorPickerTarget === 'site'
              ? Object.entries(settings.siteColors).map(([key, value]) => ({ key, label: key.replace(/([A-Z])/g, ' $1').trim(), value }))
              : Object.entries(settings.boardCustomColors).map(([key, value]) => ({ key, label: key.replace(/([A-Z])/g, ' $1').trim(), value }))
          }
          onSave={handleColorSave}
          onClose={() => { setColorPickerTarget(null); }}
        />
      )}
    </div>
  );
}
