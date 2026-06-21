import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Clock,
  User,
  Flag,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Flame,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import StreakFlame from '../StreakFlame';

interface ShellProps {
  children: React.ReactNode;
}

export default function Shell({ children }: ShellProps) {
  const { user, logout, loginAsGuest } = useAuthStore();
  const { fullscreenMode, focusMode } = useUIStore();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { name: 'Analysis', path: '/', icon: BarChart3 },
    { name: 'Tools', path: '/tools', icon: Clock },
    { name: 'Profile', path: '/profile', icon: User },
    { name: 'Report', path: '/report', icon: Flag },
  ];

  const handleNavClick = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-[var(--color-surface)] text-white flex flex-col font-sans" id="app-shell">
      <header className={`border-b border-[var(--color-border)] bg-[var(--color-surface)] sticky top-0 z-50 px-6 h-16 flex items-center justify-between max-w-7xl mx-auto overflow-hidden ${fullscreenMode ? 'hidden' : ''}`}>
        <div className="flex items-center space-x-6">
          <Link to="/" className="flex items-center space-x-3">
            <img src="/logo.webp" alt="FinalRank" className="w-8 h-8" />
            <h1 className="text-xl font-bold tracking-tight text-white">
              FinalRank<span className="text-[var(--color-accent)]">.</span>
            </h1>
          </Link>

          <nav className="hidden md:flex space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium ${
                    active
                      ? 'bg-[var(--color-surface)] text-[var(--color-primary)]'
                      : 'text-[var(--color-text-muted)]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          {user && (
            <div
              className="flex items-center space-x-1.5 bg-[var(--color-surface)] px-3 py-1 rounded-full text-xs font-semibold text-[var(--color-text-muted)]"
              title="Daily analysis streak"
              id="streak-badge"
            >
              <StreakFlame days={user.streak} size={14} />
              <span>{user.streak} day{user.streak !== 1 ? 's' : ''}</span>
            </div>
          )}

          {user && (
            <Link
              to="/profile"
              className={`hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                user.chessComUsername
                  ? 'bg-green-900/30 text-green-400 border border-green-700/50'
                  : 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30'
              }`}
              id="chesscom-link-nav"
            >
              <span>{user.chessComUsername ? user.chessComUsername : '+ Link Chess.com'}</span>
            </Link>
          )}

          {user ? (
            <div className="relative">
              <button
                className="flex items-center space-x-2 bg-[var(--color-surface)] px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-sm"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                id="user-profile-dropdown"
              >
                <img
                  src={user.avatar}
                  alt={user.username}
                  className="w-6 h-6 rounded-full border border-[var(--color-border)] object-cover"
                  crossOrigin="anonymous"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.username}`;
                  }}
                />
                <span className="max-w-[100px] truncate font-medium">{user.username}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
              </button>

              {userDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-52 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-1.5 z-20">
                    <div className="px-3 py-2 border-b border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
                      Logged in as <p className="font-semibold text-white truncate">
                        {user.email ? `${user.email.slice(0, 3)}...${user.email.split('@')[1] || ''}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => { setUserDropdownOpen(false); logout(); }}
                      className="w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg text-sm text-[var(--color-accent)] text-left font-medium"
                      id="logout-btn"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => loginAsGuest('Guest_Expert')}
              className="bg-[var(--color-primary)] text-white px-4 py-1.5 rounded-lg font-semibold text-sm"
              id="guest-login-nav"
            >
              Guest Login
            </button>
          )}

          <button
            className="md:hidden text-[var(--color-text-muted)] p-1"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            id="mobile-menu-toggle"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex flex-col space-y-2 z-40">
          {user && (
            <div className="flex items-center space-x-3 p-2 bg-[var(--color-surface)] rounded-xl mb-2">
              <img src={user.avatar} className="w-10 h-10 rounded-full" alt="Avatar" />
              <div>
                <h4 className="font-bold text-sm text-white">{user.username}</h4>
                <p className="text-xs text-[var(--color-text-muted)] truncate">{user.email}</p>
              </div>
            </div>
          )}
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={handleNavClick}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium ${
                  active
                    ? 'bg-[var(--color-surface)] text-[var(--color-primary)]'
                    : 'text-[var(--color-text-muted)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
          {user && (
            <button
              onClick={() => { setMobileMenuOpen(false); logout(); }}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm text-[var(--color-accent)] text-left"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          )}
        </div>
      )}

      <main className={`flex-1 w-full mx-auto p-4 md:p-6 ${fullscreenMode ? 'max-w-full' : 'max-w-7xl'}`} id="main-stage">
        {children}
      </main>

      <footer className={`border-t border-[var(--color-border)] bg-[var(--color-surface)] py-4 text-center text-xs text-[var(--color-text-muted)] flex flex-col sm:flex-row items-center justify-between px-6 max-w-7xl w-full mx-auto ${fullscreenMode ? 'hidden' : ''}`}>
        <p>&copy; 2026 FinalRank.</p>
        <div className="flex items-center space-x-4 mt-1 sm:mt-0">
          <span className="text-[var(--color-border)]">|</span>
          <span className="text-[var(--color-text-muted)]">Arrow keys to navigate moves</span>
        </div>
      </footer>
    </div>
  );
}
