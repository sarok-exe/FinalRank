import type React from 'react';
import { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import type { CoachNote } from '../lib/reporter/coach';
import {
  classificationImages,
  classificationNames,
  classificationBadgeStyles,
} from '../constants/classifications';

type CoachPanelProps = {
  notes: CoachNote[];
  liveNote: CoachNote | null;
  liveEvaluating: boolean;
  activeMoveIndex: number;
  onTryMove(note: CoachNote): void;
  onTryLiveMove(): void;
};

/** Mood glow colors mapped to classification groups. */
const MOOD_GLOW: Record<string, string> = {
  brilliant: '#4ade80',
  critical: '#4ade80',
  best: '#4ade80',
  excellent: '#4ade80',
  okay: '#97af8b',
  good: '#97af8b',
  book: '#97af8b',
  forced: '#97af8b',
  inaccuracy: '#facc15',
  mistake: '#fb923c',
  blunder: '#f87171',
};

function getMoodColor(classification: string | undefined): string | null {
  if (classification == null || classification === '') return null;
  return MOOD_GLOW[classification] ?? null;
}

export default function CoachPanel({
  notes,
  liveNote,
  liveEvaluating,
  activeMoveIndex,
  onTryMove,
  onTryLiveMove,
}: CoachPanelProps): React.ReactElement {
  const moodColor = getMoodColor(liveNote?.classification);

  // Subtle thinking pulse driven by liveEvaluating.
  const [pulseOpacity, setPulseOpacity] = useState(0.35);
  useEffect(() => {
    if (!liveEvaluating) {
      setPulseOpacity(0.35);
      return;
    }
    let frame = 0;
    const id = setInterval(() => {
      frame += 1;
      setPulseOpacity(0.2 + Math.abs(Math.sin(frame * 0.12)) * 0.45);
    }, 60);
    return () => { clearInterval(id); };
  }, [liveEvaluating]);

  const avatarGlow = liveEvaluating
    ? `0 0 ${12 + pulseOpacity * 10}px ${pulseOpacity * 8}px rgba(148,163,184,${0.25 + pulseOpacity * 0.35}), 0 0 ${4 + pulseOpacity * 6}px ${pulseOpacity * 3}px rgba(148,163,184,${0.15 + pulseOpacity * 0.25})`
    : moodColor != null
      ? `0 0 12px 4px ${moodColor}30, 0 0 4px 2px ${moodColor}20`
      : 'none';

  const avatarBorderColor = liveEvaluating
    ? `rgba(148,163,184,${0.3 + pulseOpacity * 0.5})`
    : moodColor ?? 'var(--color-border)';

  const liveBadge = liveNote ? classificationBadgeStyles[liveNote.classification] : null;
  const liveImgSrc = liveNote ? classificationImages[liveNote.classification] : null;
  const liveCanTry = liveNote != null && Boolean(liveNote.bestSan) && liveNote.bestSan !== liveNote.san;

  return (
    <div
      className="fade-in flex-shrink-0 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 flex flex-col overflow-hidden max-h-[min(420px,55vh)] min-h-[220px]"
      id="coach-panel"
    >
      <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2.5 flex items-center space-x-2.5">
        <div
          className="relative w-[38px] h-[38px] rounded-full overflow-hidden shrink-0 border-2 transition-all duration-500"
          style={{
            borderColor: avatarBorderColor,
            boxShadow: avatarGlow,
          }}
        >
          <img
            src="/img/Coach/kiruma.png"
            alt="Coach"
            className="w-full h-full object-cover"
            style={{ objectPosition: 'right center' }}
            draggable={false}
          />
          {liveEvaluating && (
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background: `radial-gradient(circle, rgba(148,163,184,${pulseOpacity * 0.18}) 0%, transparent 70%)`,
              }}
            />
          )}
        </div>
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
        {/* Live feedback card */}
        {liveEvaluating && liveNote == null && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2.5 flex items-center gap-2.5 animate-pulse">
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-text-muted)]/40 shrink-0" />
            <span className="text-xs text-[var(--color-text-muted)] italic">Evaluating your move...</span>
          </div>
        )}

        {liveNote != null && (
          <div className="rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/[0.06] px-3 py-2.5 space-y-2">
            <div className="flex items-center gap-2">
              {liveBadge && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded shrink-0"
                  style={{ color: liveBadge.color, backgroundColor: liveBadge.bg, border: `1px solid ${liveBadge.border}` }}
                >
                  {liveImgSrc != null && (
                    <img src={liveImgSrc} alt="" width={15} height={15} className="inline-block opacity-90" />
                  )}
                  <span className="text-[10px] font-bold uppercase tracking-wide">
                    {classificationNames[liveNote.classification] ?? liveNote.classification}
                  </span>
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--color-text)] leading-relaxed">{liveNote.note}</p>
            {liveCanTry && (
              <button
                type="button"
                onClick={onTryLiveMove}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white bg-[var(--color-accent)] px-2.5 py-1 rounded-lg hover:brightness-110 hover:shadow-[0_0_12px_-4px_var(--color-accent)] transition-all duration-200"
              >
                Try {liveNote.bestSan}
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Existing notes list */}
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
