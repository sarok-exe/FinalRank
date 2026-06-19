import { ChessGame, EngineLine, STARTING_FEN } from '../../types';
import { getTopEngineLine } from '../engine';
import { AnalysisOptions } from './types';
import { getMoveAccuracy } from './accuracy';
import { classifyMove } from './classify';

export function getGameAnalysis(
  game: ChessGame,
  options?: AnalysisOptions
): ChessGame {
  const startingFen = game.initialPosition || STARTING_FEN;

  const updatedMoves = game.moves.map((move, i) => {
    const prevFen = i === 0 ? startingFen : game.moves[i - 1].fen;
    const prevEngineLines: EngineLine[] = [];
    if (i > 0 && game.moves[i - 1].engineLines) {
      prevEngineLines.push(...game.moves[i - 1].engineLines);
    }
    const currEngineLines = move.engineLines || [];

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

    return { ...move, engineLines: currEngineLines, classification: result.classification, opening: result.opening, accuracy };
  });

  const whiteMoves = updatedMoves.filter(m => m.color === 'w' && m.accuracy !== undefined);
  const blackMoves = updatedMoves.filter(m => m.color === 'b' && m.accuracy !== undefined);

  const whiteAccuracy = whiteMoves.length > 0
    ? Math.round(whiteMoves.reduce((s, m) => s + (m.accuracy || 0), 0) / whiteMoves.length * 10) / 10
    : 0;
  const blackAccuracy = blackMoves.length > 0
    ? Math.round(blackMoves.reduce((s, m) => s + (m.accuracy || 0), 0) / blackMoves.length * 10) / 10
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
