import { useEffect, useCallback } from 'react';
import { useUIStore } from '../stores/uiStore';

export function useFullscreen() {
  const { fullscreenMode, setFullscreenMode } = useUIStore();

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
      }
    } else {
      try {
        await document.exitFullscreen();
      } catch {
      }
    }
  }, []);

  useEffect(() => {
    const handleChange = () => {
      setFullscreenMode(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => { document.removeEventListener('fullscreenchange', handleChange); };
  }, [setFullscreenMode]);

  return { isFullscreen: fullscreenMode, toggleFullscreen };
}
