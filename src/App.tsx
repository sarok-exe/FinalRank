/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Shell from './components/layout/Shell';
import StreakNotification from './components/StreakNotification';
import StreakCelebration from './components/StreakCelebration';

const Analysis = lazy(() => import('./pages/Analysis'));
const Tools = lazy(() => import('./pages/Tools'));
const Profile = lazy(() => import('./pages/Profile'));
const Report = lazy(() => import('./pages/Report'));

function PageLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route path="/" element={<Analysis />} />
            <Route path="/game/:gameId" element={<Analysis />} />
            <Route path="/tools" element={<Tools />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/report" element={<Report />} />
            <Route path="*" element={<Analysis />} />
          </Routes>
        </Suspense>
      </Shell>
      <StreakNotification />
      <StreakCelebration />
    </BrowserRouter>
  );
}

