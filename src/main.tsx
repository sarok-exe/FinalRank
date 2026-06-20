import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import { initAuth } from './stores/authStore';
import { warmupEngine } from './lib/engine/warmup';
import { initTursoSchema, isTursoHealthy } from './lib/turso';
import './index.css';

initAuth();
if (isTursoHealthy()) {
  initTursoSchema();
}
warmupEngine();

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
