import type React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import type { CoachNote } from '../lib/reporter/coach';
import {
  classificationImages,
  classificationNames,
  classificationBadgeStyles,
} from '../constants/classifications';

type CoachPanelProps = {
  notes: CoachNote[];
  activeMoveIndex: number;          // which move the user is currently viewing (-1 = none)
  onTryMove: (note: CoachNote) => void;
};

export default function CoachPanel({ notes, activeMoveIndex, onTryMove }: CoachPanelProps): React.ReactElement {
  return (
    <div
      className="fade-in flex-shrink-0 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 flex flex-col overflow-hidden max-h-[min(420px,55vh)] min-h-[220px]"
      id="coach-panel"
    >
      <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
        <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
        <span>Coach</span>
        {notes.length > 0 && (
          <span className="ml-auto text-[10px] font-bold text-[var(--color-text-muted)]">
            {notes.length} lesson{notes.length === 1 ? '' : 's'}
          </span>
        )}
      </h3>

      <div
        className="flex-1 overflow-y-auto pr-1 space-y-1.5 flex flex-col scrollbar-thin scrollbar-track-[#2a2a2a] scrollbar-thumb-[#4a4a4a] overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {notes.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-2 py-8 text-xs text-[var(--color-text-muted)] italic text-center leading-relaxed">
            Coach shows lessons for your biggest mistakes once analysis is complete.
          </div>
        ) : (
          notes.map((note) => {
            const isActive = note.moveIndex === activeMoveIndex;
            const badge = classificationBadgeStyles[note.classification];
            const imgSrc = classificationImages[note.classification];
            const canTry = Boolean(note.bestSan) && note.bestSan !== note.san;
            const turn = Math.floor((note.ply - 1) / 2) + 1;
            const moveLabel = note.color === 'w' ? `${turn}.` : `${turn}...`;

            const rowClasses = `block w-full text-left rounded-lg px-2.5 py-2 border-l-2 transition-colors ${
              isActive
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                : canTry
                  ? 'border-transparent hover:bg-[var(--color-background)]/70 hover:border-[var(--color-accent)]/40 cursor-pointer'
                  : 'border-transparent'
            }`;

            const rowContent = (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-[var(--color-text-muted)] shrink-0">
                    {moveLabel}
                  </span>
                  <span className="text-sm font-mono font-bold text-white shrink-0">{note.san}</span>
                  {badge && (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded shrink-0"
                      style={{ color: badge.color, backgroundColor: badge.bg, border: `1px solid ${badge.border}` }}
                    >
                      <img src={imgSrc} alt="" width={15} height={15} className="inline-block opacity-90" />
                      <span className="text-[10px] font-bold uppercase tracking-wide">
                        {classificationNames[note.classification] ?? note.classification}
                      </span>
                    </span>
                  )}
                  {canTry && (
                    <span className="ml-auto shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-[var(--color-accent)]/70">
                      Try {note.bestSan}
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-sm text-[var(--color-text-muted)] leading-relaxed">{note.note}</p>
              </>
            );

            return canTry ? (
              <button
                key={note.moveIndex}
                type="button"
                onClick={() => { onTryMove(note); }}
                className={rowClasses}
                title={`Play ${note.bestSan} instead`}
              >
                {rowContent}
              </button>
            ) : (
              <div key={note.moveIndex} className={rowClasses}>
                {rowContent}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
