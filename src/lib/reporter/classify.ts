import { Chess } from 'chess.js';
import type { EngineLine, MoveClassification } from '../../types';
import { CLASSIFICATION_VALUES } from '../../types';
import { getTopEngineLine } from '../engine';
import type { AnalysisOptions } from './types';
import { extractPreviousStateTreeNode, extractCurrentStateTreeNode } from './utils/extractNode';
import { pointLossClassify } from './classification/pointLoss';
import { considerBrilliantClassification } from './classification/brilliant';
import { considerCriticalClassification } from './classification/critical';
import { getOpeningName } from './utils/opening';

/**
 * Synthetic zero-line shape used by both the opening-book prefill and the
 * engine-failure fill (see `evaluate.ts`): no PV, depth 1, eval 0.0.
 * A non-book position whose top line looks like this has no real engine data.
 */
export function isSyntheticZeroLine(line: EngineLine | undefined): boolean {
  return !!line
    && line.moves.length === 0
    && line.evaluation.type === 'centipawn'
    && line.evaluation.value === 0
    && line.depth <= 1;
}

export function classifyMove(
  prevFen: string,
  prevEngineLines: EngineLine[],
  currFen: string,
  currEngineLines: EngineLine[],
  playedMoveSan: string,
  options?: AnalysisOptions
): { classification?: MoveClassification; opening?: string } {
  const opts: Required<AnalysisOptions> = {
    includeBrilliant: true,
    includeCritical: true,
    includeTheory: true,
    ...options,
  };

  const opening = getOpeningName(currFen);

  if (opts.includeTheory && opening != null) {
    return { classification: 'book', opening };
  }

  const prevBoard = new Chess(prevFen);
  if (prevBoard.moves().length <= 1) return { classification: 'forced' };

  const currBoard = new Chess(currFen);
  if (currBoard.isCheckmate()) return { classification: 'best' };

  const prevTopLine = getTopEngineLine(prevEngineLines);
  const currTopLine = getTopEngineLine(currEngineLines);
  if (!currTopLine || isSyntheticZeroLine(currTopLine)) return {};
  if (!prevTopLine) return { classification: 'best', opening };

  const prev = extractPreviousStateTreeNode(prevFen, prevEngineLines, playedMoveSan);
  const curr = extractCurrentStateTreeNode(currFen, currEngineLines, prevFen, playedMoveSan);

  if (!curr) return {};

  // Previous position has no usable PV (e.g. the book-exit move follows a book
  // zero-line with no move list). Fall back to comparing against the previous
  // top-line evaluation (book baseline = 0.0) instead of dropping the move.
  if (!prev) {
    return { classification: pointLossClassify(prevTopLine.evaluation, curr), opening };
  }

  const topMovePlayed = prev.topMove.san === curr.playedMove.san;
  let classification: MoveClassification | undefined = topMovePlayed ? 'best' : pointLossClassify(prev.evaluation, curr);

  if (opts.includeCritical && topMovePlayed && considerCriticalClassification(prev, curr)) {
    classification = 'critical';
  }

  if (opts.includeBrilliant
    && (CLASSIFICATION_VALUES[classification] || 0) >= CLASSIFICATION_VALUES.best
    && considerBrilliantClassification(prev, curr)
  ) {
    classification = 'brilliant';
  }

  return { classification, opening };
}
