import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import { initAuth } from './stores/authStore';
import { warmupEngine } from './lib/engine/warmup';
import { initTursoSchema } from './lib/turso';
import './index.css';

initAuth();
initTursoSchema();
warmupEngine();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
