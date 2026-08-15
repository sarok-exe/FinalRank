import { useEffect, useCallback } from 'react';
import { useUIStore } from '../stores/uiStore';

export function useFullscreen() {
  const { setFullscreenMode, toggleFullscreenMode } = useUIStore();

  const toggleFullscreen = useCallback(async () => {
    const apiSupported =
      typeof document.fullscreenElement !== 'undefined' &&
      typeof document.documentElement.requestFullscreen === 'function';
    if (!apiSupported) {
      // iOS Safari (iPhone) has no Fullscreen API — fall back to CSS scale mode.
      toggleFullscreenMode();
      return;
    }
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        toggleFullscreenMode();
      }
    } else {
      try {
        await document.exitFullscreen();
      } catch {
      }
    }
  }, [toggleFullscreenMode]);

  useEffect(() => {
    const handleChange = () => {
      setFullscreenMode(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => { document.removeEventListener('fullscreenchange', handleChange); };
  }, [setFullscreenMode]);

  return { toggleFullscreen };
}
