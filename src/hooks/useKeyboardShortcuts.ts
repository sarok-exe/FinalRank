import { useEffect, useCallback } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

export interface ShortcutDef {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  handler: (e: KeyboardEvent) => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutDef[]) {
  const shortcutsEnabled = useSettingsStore(s => s.settings.shortcutsEnabled);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!shortcutsEnabled) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

    for (const s of shortcuts) {
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
  }, [shortcuts, shortcutsEnabled]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export const DEFAULT_SHORTCUTS: { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean; description: string }[] = [
  { key: 'f', description: 'Flip board' },
  { key: 'a', description: 'Analyze game' },
  { key: 'ArrowLeft', description: 'Previous move' },
  { key: 'ArrowRight', description: 'Next move' },
  { key: 'Home', description: 'First move' },
  { key: 'End', description: 'Last move' },
  { key: '?', description: 'Show keyboard shortcuts' },
];
