import { Chessboard } from 'react-chessboard';
import { Undo2, RotateCcw } from 'lucide-react';
import type { ChessGame } from '../../types';
import GameLibrary from './GameLibrary';
import { classificationBadgeStyles } from '../../constants/classifications';

export type HomeScreenProps = {
  games: ChessGame[];
  filteredGames: ChessGame[];
  loading: boolean;
  importMode: 'chesscom' | 'lichess' | 'pgn';
  onImportModeChange(mode: 'chesscom' | 'lichess' | 'pgn'): void;
  usernameInput: string;
  onUsernameInputChange(v: string): void;
  onFetchGames(): void;
  onPgnSubmit(pgn: string): void;
  searchQuery: string;
  onSearchQueryChange(v: string): void;
  dateRange: 'all' | 'today' | 'week' | 'month';
  onDateRangeChange(r: 'all' | 'today' | 'week' | 'month'): void;
  onPickGame(gameId: string): void;
  analyzedGameIds: Set<string>;
  savedGameIds: Set<string>;
  linkedGames: ChessGame[];
  linkedLoading: boolean;
  onRefreshLinked(): void;
  boardFen: string;
  onBoardMove(from: string, to: string, promotion?: string): void;
  boardEvaluating: boolean;
  boardEval: { score: number; isMate: boolean } | null;
  boardClassification: string | null;
  boardNote: string | null;
  boardHistory: string[];
  onUndoBoardMove(): void;
  onResetBoard(): void;
};

export default function HomeScreen(props: HomeScreenProps) {
  const {
    games,
    filteredGames,
    loading,
    importMode,
    onImportModeChange,
    usernameInput,
    onUsernameInputChange,
    onFetchGames,
    onPgnSubmit,
    searchQuery,
    onSearchQueryChange,
    dateRange,
    onDateRangeChange,
    onPickGame,
    analyzedGameIds,
    savedGameIds,
    linkedGames,
    linkedLoading,
    onRefreshLinked,
    boardFen,
    onBoardMove,
    boardEvaluating,
    boardEval,
    boardClassification,
    boardNote,
    boardHistory,
    onUndoBoardMove,
    onResetBoard,
  } = props;

  // ── Eval bar: white share, linear mapping consistent with the app's EvalBar ──
  const whitePct = boardEval && !boardEval.isMate
    ? Math.max(5, Math.min(95, 50 + boardEval.score * 5))
    : 50;

  const evalLabel = boardEval
    ? boardEval.isMate
      ? 'M'
      : boardEval.score > 0
        ? `+${boardEval.score.toFixed(1)}`
        : boardEval.score.toFixed(1)
    : '';

  const classificationStyle = boardClassification
    ? classificationBadgeStyles[boardClassification]
    : undefined;

  return (
    <div
      className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-6 items-start"
      id="home-screen"
    >
      {/* ═══════════════ LEFT — free-play board ═══════════════ */}
      <section className="min-w-0">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5">
          {/* Board + eval bar */}
          <div className="flex gap-3 items-stretch">
            <div className="flex-1 min-w-0">
              <div className="relative aspect-square w-full min-w-0">
                <Chessboard
                  options={{
                    id: 'finalrank-home',
                    position: boardFen,
                    boardOrientation: 'white',
                    boardStyle: {
                      border: '4px solid var(--color-surface)',
                      borderRadius: '8px',
                      overflow: 'visible',
                    },
                    lightSquareStyle: { backgroundColor: 'var(--board-light)' },
                    darkSquareStyle: { backgroundColor: 'var(--board-dark)' },
                    showNotation: true,
                    allowDragging: true,
                    showAnimations: true,
                    animationDurationInMs: 300,
                    onPieceDrop: ({ sourceSquare, targetSquare }) => {
                      if (!targetSquare || sourceSquare === targetSquare) return false;
                      onBoardMove(sourceSquare, targetSquare, undefined);
                      return true;
                    },
                  }}
                />
              </div>
            </div>

            {/* Eval bar — slim vertical column beside the board */}
            <div className="w-3.5 sm:w-4 flex-shrink-0 flex flex-col items-center gap-1.5">
              <div
                className={`flex-1 w-full rounded-full overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col ${
                  boardEvaluating && !boardEval ? 'animate-pulse' : ''
                }`}
              >
                <div
                  className="bg-white transition-all duration-300 ease-out"
                  style={{ height: `${whitePct}%` }}
                />
                <div className="flex-1" />
              </div>
              {evalLabel && (
                <span className="text-[9px] font-mono font-bold text-[var(--color-text-muted)] leading-none select-none">
                  {evalLabel}
                </span>
              )}
            </div>
          </div>

          {/* Move history — compact SAN chips */}
          <div className="mt-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
              Moves
            </div>
            {boardHistory.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)] italic">
                Make a move to start.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {boardHistory.map((san, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 text-xs font-mono font-bold text-white"
                  >
                    {i % 2 === 0 && (
                      <span className="text-[10px] font-sans font-bold text-[var(--color-text-muted)]">
                        {Math.floor(i / 2) + 1}.
                      </span>
                    )}
                    {san}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Classification badge + coach note */}
          {(classificationStyle || boardNote) && (
            <div className="mt-4 flex items-start gap-2.5">
              {classificationStyle && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded shrink-0 mt-px"
                  style={{
                    color: classificationStyle.color,
                    backgroundColor: classificationStyle.bg,
                    border: `1px solid ${classificationStyle.border}`,
                  }}
                >
                  {classificationStyle.label}
                </span>
              )}
              {boardNote && (
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                  {boardNote}
                </p>
              )}
            </div>
          )}

          {/* Undo / Reset controls */}
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={onUndoBoardMove}
              disabled={boardHistory.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-primary)]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Undo2 className="w-4 h-4" />
              Undo
            </button>
            <button
              onClick={onResetBoard}
              disabled={boardHistory.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-primary)]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════ RIGHT — game library ═══════════════ */}
      <section className="min-w-0">
        <GameLibrary
          games={games}
          filteredGames={filteredGames}
          loading={loading}
          importMode={importMode}
          onImportModeChange={onImportModeChange}
          usernameInput={usernameInput}
          onUsernameInputChange={onUsernameInputChange}
          onFetchGames={onFetchGames}
          onPgnSubmit={onPgnSubmit}
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange}
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
          onPickGame={onPickGame}
          analyzedGameIds={analyzedGameIds}
          savedGameIds={savedGameIds}
          linkedGames={linkedGames}
          linkedLoading={linkedLoading}
          onRefreshLinked={onRefreshLinked}
        />
      </section>
    </div>
  );
}
