import { Chess } from 'chess.js';
import { EngineLine, CLASSIFICATION_VALUES } from '../../types';
import { getTopEngineLine } from '../engine';
import { AnalysisOptions } from './types';
import { extractPreviousStateTreeNode, extractCurrentStateTreeNode } from './utils/extractNode';
import { pointLossClassify } from './classification/pointLoss';
import { considerBrilliantClassification } from './classification/brilliant';
import { considerCriticalClassification } from './classification/critical';
import { getOpeningName } from './utils/opening';

export function classifyMove(
  prevFen: string,
  prevEngineLines: EngineLine[],
  currFen: string,
  currEngineLines: EngineLine[],
  playedMoveSan: string,
  options?: AnalysisOptions
): { classification?: string; opening?: string } {
  const opts: Required<AnalysisOptions> = {
    includeBrilliant: true,
    includeCritical: true,
    includeTheory: true,
    ...options,
  };

  const opening = getOpeningName(currFen);

  if (opts.includeTheory && opening) {
    return { classification: 'book', opening };
  }

  const prevBoard = new Chess(prevFen);
  if (prevBoard.moves().length <= 1) return { classification: 'forced' };

  const currBoard = new Chess(currFen);
  if (currBoard.isCheckmate()) return { classification: 'best' };

  const prevTopLine = getTopEngineLine(prevEngineLines);
  const currTopLine = getTopEngineLine(currEngineLines);
  if (!prevTopLine || !currTopLine) return {};

  const prev = extractPreviousStateTreeNode(prevFen, prevEngineLines, playedMoveSan);
  const curr = extractCurrentStateTreeNode(currFen, currEngineLines, prevFen, playedMoveSan);

  if (!prev || !curr) return {};

  const topMovePlayed = prev.topMove.san === curr.playedMove.san;
  let classification = topMovePlayed ? 'best' : pointLossClassify(prev, curr);

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
