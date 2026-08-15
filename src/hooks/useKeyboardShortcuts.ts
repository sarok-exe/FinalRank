import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

export type ShortcutDef = {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  handler(e: KeyboardEvent): void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutDef[]) {
  const shortcutsEnabled = useSettingsStore(s => s.settings.shortcutsEnabled);
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!shortcutsEnabled) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

      for (const s of shortcutsRef.current) {
        const keyMatch = e.key.toLowerCase() === s.key.toLowerCase();
        const ctrlMatch = !!s.ctrl === (e.ctrlKey || e.metaKey);
        const shiftMatch = !!s.shift === e.shiftKey;
        const altMatch = !!s.alt === e.altKey;
        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault();
          s.handler(e);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); };
  }, [shortcutsEnabled]);
}
