import type { EngineLine } from '../../types';
import { createPositionEvaluator } from '../engine/evaluate';
import { getTopEngineLine } from '../engine';
import { classifyMove } from './classify';
import { buildLiveCoachNote, evalToPawns, playerPerspective } from './coach';
import type { CoachNote } from './coach';

export type LiveMoveParams = {
  prevFen: string;
  currFen: string;
  san: string;
  color: 'w' | 'b';
  ply: number;
  moveIndex: number;
  depth: number;
  engineVersion: string;
  cache?: Map<string, EngineLine[]>;
};

async function evaluateFen(
  fen: string,
  depth: number,
  engineVersion: string,
  cache?: Map<string, EngineLine[]>,
): Promise<EngineLine[]> {
  if (cache?.has(fen)) {
    return cache.get(fen)!;
  }
  const evaluator = createPositionEvaluator(fen, { depth, linesCount: 2, engineVersion });
  try {
    const lines = await evaluator.evaluate();
    cache?.set(fen, lines);
    return lines;
  } catch {
    return [];
  }
}

/**
 * Evaluate a single live move and return a CoachNote.
 * Never throws — returns a neutral note on any failure.
 */
export async function evaluateLiveMove(params: LiveMoveParams): Promise<CoachNote> {
  const { prevFen, currFen, san, color, ply, moveIndex, depth, engineVersion, cache } = params;

  try {
    const [prevLines, currLines] = await Promise.all([
      evaluateFen(prevFen, depth, engineVersion, cache),
      evaluateFen(currFen, depth, engineVersion, cache),
    ]);

    const { classification } = classifyMove(prevFen, prevLines, currFen, currLines, san, {
      includeBrilliant: true,
      includeCritical: false,
      includeTheory: false,
    });

    const cls = classification ?? 'best';

    const prevLine = getTopEngineLine(prevLines);
    const currLine = getTopEngineLine(currLines);
    const prevBestEvalWhite = evalToPawns(prevLine);
    const currEvalWhite = evalToPawns(currLine);

    const swing = prevBestEvalWhite != null && currEvalWhite != null
      ? Math.abs(prevBestEvalWhite - currEvalWhite)
      : 0;

    const fromEval = playerPerspective(prevBestEvalWhite, color);
    const toEval = playerPerspective(currEvalWhite, color);

    // Determine bestSan / bestPv: if the played move was the engine's top,
    // show continuation; otherwise recommend the previous position's best.
    const playedIsTop = prevLine?.moves?.[0]?.san === san;
    let bestSan: string | null;
    let bestPv: string[];
    if (playedIsTop) {
      bestSan = san;
      bestPv = (currLine?.moves ?? []).slice(0, 5).map(m => m.san);
    } else {
      bestSan = prevLine?.moves?.[0]?.san ?? null;
      bestPv = (prevLine?.moves ?? []).slice(0, 5).map(m => m.san);
    }

    return buildLiveCoachNote({
      moveIndex,
      ply,
      san,
      color,
      classification: cls,
      swing,
      fromEval,
      toEval,
      bestSan,
      bestPv,
    });
  } catch {
    // Engine or classification failure — return a neutral note so the UI
    // never breaks.
    return buildLiveCoachNote({
      moveIndex,
      ply,
      san,
      color,
      classification: 'best',
      swing: 0,
      fromEval: null,
      toEval: null,
      bestSan: null,
      bestPv: [],
    });
  }
}

/**
 * Build a live CoachNote directly from pre-analyzed move data (no engine
 * evaluation needed).  Used when the game's moves already carry
 * engineLines + classification.
 */
export function buildLiveNoteFromAnalyzedMove(
  move: { san: string; color: 'w' | 'b'; engineLines?: EngineLine[]; classification?: string },
  prevMove: { engineLines?: EngineLine[] },
  moveIndex: number,
): CoachNote {
  const ply = moveIndex + 1;
  const color = move.color;
  const classification = move.classification ?? 'best';

  const prevLine = getTopEngineLine(prevMove.engineLines ?? []);
  const currLine = getTopEngineLine(move.engineLines ?? []);
  const prevBestEvalWhite = evalToPawns(prevLine);
  const currEvalWhite = evalToPawns(currLine);

  const swing = prevBestEvalWhite != null && currEvalWhite != null
    ? Math.abs(prevBestEvalWhite - currEvalWhite)
    : 0;

  const fromEval = playerPerspective(prevBestEvalWhite, color);
  const toEval = playerPerspective(currEvalWhite, color);

  const playedIsTop = prevLine?.moves?.[0]?.san === move.san;
  let bestSan: string | null;
  let bestPv: string[];
  if (playedIsTop) {
    bestSan = move.san;
    bestPv = (currLine?.moves ?? []).slice(0, 5).map(m => m.san);
  } else {
    bestSan = prevLine?.moves?.[0]?.san ?? null;
    bestPv = (prevLine?.moves ?? []).slice(0, 5).map(m => m.san);
  }

  return buildLiveCoachNote({
    moveIndex,
    ply,
    san: move.san,
    color,
    classification,
    swing,
    fromEval,
    toEval,
    bestSan,
    bestPv,
  });
}
