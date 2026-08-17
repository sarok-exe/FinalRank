import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import { initAuth, useAuthStore } from './stores/authStore';
import { warmupEngine } from './lib/engine/warmup';
import { initTursoSchema, isTursoHealthy } from './lib/turso';
import { precacheAssets } from './lib/assetCache';
import './lib/syncFlush'; // registers the flusher — side-effect import
import { shouldFlush, flushQueue } from './lib/syncQueue';
import './index.css';

initAuth();
// Check streak for any user already in localStorage (guest users without Firebase)
if (useAuthStore.getState().user) {
  useAuthStore.getState().checkStreakOnLogin();
  // Flush any queued writes after sign-in (non-blocking, short delay)
  setTimeout(() => { flushQueue(); }, 2000);
}
// Also flush on auth state changes (user signs in)
useAuthStore.subscribe((state, prev) => {
  if (state.user && !prev.user) {
    setTimeout(() => { flushQueue(); }, 2000);
  }
});
// Periodic check every 5 minutes in case the tab stays open
setInterval(() => {
  if (shouldFlush()) flushQueue();
}, 5 * 60 * 1000);
if (isTursoHealthy()) {
  initTursoSchema();
}
warmupEngine();
// Precache classification icons into the Cache API for offline/fast loads.
precacheAssets().catch(() => {});

// Register Service Worker for static asset caching
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('[SW] Registered:', reg.scope);
    }).catch((err) => {
      console.warn('[SW] Registration failed:', err.message);
    });
  });
}

window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || String(event.reason);
  if (
    msg.includes('cloud eval') ||
    msg.includes('ERR_CONNECTION_CLOSED') ||
    msg.includes('ERR_BLOCKED_BY_CLIENT') ||
    msg.includes('Turso') ||
    msg.includes('aborted') ||
    msg === 'undefined'
  ) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
