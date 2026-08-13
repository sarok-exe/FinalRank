/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense } from 'react';
import type React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import Shell from './components/layout/Shell';
import StreakNotification from './components/StreakNotification';
import StreakCelebration from './components/StreakCelebration';
import ToastContainer from './components/ToastContainer';
import AnalysisOverlay from './components/AnalysisOverlay';

const Analysis = lazy(() => import('./pages/Analysis'));
const Tools = lazy(() => import('./pages/Tools'));
const Profile = lazy(() => import('./pages/Profile'));
const Report = lazy(() => import('./pages/Report'));
const Training = lazy(() => import('./pages/Training'));
const Community = lazy(() => import('./pages/Community'));
const CommunityUser = lazy(() => import('./pages/CommunityUser'));

function PageLoading(): React.ReactElement {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// Page variants for smooth route transitions
const pageVariants = {
  initial: { opacity: 0, y: 6 },
  enter: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

const pageTransition = {
  duration: 0.22,
  ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
};

function getPageKey(pathname: string): string {
  // Strip dynamic segments so that /game/:gameId doesn't re-trigger transitions
  // when the user switches between games on the Analysis page.
  if (pathname.startsWith('/game')) return '/game';
  if (pathname.startsWith('/community')) return '/community';
  if (pathname === '/' || pathname === '') return '/';
  return pathname;
}

function AnimatedRoutes(): React.ReactElement {
  const location = useLocation();
  const pageKey = getPageKey(location.pathname);
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pageKey}
        variants={pageVariants}
        initial="initial"
        animate="enter"
        exit="exit"
        transition={pageTransition}
        style={{ willChange: 'transform, opacity' }}
      >
        <Suspense fallback={<PageLoading />}>
          <Routes location={location}>
            <Route path="/" element={<Analysis />} />
            <Route path="/game/:gameId" element={<Analysis />} />
            <Route path="/tools" element={<Tools />} />
            <Route path="/training" element={<Training />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/report" element={<Report />} />
            <Route path="/community" element={<Community />} />
            <Route path="/community/:userId" element={<CommunityUser />} />
            <Route path="*" element={<Analysis />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App(): React.ReactElement {
  return (
    <BrowserRouter>
      <Shell>
        <AnimatedRoutes />
      </Shell>
      <StreakNotification />
      <StreakCelebration />
      <AnalysisOverlay />
      <ToastContainer />
    </BrowserRouter>
  );
}

