import type { ChessGame, EngineLine } from '../../types';
import { getTopEngineLine } from '../engine';

export type CoachNote = {
  moveIndex: number;        // index into game.moves
  ply: number;              // 1-based half-move number
  san: string;
  color: 'w' | 'b';
  classification: string;   // 'blunder' | 'mistake' | 'inaccuracy' | 'brilliant' | 'best' | 'critical'
  swing: number;            // magnitude in pawns: |prevBestEval(white-persp) - currEval(white-persp)|
  fromEval: number | null;  // player-perspective eval the user COULD have had (engine best at prev position)
  toEval: number | null;    // player-perspective eval AFTER the user's move
  bestSan: string | null;   // engine's recommended move (null when unavailable)
  bestPv: string[];         // short PV (first ~5 SANs) of the engine's best line
  note: string;             // plain-English explanation
};

const ERROR_CLASSIFICATIONS = new Set(['blunder', 'mistake', 'inaccuracy']);
const PRAISE_CLASSIFICATIONS = new Set(['brilliant', 'critical']);
/** Moves where the user's move WAS the engine's top move (drives bestSan/bestPv). */
const TOP_CLASSIFICATIONS = new Set(['best', 'brilliant', 'critical']);
const SKIPPED_CLASSIFICATIONS = new Set(['book', 'forced']);

/** White-perspective eval in pawns; mate lines become ±20 with the mate's sign. */
function evalToPawns(line: EngineLine | undefined): number | null {
  if (!line) return null;
  if (line.evaluation.type === 'centipawn') return line.evaluation.value / 100;
  return line.evaluation.value > 0 ? 20 : -20;
}

/** Flip a white-perspective eval into the player's own perspective. */
function playerPerspective(whitePersp: number | null, color: 'w' | 'b'): number | null {
  if (whitePersp == null) return null;
  return color === 'b' ? -whitePersp : whitePersp;
}

function fmt(n: number): string {
  if (n === 0 || Math.abs(n) < 0.005) return '0';
  return (Math.round(n * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
}

function fmtEval(v: number | null): string {
  if (v == null) return 'n/a';
  return `${v >= 0 ? '+' : ''}${fmt(v)}`;
}

type NoteArgs = {
  ply: number;
  san: string;
  color: 'w' | 'b';
  classification: string;
  swing: number;
  fromEval: number | null;
  toEval: number | null;
  bestSan: string | null;
  bestPv: string[];
};

function buildErrorNote(args: NoteArgs & { allowedMate: boolean; variant: number }): string {
  const { ply, san, classification, toEval, fromEval, swing, bestSan, bestPv, allowedMate, variant } = args;
  const evalPair = `(${fmtEval(toEval)} → ${fmtEval(fromEval)})`;

  const intros = [
    `Move ${ply}: you played ${san} — ${classification} ${evalPair}.`,
    `Move ${ply}: ${san} — ${classification} ${evalPair}.`,
    `Move ${ply}: your move ${san} was a ${classification} ${evalPair}.`,
  ];
  let note = intros[variant % intros.length];

  if (toEval != null && fromEval != null && toEval < fromEval) {
    const costClauses = [
      `This cost you about ${fmt(swing)} points${allowedMate ? ' (allowing mate)' : ''}.`,
      `That gave away roughly ${fmt(swing)} points${allowedMate ? ' and allowed mate' : ''}.`,
    ];
    note += ' ' + costClauses[variant % costClauses.length];
  } else if (allowedMate) {
    note += ' Allowing mate.';
  }

  if (bestSan != null || bestPv.length > 0) {
    const engineClauses = [
      bestSan != null
        ? `The engine's best was ${bestSan}: ${bestPv.join(' ')}.`
        : `The engine's best line: ${bestPv.join(' ')}.`,
      bestSan != null
        ? `Better was ${bestSan}: ${bestPv.join(' ')}.`
        : `The engine preferred ${bestPv.join(' ')}.`,
    ];
    note += ' ' + engineClauses[variant % engineClauses.length];
  }
  return note;
}

function buildPraiseNote(args: NoteArgs & { variant: number }): string {
  const { ply, san, classification, fromEval, bestPv, variant } = args;
  const templates = [
    `Move ${ply}: ${san} — ${classification}! It was the engine's best move (eval ${fmtEval(fromEval)}). Line: ${bestPv.join(' ')}.`,
    `Move ${ply}: ${san} — ${classification}! The engine approves (eval ${fmtEval(fromEval)}). Best line: ${bestPv.join(' ')}.`,
  ];
  return templates[variant % templates.length];
}

function buildSwingNote(args: NoteArgs & { variant: number }): string {
  const { ply, san, classification, swing, toEval, variant } = args;
  if (classification === 'best') {
    const templates = [
      `Move ${ply}: ${san} was the engine's best and swung the game by ${fmt(swing)} points (${fmtEval(toEval)}).`,
      `Move ${ply}: ${san} — the engine's best, swinging the game by ${fmt(swing)} points (${fmtEval(toEval)}).`,
    ];
    return templates[variant % templates.length];
  }
  return `Move ${ply}: ${san} swung the game by ${fmt(swing)} points (${fmtEval(toEval)}).`;
}

export function buildCoachNotes(game: ChessGame): CoachNote[] {
  const notes: CoachNote[] = [];
  const moves = game.moves;

  for (let i = 1; i < moves.length; i++) {
    const move = moves[i];
    const classification = move.classification;
    if (!classification || SKIPPED_CLASSIFICATIONS.has(classification)) continue;

    const prevMove = moves[i - 1];
    const prevEngineLines = prevMove.engineLines ?? [];
    const currEngineLines = move.engineLines ?? [];

    const prevLine = getTopEngineLine(prevEngineLines);
    const currLine = getTopEngineLine(currEngineLines);
    const prevBestEvalWhite = evalToPawns(prevLine);
    const currEvalWhite = evalToPawns(currLine);

    const swing = prevBestEvalWhite != null && currEvalWhite != null
      ? Math.abs(prevBestEvalWhite - currEvalWhite)
      : 0;

    const isError = ERROR_CLASSIFICATIONS.has(classification);
    const isPraise = PRAISE_CLASSIFICATIONS.has(classification);
    const isTop = TOP_CLASSIFICATIONS.has(classification);
    // Plain 'best' moves are only reported when the eval swing is big (>= 3.0).
    if (!isError && !isPraise && swing < 3.0) continue;

    const color = move.color ?? 'w';
    const fromEval = playerPerspective(prevBestEvalWhite, color);
    const toEval = playerPerspective(currEvalWhite, color);

    let bestSan: string | null;
    let bestPv: string[];
    if (!isTop) {
      // User's move was not the engine's top move — recommend the previous
      // position's best line.
      bestSan = prevLine?.moves?.[0]?.san ?? null;
      bestPv = (prevLine?.moves ?? []).slice(0, 5).map(m => m.san);
    } else {
      // User's move WAS the engine's top move — show the continuation.
      bestSan = move.san;
      bestPv = (currLine?.moves ?? []).slice(0, 5).map(m => m.san);
    }

    const ply = i + 1;
    const base: NoteArgs = { ply, san: move.san, color, classification, swing, fromEval, toEval, bestSan, bestPv };

    let note: string;
    if (isError) {
      const allowedMate =
        (currLine?.evaluation.type === 'mate' && toEval != null && toEval < 0)
        || (prevLine?.evaluation.type === 'mate' && fromEval != null && fromEval > 0
          && !(currLine?.evaluation.type === 'mate' && toEval != null && toEval > 0));
      note = buildErrorNote({ ...base, allowedMate, variant: i });
    } else if (isPraise) {
      note = buildPraiseNote({ ...base, variant: i });
    } else {
      note = buildSwingNote({ ...base, variant: i });
    }

    notes.push({ moveIndex: i, ply, san: move.san, color, classification, swing, fromEval, toEval, bestSan, bestPv, note });
  }

  return notes;
}
