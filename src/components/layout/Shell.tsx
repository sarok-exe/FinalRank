import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Clock,
  User,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Flame,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';

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
  ];

  const handleNavClick = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-[#2a2a2a] text-white flex flex-col font-sans" id="app-shell">
      <header className={`border-b border-[#4a4a4a] bg-[#333333] sticky top-0 z-50 px-6 h-16 flex items-center justify-between ${fullscreenMode ? 'hidden' : ''}`}>
        <div className="flex items-center space-x-6">
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-[#606c38] rounded flex items-center justify-center font-bold text-white">
              FR
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              FinalRank<span className="text-[#bc6c25]">.</span>
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
                      ? 'bg-[#3d3d3d] text-[#606c38]'
                      : 'text-[#a0a0a0]'
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
              className="flex items-center space-x-1.5 bg-[#3d3d3d] px-3 py-1 rounded-full text-xs font-semibold text-[#a0a0a0]"
              title="Daily analysis streak"
              id="streak-badge"
            >
              <Flame className="w-3.5 h-3.5 text-[#bc6c25]" />
              <span>{user.streak} day{user.streak !== 1 ? 's' : ''}</span>
            </div>
          )}

          {user ? (
            <div className="relative">
              <button
                className="flex items-center space-x-2 bg-[#3d3d3d] px-3 py-1.5 rounded-lg border border-[#4a4a4a] text-sm"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                id="user-profile-dropdown"
              >
                <img
                  src={user.avatar}
                  alt={user.username}
                  className="w-6 h-6 rounded-full border border-[#4a4a4a] object-cover"
                  crossOrigin="anonymous"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.username}`;
                  }}
                />
                <span className="max-w-[100px] truncate font-medium">{user.username}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
              </button>

              {userDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-52 rounded-xl bg-[#333333] border border-[#4a4a4a] p-1.5 z-20">
                    <div className="px-3 py-2 border-b border-[#4a4a4a] text-xs text-[#a0a0a0]">
                      Logged in as <p className="font-semibold text-white truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={() => { setUserDropdownOpen(false); logout(); }}
                      className="w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg text-sm text-[#bc6c25] text-left font-medium"
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
              className="bg-[#606c38] text-white px-4 py-1.5 rounded-lg font-semibold text-sm"
              id="guest-login-nav"
            >
              Guest Login
            </button>
          )}

          <button
            className="md:hidden text-[#a0a0a0] p-1"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            id="mobile-menu-toggle"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#4a4a4a] bg-[#333333] p-4 flex flex-col space-y-2 z-40">
          {user && (
            <div className="flex items-center space-x-3 p-2 bg-[#3d3d3d] rounded-xl mb-2">
              <img src={user.avatar} className="w-10 h-10 rounded-full" alt="Avatar" />
              <div>
                <h4 className="font-bold text-sm text-white">{user.username}</h4>
                <p className="text-xs text-[#a0a0a0] truncate">{user.email}</p>
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
                    ? 'bg-[#3d3d3d] text-[#606c38]'
                    : 'text-[#a0a0a0]'
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
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm text-[#bc6c25] text-left"
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

      <footer className={`border-t border-[#4a4a4a] bg-[#333333] py-4 text-center text-xs text-[#666666] flex flex-col sm:flex-row items-center justify-between px-6 max-w-7xl w-full mx-auto ${fullscreenMode ? 'hidden' : ''}`}>
        <p>&copy; 2026 FinalRank. Powered by Stockfish 17 Lite via WebAssembly.</p>
        <div className="flex items-center space-x-4 mt-1 sm:mt-0">
          <span className="text-[#4a4a4a]">|</span>
          <span className="text-[#666666]">Arrow keys to navigate moves</span>
        </div>
      </footer>
    </div>
  );
}
