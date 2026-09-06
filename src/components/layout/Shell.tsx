import type React from 'react';
import { useState, useEffect } from 'react';
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
  Brain,
  Trophy,
  Coffee,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';


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
  const [koFiOpen, setKoFiOpen] = useState(false);

  // Close the Ko-fi modal on Escape
  useEffect(() => {
    if (!koFiOpen) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setKoFiOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => { window.removeEventListener('keydown', onKeyDown); };
  }, [koFiOpen]);

  const isActive = (path: string): boolean => location.pathname === path;

  const mainNavItems = [
    { name: 'Analysis', path: '/', icon: BarChart3 },
    { name: 'Training', path: '/training', icon: Brain },
    { name: 'Tools', path: '/tools', icon: Clock },
    { name: 'Community', path: '/community', icon: Trophy },
  ];

  const rightNavItems = [
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
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={active ? 'page' : undefined}
                  className={`group flex items-center space-x-2 px-3 lg:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border ${
                    active
                      ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)] border-[var(--color-primary)]/30'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-background)] border-transparent'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 transition-transform duration-200 ${
                      active
                        ? 'text-[var(--color-primary)]'
                        : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] group-hover:scale-110'
                    }`}
                    strokeWidth={active ? 2.25 : 2}
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <nav className="hidden md:flex space-x-1 ml-auto">
          {rightNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={active ? 'page' : undefined}
                className={`group flex items-center space-x-2 px-3 lg:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border ${
                  active
                    ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)] border-[var(--color-primary)]/30'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-background)] border-transparent'
                }`}
              >
                <Icon
                  className={`w-4 h-4 transition-transform duration-200 ${
                    active
                      ? 'text-[var(--color-primary)]'
                      : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] group-hover:scale-110'
                  }`}
                  strokeWidth={active ? 2.25 : 2}
                />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4 min-w-0 flex-shrink-0">
          <button
            onClick={() => { setKoFiOpen(true); }}
            className="group hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--color-accent)] border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 hover:bg-[var(--color-accent)]/20 hover:border-[var(--color-accent)]/60 transition-all flex-shrink-0"
            id="ko-fi-nav"
            aria-label="Support on Ko-fi"
          >
            <Coffee className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110" />
            <span>Support</span>
          </button>

          {user && (
            <Link
              to="/profile"
              className={`hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                user.chessComUsername != null
                  ? 'bg-green-900/30 text-green-400 border border-green-700/50 hover:bg-green-900/50 hover:border-green-600/60'
                  : 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)]/30 hover:border-[var(--color-primary)]/50'
              }`}
              id="chesscom-link-nav"
            >
              <span className="truncate max-w-[120px]">{user.chessComUsername ?? '+ Link Chess.com'}</span>
            </Link>
          )}

          {user ? (
            <div className="relative flex-shrink-0">
              <button
                className="flex items-center space-x-1.5 sm:space-x-2 bg-[var(--color-surface)] px-2 sm:px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-sm transition-all duration-200 hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-background)]"
                onClick={() => { setUserDropdownOpen(!userDropdownOpen); }}
                id="user-profile-dropdown"
              >
                <img
                  src={user.avatar}
                  alt={user.username}
                  className="w-6 h-6 rounded-full border border-[var(--color-border)] object-cover flex-shrink-0"
                  onError={(e) => {
                    // Idempotent fallback: only swap once so a failing fallback
                    // cannot re-trigger onError and loop forever.
                    const img = e.target as HTMLImageElement;
                    if (!img.src.includes('dicebear.com')) {
                      img.src = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.username}`;
                    }
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
                      className="group w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg text-sm text-[var(--color-accent)] text-left font-medium transition-all duration-200 hover:bg-[var(--color-accent)]/10"
                      id="logout-btn"
                    >
                      <LogOut className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => { auth.loginAsGuest('Guest_Expert'); }}
              className="bg-[var(--color-primary)] text-white px-3 sm:px-4 py-1.5 rounded-lg font-semibold text-xs sm:text-sm flex-shrink-0 transition-all duration-200 hover:brightness-110 hover:shadow-[0_0_16px_-4px_var(--color-primary)]"
              id="guest-login-nav"
            >
              Guest Login
            </button>
          )}

          <button
            className="md:hidden text-[var(--color-text-muted)] p-1.5 -mr-1 flex-shrink-0 rounded-lg transition-all duration-200 hover:text-[var(--color-text)] hover:bg-[var(--color-background)]"
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
              </div>
            </div>
          )}
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={handleNavClick}
                className={`group flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium min-w-0 transition-all duration-200 border ${
                  active
                    ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)] border-[var(--color-primary)]/30'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-background)] border-transparent'
                }`}
              >
                <Icon
                  className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${
                    active
                      ? 'text-[var(--color-primary)]'
                      : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] group-hover:scale-110'
                  }`}
                  strokeWidth={active ? 2.25 : 2}
                />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
          <div className="border-t border-[var(--color-border)]" />
          {rightNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={handleNavClick}
                className={`group flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium min-w-0 transition-all duration-200 border ${
                  active
                    ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)] border-[var(--color-primary)]/30'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-background)] border-transparent'
                }`}
              >
                <Icon
                  className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${
                    active
                      ? 'text-[var(--color-primary)]'
                      : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] group-hover:scale-110'
                  }`}
                  strokeWidth={active ? 2.25 : 2}
                />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
          {user && (
            <button
              onClick={() => { setMobileMenuOpen(false); auth.logout(); }}
              className="group w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm text-[var(--color-accent)] text-left transition-all duration-200 hover:bg-[var(--color-accent)]/10"
            >
              <LogOut className="w-4 h-4 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
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
        className={`border-t border-[var(--color-border)] bg-[var(--color-surface)] py-4 text-center text-xs text-[var(--color-text-muted)] flex flex-col sm:flex-row items-center justify-center px-4 sm:px-6 max-w-7xl w-full mx-auto gap-1 ${fullscreenMode ? 'hidden' : ''}`}
        style={{ paddingBottom: `calc(1rem + var(--safe-bottom))` }}
      >
        <div className="flex items-center space-x-2 sm:space-x-4">
          <span className="text-[var(--color-border)]">|</span>
          <span className="text-[var(--color-text-muted)]">Arrow keys to navigate moves</span>
        </div>
      </footer>

      {koFiOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => { setKoFiOpen(false); }}
          role="dialog"
          aria-modal="true"
          aria-label="Support FinalRank"
        >
          <div
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 max-w-sm w-full mx-4 text-center"
            onClick={e => { e.stopPropagation(); }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Coffee className="w-5 h-5 text-[var(--color-accent)]" />
                Support FinalRank
              </h2>
              <button
                onClick={() => { setKoFiOpen(false); }}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors rounded-lg p-1 hover:bg-[var(--color-background)]"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-6">
              Thank you for supporting FinalRank. Your generosity keeps the site free and open source for everyone.
            </p>

            <a
              href="https://ko-fi.com/sarok_ibnx"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <img
                src="https://ko-fi.com/img/githubbutton_sm.svg"
                alt="Support me on Ko-fi"
                className="h-10 w-auto"
              />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
