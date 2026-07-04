import React, { useState } from 'react';
import { X } from 'lucide-react';
import { THEME_PRESETS } from '../stores/settingsStore';

type ColorField = {
  key: string;
  label: string;
  value: string;
}

type ColorPickerProps = {
  title: string;
  fields: ColorField[];
  onSave(fields: ColorField[]): void;
  onClose(): void;
}

const PRESET_COLORS = [
  '#606c38', '#283618', '#bc6c25', '#dda15e', '#fefae0',
  '#1a1a1a', '#2a2a2a', '#4a4a4a', '#a0a0a0', '#ffffff',
  '#d65d0e', '#fb4934', '#458588', '#83a598', '#689d6a',
  '#8ec07c', '#7c7c7c', '#b0b0b0', '#585858', '#111111',
  '#0f1a24', '#141e14', '#331a00', '#0e2433', '#142814',
  '#ebdbb2', '#dee3e6', '#d5e6d5', '#f0d9b5', '#b58863',
];

export default function ColorPicker({ title, fields, onSave, onClose }: ColorPickerProps) {
  const [localFields, setLocalFields] = useState<ColorField[]>(fields.map(f => ({ ...f })));

  const updateField = (key: string, value: string) => {
    setLocalFields(prev => prev.map(f => f.key === key ? { ...f, value } : f));
  };

  const themePreview = THEME_PRESETS;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => { e.stopPropagation(); }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-[var(--color-text)]">{title}</h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {localFields.map(field => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5 uppercase tracking-wider">
                {field.label}
              </label>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg border border-[var(--color-border)] shrink-0"
                  style={{ backgroundColor: field.value }}
                />
                <input
                  type="text"
                  value={field.value}
                  onChange={e => { updateField(field.key, e.target.value); }}
                  className="flex-1 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] font-mono outline-none focus:border-[var(--color-primary)] transition-colors"
                  placeholder="#hexcolor"
                />
                <input
                  type="color"
                  value={field.value}
                  onChange={e => { updateField(field.key, e.target.value); }}
                  className="w-10 h-10 rounded-lg border border-[var(--color-border)] cursor-pointer shrink-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-lg"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <p className="text-xs font-medium text-[var(--color-text-muted)] mb-2 uppercase tracking-wider">Presets</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(themePreview).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => { setLocalFields(prev => prev.map(f => {
                  const colorKey = f.key as keyof typeof preset.siteColors & keyof typeof preset.boardCustomColors;
                  const val = preset.siteColors[colorKey as keyof typeof preset.siteColors]
                    ?? preset.boardCustomColors[colorKey as keyof typeof preset.boardCustomColors];
                  return val ? { ...f, value: val } : f;
                })); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)] transition-colors capitalize"
              >
                <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: preset.siteColors.primary }} />
                {key}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-[var(--color-border)] flex gap-3">
          <button
            onClick={() => { onSave(localFields); }}
            className="flex-1 bg-[var(--color-primary)] text-white px-4 py-2.5 rounded-lg font-bold text-sm hover:brightness-110 transition-all"
          >
            Apply
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg font-bold text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)] hover:border-[var(--color-text)] transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
