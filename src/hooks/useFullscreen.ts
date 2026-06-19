import { useEffect, useCallback } from 'react';
import { useUIStore } from '../stores/uiStore';

export function useFullscreen() {
  const { fullscreenMode, setFullscreenMode } = useUIStore();

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch (err) {
        console.warn('Fullscreen request failed:', err);
      }
    } else {
      try {
        await document.exitFullscreen();
      } catch (err) {
        console.warn('Exit fullscreen failed:', err);
      }
    }
  }, []);

  useEffect(() => {
    const handleChange = () => {
      setFullscreenMode(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, [setFullscreenMode]);

  return { isFullscreen: fullscreenMode, toggleFullscreen };
}
