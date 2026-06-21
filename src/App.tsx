/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Shell from './components/layout/Shell';
import Analysis from './pages/Analysis';
import Tools from './pages/Tools';
import Profile from './pages/Profile';
import Report from './pages/Report';
import StreakNotification from './components/StreakNotification';

export default function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Analysis />} />
          <Route path="/game/:gameId" element={<Analysis />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/report" element={<Report />} />
          <Route path="*" element={<Analysis />} />
        </Routes>
      </Shell>
      <StreakNotification />
    </BrowserRouter>
  );
}

