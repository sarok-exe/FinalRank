import { Chess, WHITE } from 'chess.js';
import { EngineLine } from '../../../types';
import { getTopEngineLine, getLineGroupSibling } from '../../engine';
import { RawMove, ExtractedCurrentNode, ExtractedPreviousNode } from '../types';
import { getSubjectiveEvaluation } from '../chess';

type PieceMovement = Pick<RawMove, 'from' | 'to' | 'promotion'>;

function safeMove(fen: string, move: string | PieceMovement) {
  try { return new Chess(fen).move(move as any); } catch { return undefined; }
}

function extractSecondTopMove(fen: string, topLine: EngineLine, engineLines: EngineLine[]) {
  const secondTopLine = getLineGroupSibling(engineLines, topLine, 2);
  const secondTopMoveSan = secondTopLine?.moves.at(0)?.san;
  const secondTopMove = secondTopMoveSan ? safeMove(fen, secondTopMoveSan) : undefined;
  const secondSubjectiveEvaluation = secondTopLine?.evaluation && secondTopMove
    ? getSubjectiveEvaluation(secondTopLine.evaluation, secondTopMove.color)
    : undefined;
  return { secondTopLine, secondTopMove, secondSubjectiveEvaluation };
}

export function extractPreviousStateTreeNode(
  prevFen: string,
  prevEngineLines: EngineLine[],
  playedMoveSan?: string
): ExtractedPreviousNode | null {
  const topLine = getTopEngineLine(prevEngineLines);
  if (!topLine) return null;
  const topMoveSan = topLine.moves.at(0)?.san;
  if (!topMoveSan) return null;
  const topMove = safeMove(prevFen, topMoveSan);
  if (!topMove) return null;

  const playedMove = playedMoveSan ? safeMove(prevFen, playedMoveSan) : undefined;
  const subjectiveEvaluation = getSubjectiveEvaluation(topLine.evaluation, playedMove?.color || WHITE);

  return {
    board: new Chess(prevFen),
    fen: prevFen,
    topLine,
    topMove,
    ...extractSecondTopMove(prevFen, topLine, prevEngineLines),
    evaluation: topLine.evaluation,
    subjectiveEvaluation,
    playedMove,
  };
}

export function extractCurrentStateTreeNode(
  currFen: string,
  currEngineLines: EngineLine[],
  prevFen: string,
  playedMoveSan: string
): ExtractedCurrentNode | null {
  const topLine = getTopEngineLine(currEngineLines);
  if (!topLine) return null;
  const topMoveSan = topLine.moves.at(0)?.san;
  const topMove = topMoveSan ? safeMove(currFen, topMoveSan) : undefined;

  const playedMove = safeMove(prevFen, playedMoveSan);
  if (!playedMove) return null;

  const subjectiveEvaluation = getSubjectiveEvaluation(topLine.evaluation, playedMove.color);

  return {
    board: new Chess(currFen),
    fen: currFen,
    topLine,
    topMove,
    ...extractSecondTopMove(currFen, topLine, currEngineLines),
    evaluation: topLine.evaluation,
    subjectiveEvaluation,
    playedMove,
  };
}
