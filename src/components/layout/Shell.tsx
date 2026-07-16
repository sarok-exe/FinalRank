import type React from 'react';
import { useState } from 'react';
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
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import StreakFlame from '../StreakFlame';

type ShellProps = {
  readonly children: React.ReactNode;
}

export default function Shell({ children }: ShellProps): React.JSX.Element {
  const auth = useAuthStore();
  const { user } = auth;
  const { fullscreenMode } = useUIStore();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const isActive = (path: string): boolean => location.pathname === path;

  const navItems = [
    { name: 'Analysis', path: '/', icon: BarChart3 },
    { name: 'Tools', path: '/tools', icon: Clock },
    { name: 'Profile', path: '/profile', icon: User },
    { name: 'Report', path: '/report', icon: Flag },
  ];

  const handleNavClick = (): void => { setMobileMenuOpen(false); };

  return (
    <div className="min-h-screen bg-[var(--color-surface)] text-white flex flex-col font-sans" id="app-shell">
      <header
        className={`border-b border-[var(--color-border)] bg-[var(--color-surface)] sticky top-0 z-50 px-3 sm:px-4 md:px-6 h-16 flex items-center justify-between gap-2 min-w-0 w-full max-w-full ${fullscreenMode ? 'hidden' : ''}`}
        style={{ paddingTop: 'var(--safe-top)' }}
      >
        <div className="flex items-center space-x-3 sm:space-x-4 md:space-x-6 min-w-0 flex-shrink-0">
          <Link to="/" className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
            <img src="/logo.webp" alt="FinalRank" className="w-7 h-7 sm:w-8 sm:h-8" />
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap">
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
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center space-x-2 px-3 lg:px-4 py-2 rounded-lg text-sm font-medium ${
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

        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4 min-w-0 flex-shrink-0">
          {user && (
            <div
              className="hidden sm:flex items-center space-x-1 sm:space-x-1.5 bg-[var(--color-surface)] px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold text-[var(--color-text-muted)] flex-shrink-0"
              title="Daily analysis streak"
              id="streak-badge"
            >
              <StreakFlame days={user.streak} size={14} />
              <span className="whitespace-nowrap">{user.streak} day{user.streak !== 1 ? 's' : ''}</span>
            </div>
          )}

          {user && (
            <Link
              to="/profile"
              className={`hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                user.chessComUsername != null
                  ? 'bg-green-900/30 text-green-400 border border-green-700/50'
                  : 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30'
              }`}
              id="chesscom-link-nav"
            >
              <span className="truncate max-w-[120px]">{user.chessComUsername ?? '+ Link Chess.com'}</span>
            </Link>
          )}

          {user ? (
            <div className="relative flex-shrink-0">
              <button
                className="flex items-center space-x-1.5 sm:space-x-2 bg-[var(--color-surface)] px-2 sm:px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-sm"
                onClick={() => { setUserDropdownOpen(!userDropdownOpen); }}
                id="user-profile-dropdown"
              >
                <img
                  src={user.avatar}
                  alt={user.username}
                  className="w-6 h-6 rounded-full border border-[var(--color-border)] object-cover flex-shrink-0"
                  crossOrigin="anonymous"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.username}`;
                  }}
                />
                <span className="hidden sm:inline max-w-[80px] md:max-w-[100px] truncate font-medium">{user.username}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)] flex-shrink-0" />
              </button>

              {userDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => { setUserDropdownOpen(false); }} />
                  <div className="absolute right-0 mt-2 w-52 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-1.5 z-20">
                    <div className="px-3 py-2 border-b border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
                      Logged in as <p className="font-semibold text-white truncate">
                        {user.email ? `${user.email.slice(0, 3)}...${user.email.split('@')[1] || ''}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => { setUserDropdownOpen(false); auth.logout(); }}
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
              onClick={() => { auth.loginAsGuest('Guest_Expert'); }}
              className="bg-[var(--color-primary)] text-white px-3 sm:px-4 py-1.5 rounded-lg font-semibold text-xs sm:text-sm flex-shrink-0"
              id="guest-login-nav"
            >
              Guest Login
            </button>
          )}

          <button
            className="md:hidden text-[var(--color-text-muted)] p-1.5 -mr-1 flex-shrink-0"
            onClick={() => { setMobileMenuOpen(!mobileMenuOpen); }}
            id="mobile-menu-toggle"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div
          className="md:hidden border-b border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex flex-col space-y-2 z-40 max-w-full overflow-x-hidden"
          style={{ paddingTop: `calc(1rem + var(--safe-top))` }}
        >
          {user && (
            <div className="flex items-center space-x-3 p-2 bg-[var(--color-surface)] rounded-xl mb-2 min-w-0">
              <img src={user.avatar} className="w-10 h-10 rounded-full flex-shrink-0" alt="Avatar" />
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-sm text-white truncate">{user.username}</h4>
                <p className="text-xs text-[var(--color-text-muted)] truncate">{user.email ? `${user.email.slice(0, 3)}...${user.email.split('@')[1] || ''}` : ''}</p>
                <div className="flex items-center space-x-1.5 mt-1">
                  <StreakFlame days={user.streak} size={12} />
                  <span className="text-[10px] text-[var(--color-text-muted)] font-semibold">{user.streak} day{user.streak !== 1 ? 's' : ''} streak</span>
                </div>
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
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium min-w-0 ${
                  active
                    ? 'bg-[var(--color-surface)] text-[var(--color-primary)]'
                    : 'text-[var(--color-text-muted)]'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
          {user && (
            <button
              onClick={() => { setMobileMenuOpen(false); auth.logout(); }}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm text-[var(--color-accent)] text-left"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              <span>Log Out</span>
            </button>
          )}
        </div>
      )}

      <main
        className={`flex-1 w-full mx-auto p-3 sm:p-4 md:p-6 min-w-0 ${fullscreenMode ? 'max-w-full' : 'max-w-7xl'}`}
        id="main-stage"
        style={{ paddingBottom: `calc(1rem + var(--safe-bottom))` }}
      >
        {children}
      </main>

      <footer
        className={`border-t border-[var(--color-border)] bg-[var(--color-surface)] py-4 text-center text-xs text-[var(--color-text-muted)] flex flex-col sm:flex-row items-center justify-between px-4 sm:px-6 max-w-7xl w-full mx-auto gap-1 ${fullscreenMode ? 'hidden' : ''}`}
        style={{ paddingBottom: `calc(1rem + var(--safe-bottom))` }}
      >
        <p>&copy; 2026 FinalRank.</p>
        <div className="flex items-center space-x-2 sm:space-x-4">
          <span className="text-[var(--color-border)]">|</span>
          <span className="text-[var(--color-text-muted)]">Arrow keys to navigate moves</span>
        </div>
      </footer>
    </div>
  );
}
