import type { ChessGame, EngineLine, EvaluationResult} from '../../types';
import { STARTING_FEN } from '../../types';
import { getTopEngineLine } from '../engine';
import type { AnalysisOptions } from './types';
import { getMoveAccuracy } from './accuracy';
import { classifyMove } from './classify';

function extractEvaluation(line: EngineLine): EvaluationResult {
  let score: number;
  if (line.evaluation.type === 'centipawn') {
    score = line.evaluation.value / 100;
  } else if (line.evaluation.value > 0) {
    score = 10;
  } else {
    score = -10;
  }
  return {
    score,
    isMate: line.evaluation.type === 'mate',
    mateIn: line.evaluation.type === 'mate' ? line.evaluation.value : undefined,
    depthReached: line.depth,
    bestMove: line.moves[0]?.san || line.moves[0]?.uci,
    pv: line.moves.slice(0, 6).map(m => m.san || m.uci),
  };
}

export function getGameAnalysis(
  game: ChessGame,
  options?: AnalysisOptions
): ChessGame {
  const startingFen = game.initialPosition ?? STARTING_FEN;

  const updatedMoves = game.moves.map((move, i) => {
    const prevFen = i === 0 ? startingFen : game.moves[i - 1].fen;
    const prevEngineLines: EngineLine[] = [];
    if (i > 0) {
      const lines = game.moves[i - 1].engineLines;
      if (lines) prevEngineLines.push(...lines);
    }
    const currEngineLines = move.engineLines ?? [];

    if (currEngineLines.length === 0) {
      return { ...move, engineLines: currEngineLines };
    }

    const result = classifyMove(prevFen, prevEngineLines, move.fen, currEngineLines, move.san, options);

    let accuracy: number | undefined;
    const prevTopLine = getTopEngineLine(prevEngineLines);
    const currTopLine = getTopEngineLine(currEngineLines);
    if (prevTopLine && currTopLine) {
      accuracy = getMoveAccuracy(prevTopLine.evaluation, currTopLine.evaluation, move.color === 'w' ? 'w' : 'b');
    }

    const evaluation = currTopLine ? extractEvaluation(currTopLine) : undefined;

    return { ...move, engineLines: currEngineLines, evaluation, classification: result.classification, opening: result.opening, accuracy };
  });

  const whiteMoves = updatedMoves.filter(m => m.color === 'w' && m.accuracy !== undefined);
  const blackMoves = updatedMoves.filter(m => m.color === 'b' && m.accuracy !== undefined);

  const whiteAccuracy = whiteMoves.length > 0
    ? Math.round(whiteMoves.reduce((s, m) => s + (m.accuracy ?? 0), 0) / whiteMoves.length * 10) / 10
    : 0;
  const blackAccuracy = blackMoves.length > 0
    ? Math.round(blackMoves.reduce((s, m) => s + (m.accuracy ?? 0), 0) / blackMoves.length * 10) / 10
    : 0;

  const whiteCounts: Record<string, number> = {};
  const blackCounts: Record<string, number> = {};
  for (const m of updatedMoves) {
    if (!m.classification) continue;
    if (m.color === 'w') whiteCounts[m.classification] = (whiteCounts[m.classification] || 0) + 1;
    else blackCounts[m.classification] = (blackCounts[m.classification] || 0) + 1;
  }

  return {
    ...game,
    moves: updatedMoves,
    accuracy: { white: whiteAccuracy, black: blackAccuracy },
    classificationCounts: { white: whiteCounts, black: blackCounts },
    analyzedAt: new Date().toISOString(),
  };
}
