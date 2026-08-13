import type { ChessGame, EngineLine, EvaluationResult} from '../../types';
import { STARTING_FEN } from '../../types';
import { getTopEngineLine } from '../engine';
import type { AnalysisOptions } from './types';
import { getMoveAccuracy } from './accuracy';
import { classifyMove, isSyntheticZeroLine } from './classify';
import { getWinPercent, getGameAccuracy } from './expectedPoints';
import { getOpeningName } from './utils/opening';

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

  // Contiguous opening-book prefix from the start. Once the game leaves the
  // book, no later move may be classified 'book' even if its position matches
  // the opening database again (transposition back into a known position).
  let inBook = true;

  const updatedMoves = game.moves.map((move, i) => {
    const prevFen = i === 0 ? startingFen : game.moves[i - 1].fen;
    const prevEngineLines: EngineLine[] = [];
    if (i > 0) {
      const lines = game.moves[i - 1].engineLines;
      if (lines) prevEngineLines.push(...lines);
    }
    const currEngineLines = move.engineLines ?? [];

    inBook = inBook && getOpeningName(move.fen) != null;

    if (currEngineLines.length === 0) {
      return { ...move, engineLines: currEngineLines };
    }

    const result = classifyMove(prevFen, prevEngineLines, move.fen, currEngineLines, move.san, {
      ...options,
      isInBook: inBook,
    });

    let accuracy: number | undefined;
    const prevTopLine = getTopEngineLine(prevEngineLines);
    const currTopLine = getTopEngineLine(currEngineLines);
    // Book moves legitimately carry a synthetic cp-0 line; keep their data.
    // Failed positions (synthetic line + no book classification) have no real
    // engine result — don't fabricate an accuracy or evaluation for them.
    const isSynthetic = isSyntheticZeroLine(currTopLine) && result.classification !== 'book';
    if (prevTopLine && currTopLine && !isSynthetic) {
      accuracy = getMoveAccuracy(prevTopLine.evaluation, currTopLine.evaluation, move.color === 'w' ? 'w' : 'b');
    }

    const evaluation = currTopLine && !isSynthetic ? extractEvaluation(currTopLine) : undefined;

    return { ...move, engineLines: currEngineLines, evaluation, classification: result.classification, opening: result.opening, accuracy };
  });

  const whiteMoves = updatedMoves.filter(m => m.color === 'w' && m.accuracy !== undefined);
  const blackMoves = updatedMoves.filter(m => m.color === 'b' && m.accuracy !== undefined);

  // Collect accuracies + winPercents for Lichess-style game accuracy.
  // winPercents used for volatility must be from the player's perspective consistently.
  // Engine eval is always from white's perspective:
  //   after white's move → eval is white's position → getWinPercent(eval, 'w')
  //   after black's move → eval is white's position → getWinPercent(eval, 'b') inverts for black
  const whiteAcc: number[] = [];
  const blackAcc: number[] = [];
  const whiteWp: number[] = [];
  const blackWp: number[] = [];

  for (let i = 0; i < updatedMoves.length; i++) {
    const move = updatedMoves[i];
    if (move.accuracy === undefined) continue;

    const currTopLine = getTopEngineLine(move.engineLines ?? []);
    if (!currTopLine) continue;

    if (move.color === 'w') {
      whiteAcc.push(move.accuracy);
      whiteWp.push(getWinPercent(currTopLine.evaluation, 'w')); // white's perspective
    } else {
      blackAcc.push(move.accuracy);
      blackWp.push(getWinPercent(currTopLine.evaluation, 'b')); // inverted for black's perspective
    }
  }

  const whiteAccuracy = whiteAcc.length > 0
    ? Math.round(getGameAccuracy(whiteAcc, whiteWp) * 10) / 10
    : 0;
  const blackAccuracy = blackAcc.length > 0
    ? Math.round(getGameAccuracy(blackAcc, blackWp) * 10) / 10
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
