import React, { useState } from 'react';
import {
  User as UserIcon,
  Settings,
  Flame,
  Trophy,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
  Palette,
  Activity,
  Smartphone,
  ShieldAlert,
  Zap,
  Eye,
  EyeOff,
  Sliders,
  LogOut,
  Keyboard,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';

export default function Profile() {
  const { user, loginAsGuest, logout } = useAuthStore();
  const { settings, updateSettings, resetSettings } = useSettingsStore();
  const [typedName, setTypedName] = useState('');

  const boardThemes = [
    { id: 'green', name: 'Forest Green', bg: 'bg-[#769656]' },
    { id: 'blue', name: 'Royal Blue', bg: 'bg-[#4b73be]' },
    { id: 'brown', name: 'Classic Wood', bg: 'bg-[#b58863]' },
    { id: 'charcoal', name: 'Space Slate', bg: 'bg-[#4d5d75]' },
    { id: 'elegant', name: 'Elegant', bg: 'bg-[#b7c0d8]' },
  ];

  const handleGuestLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (typedName.trim()) {
      loginAsGuest(typedName.trim());
      setTypedName('');
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto space-y-6" id="profile-container">
        <div className="text-center space-y-2 mb-2">
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Welcome to FinalRank</h1>
          <p className="text-sm text-[#a0a0a0]">Sign in to save games, track your streak, and customize your experience.</p>
        </div>

        <div className="bg-[#333333] border border-[#4a4a4a] rounded-2xl p-6 space-y-5">
          <div className="mx-auto bg-[#606c38] w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl font-black">
            FR
          </div>

          <form onSubmit={handleGuestLogin} className="space-y-3 bg-[#2a2a2a] p-4 rounded-xl border border-[#4a4a4a]">
            <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-[#606c38] block text-left">Guest Login</span>
            <input
              type="text"
              required
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="Choose a display name"
              className="bg-[#2a2a2a] border border-[#4a4a4a] w-full rounded-lg px-4 py-2 text-xs text-white placeholder-[#888888]"
              id="handle-input"
            />
            <button type="submit" className="w-full bg-[#606c38] text-white py-2 rounded-lg font-bold text-xs">
              Sign In as Guest
            </button>
          </form>

          <div className="space-y-2 border-t border-[#4a4a4a] pt-4">
            <button
              onClick={() => loginAsGuest('GM_GoogleUser')}
              className="w-full bg-white text-[#1a1a1a] py-2.5 rounded-lg flex items-center justify-center space-x-2 font-bold text-xs"
              id="google-oauth-btn"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5.04c1.67 0 3.14.59 4.3 1.62l3.12-3.12C17.5 1.84 15 1 12 1 7.42 1 3.53 3.63 1.62 7.46l3.82 2.96c.92-2.76 3.51-4.38 6.56-4.38z" />
                <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.44h6.46c-.28 1.48-1.12 2.73-2.38 3.58l3.71 2.88c2.17-2 3.7-4.94 3.7-8.56z" />
                <path fill="#FBBC05" d="M5.44 14.5c-.24-.72-.38-1.5-.38-2.3s.14-1.58.38-2.3L1.62 6.94C.58 8.97 0 11.16 0 13.5s.58 4.53 1.62 6.56l3.82-3.06z" />
                <path fill="#34A853" d="M12 22.8c3.24 0 5.97-1.07 7.96-2.91l-3.71-2.88c-1.03.69-2.35 1.1-4.25 1.1-3.05 0-5.64-1.62-6.56-4.38L1.62 16.8c1.91 3.83 5.8 6 10.38 6z" />
              </svg>
              <span>Connect with Google</span>
            </button>
            <p className="text-[10px] text-[#888888] text-center">Google OAuth coming soon. Guest mode works offline.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" id="profile-container">
      <div className="lg:col-span-4 bg-[#333333] border border-[#4a4a4a] rounded-2xl p-6 flex flex-col min-h-[400px]" id="user-stats-card">
        <div className="space-y-5">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="relative">
              <img src={user.avatar} className="w-20 h-20 rounded-full border-4 border-[#4a4a4a] object-cover" alt={user.username} />
              <div className="absolute bottom-0 right-0 h-5 w-5 rounded-full bg-[#606c38] border-2 border-[#333333]" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">{user.username}</h2>
              <p className="text-xs text-[#a0a0a0] font-mono">{user.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3" id="stats-gauges">
            <div className="bg-[#2a2a2a] border border-[#4a4a4a] rounded-xl p-3 flex flex-col items-center justify-center text-center" id="streak-gauge-item">
              <Flame className="w-6 h-6 text-[#bc6c25] mb-1" />
              <span className="text-xl font-mono font-black text-[#bc6c25]">{user.streak}</span>
              <span className="text-[9px] text-[#a0a0a0] font-bold uppercase tracking-wider">Day Streak</span>
            </div>
            <div className="bg-[#2a2a2a] border border-[#4a4a4a] rounded-xl p-3 flex flex-col items-center justify-center text-center" id="analyzed-gauge-item">
              <Trophy className="w-6 h-6 text-[#bc6c25] mb-1" />
              <span className="text-xl font-mono font-black text-[#bc6c25]">{user.analyzedCount}</span>
              <span className="text-[9px] text-[#a0a0a0] font-bold uppercase tracking-wider">Analyzed</span>
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center space-x-2 text-xs text-[#bc6c25] border border-[#4a4a4a] px-4 py-2 rounded-lg"
            id="logout-btn-profile"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Disconnect</span>
          </button>
        </div>

        <div className="border-t border-[#4a4a4a] pt-4 mt-4 text-[11px] text-[#888888] leading-relaxed flex items-start space-x-2">
          <ShieldAlert className="w-4 h-4 text-[#606c38] shrink-0" />
          <span>Streak updates automatically after each analysis.</span>
        </div>
      </div>

      <div className="lg:col-span-8 bg-[#333333] border border-[#4a4a4a] rounded-2xl p-6 space-y-6" id="settings-card">
        <div className="flex items-center justify-between border-b border-[#4a4a4a] pb-4">
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center space-x-2">
              <Settings className="w-5 h-5 text-[#bc6c25]" />
              <span>Settings</span>
            </h3>
            <p className="text-xs text-[#a0a0a0]">All settings are saved locally.</p>
          </div>
          <button onClick={resetSettings} className="text-xs font-semibold px-3 py-1.5 bg-[#3d3d3d] text-[#d0d0d0] rounded-lg border border-[#4a4a4a]" id="reset-settings-button">
            Reset Defaults
          </button>
        </div>

        <div className="space-y-2.5">
          <label className="text-xs font-bold text-white flex items-center space-x-1.5 uppercase tracking-wider">
            <Palette className="w-4 h-4 text-[#bc6c25]" />
            <span>Board Theme</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2" id="theme-swatches-grid">
            {boardThemes.map((theme) => {
              const isSel = settings.boardColor === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => updateSettings({ boardColor: theme.id as any })}
                  className={`rounded-xl border p-3 flex flex-col items-center justify-center space-y-2 text-center h-20 ${
                    isSel
                      ? 'bg-[#3d3d3d] border-[#606c38]'
                      : 'bg-[#2a2a2a] border-[#4a4a4a]'
                  }`}
                  id={`swatch-${theme.id}`}
                >
                  <div className={`w-8 h-8 rounded shadow-inner ${theme.bg}`} />
                  <span className="text-[9px] font-bold text-white leading-none">{theme.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2.5">
          <label className="text-xs font-bold text-white flex items-center space-x-1.5 uppercase tracking-wider">
            <Zap className="w-4 h-4 text-[#bc6c25]" />
            <span>Engine</span>
          </label>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#a0a0a0]">Depth:</span>
            <select
              value={settings.engineDepth}
              onChange={(e) => updateSettings({ engineDepth: parseInt(e.target.value, 10) })}
              className="bg-[#2a2a2a] border border-[#4a4a4a] rounded-lg px-3 py-1.5 text-xs text-white"
            >
              <option value={6}>Depth 6 (Fast)</option>
              <option value={8}>Depth 8</option>
              <option value={10}>Depth 10 (Default)</option>
              <option value={12}>Depth 12</option>
              <option value={15}>Depth 15 (Deep)</option>
              <option value={18}>Depth 18 (Max)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-[#4a4a4a] pt-5">
          <div className="space-y-4">
            <span className="text-xs font-bold text-white uppercase tracking-wider block">Audio</span>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                {settings.audioEnabled ? <Volume2 className="w-5 h-5 text-[#606c38]" /> : <VolumeX className="w-5 h-5 text-[#888888]" />}
                <div>
                  <div className="text-xs font-semibold text-white">Sound Effects</div>
                  <div className="text-[10px] text-[#a0a0a0]">Move sounds on the board</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.audioEnabled}
                onChange={(e) => updateSettings({ audioEnabled: e.target.checked })}
                className="w-9 h-5 bg-[#2a2a2a] border border-[#4a4a4a] rounded-full appearance-none checked:bg-[#606c38] relative cursor-pointer outline-none before:content-[''] before:absolute before:w-4 before:h-4 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 checked:before:left-4 before:transition-all"
                id="sound-opt-toggle"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Sliders className="w-5 h-5 text-[#606c38]" />
                <div>
                  <div className="text-xs font-semibold text-white">Volume</div>
                  <div className="text-[10px] text-[#a0a0a0]">{Math.round(settings.audioVolume * 100)}%</div>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.audioVolume * 100)}
                onChange={(e) => updateSettings({ audioVolume: parseInt(e.target.value, 10) / 100 })}
                className="w-24 accent-[#606c38] h-1 bg-[#3d3d3d] rounded-lg cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-4">
            <span className="text-xs font-bold text-white uppercase tracking-wider block">Display</span>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Bell className="w-5 h-5 text-[#606c38]" />
                <div>
                  <div className="text-xs font-semibold text-white">Notifications</div>
                  <div className="text-[10px] text-[#a0a0a0]">Legendary alerts after analysis</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.notificationsEnabled}
                onChange={(e) => updateSettings({ notificationsEnabled: e.target.checked })}
                className="w-9 h-5 bg-[#2a2a2a] border border-[#4a4a4a] rounded-full appearance-none checked:bg-[#606c38] relative cursor-pointer outline-none before:content-[''] before:absolute before:w-4 before:h-4 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 checked:before:left-4 before:transition-all"
                id="notif-opt-toggle"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Smartphone className="w-5 h-5 text-[#606c38]" />
                <div>
                  <div className="text-xs font-semibold text-white">Coordinates</div>
                  <div className="text-[10px] text-[#a0a0a0]">Show a-h, 1-8 labels</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.featureToggles.showCoordinates}
                onChange={(e) => updateSettings({ featureToggles: { ...settings.featureToggles, showCoordinates: e.target.checked } })}
                className="w-9 h-5 bg-[#2a2a2a] border border-[#4a4a4a] rounded-full appearance-none checked:bg-[#606c38] relative cursor-pointer outline-none before:content-[''] before:absolute before:w-4 before:h-4 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 checked:before:left-4 before:transition-all"
                id="coord-opt-toggle"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Activity className="w-5 h-5 text-[#606c38]" />
                <div>
                  <div className="text-xs font-semibold text-white">Auto Analyze</div>
                  <div className="text-[10px] text-[#a0a0a0]">Run engine on game import</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.featureToggles.autoAnalyze}
                onChange={(e) => updateSettings({ featureToggles: { ...settings.featureToggles, autoAnalyze: e.target.checked } })}
                className="w-9 h-5 bg-[#2a2a2a] border border-[#4a4a4a] rounded-full appearance-none checked:bg-[#606c38] relative cursor-pointer outline-none before:content-[''] before:absolute before:w-4 before:h-4 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 checked:before:left-4 before:transition-all"
                id="auto-opt-toggle"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-[#4a4a4a] pt-5">
          <span className="text-xs font-bold text-white uppercase tracking-wider block mb-3">
            <Keyboard className="w-4 h-4 inline mr-1 text-[#bc6c25]" />
            Keyboard Shortcuts
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {shortcutsList.map((s) => (
              <div key={s.key} className="flex items-center justify-between bg-[#2a2a2a] px-3 py-2 rounded-lg border border-[#4a4a4a]">
                <span className="text-xs text-white">{s.label}</span>
                <span className="text-[10px] font-mono text-[#a0a0a0] bg-[#3d3d3d] px-2 py-0.5 rounded">{s.keyDisplay}</span>
              </div>
            ))}
          </div>
          <label className="flex items-center justify-between mt-3">
            <span className="text-xs text-[#a0a0a0]">Enable shortcuts</span>
            <input
              type="checkbox"
              checked={settings.shortcutsEnabled}
              onChange={(e) => updateSettings({ shortcutsEnabled: e.target.checked })}
              className="w-9 h-5 bg-[#2a2a2a] border border-[#4a4a4a] rounded-full appearance-none checked:bg-[#606c38] relative cursor-pointer outline-none before:content-[''] before:absolute before:w-4 before:h-4 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 checked:before:left-4 before:transition-all"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

const shortcutsList = [
  { key: 'flip', label: 'Flip board', keyDisplay: 'F' },
  { key: 'analyze', label: 'Analyze game', keyDisplay: 'A' },
  { key: 'next', label: 'Next move', keyDisplay: '\u2192' },
  { key: 'prev', label: 'Previous move', keyDisplay: '\u2190' },
  { key: 'first', label: 'First move', keyDisplay: 'Home' },
  { key: 'last', label: 'Last move', keyDisplay: 'End' },
  { key: 'shortcuts', label: 'Show shortcuts', keyDisplay: '?' },
];
