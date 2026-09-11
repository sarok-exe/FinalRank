import { useEffect } from 'react';
import { Undo2, RotateCcw } from 'lucide-react';
import type { ChessGame } from '../../types';
import type { FreePlayMove } from '../../hooks/useFreePlayBoard';
import type { MoveClassification } from '../../types';
import Chessboard from '../board/Chessboard';
import GameLibrary from './GameLibrary';
import PlayerAvatar from '../PlayerAvatar';
import { classificationBadgeStyles, classificationImages } from '../../constants/classifications';

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
  boardMoves: FreePlayMove[];
  onBoardMove(from: string, to: string, promotion?: string): boolean;
  boardEvaluating: boolean;
  boardEval: { score: number; isMate: boolean } | null;
  onUndoBoardMove(): void;
  onResetBoard(): void;
  previewGame?: ChessGame | null;
  onOpenFullAnalysis?(): void;
  loadPgn(pgn: string, analyzedMoves?: ReadonlyArray<{ classification?: string | null; note?: string | null }>): boolean;
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
    boardMoves,
    onBoardMove,
    boardEvaluating,
    boardEval,
    onUndoBoardMove,
    onResetBoard,
    previewGame,
    onOpenFullAnalysis,
    loadPgn,
  } = props;

  // Preview mode: load the game's PGN into the free-play board (final position
  // shown, moves listed with their classifications). Leaving preview mode resets
  // the board back to the free-play starting position.
  useEffect(() => {
    if (previewGame) {
      loadPgn(previewGame.pgn, previewGame.moves);
    } else {
      onResetBoard();
    }
    // loadPgn / onResetBoard are stable useCallbacks — previewGame is the only
    // meaningful dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewGame]);

  const lastMove = boardMoves.length > 0 ? boardMoves[boardMoves.length - 1] : null;

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

  const lastCls = lastMove?.classification as MoveClassification | undefined;
  const classificationStyle = lastCls ? classificationBadgeStyles[lastCls] : undefined;

  return (
    <div
      className="flex flex-col lg:flex-row gap-5 items-start"
      id="home-screen"
    >
      {/* ═══════════════ LEFT — free-play board at its own size ═══════════════ */}
      <div className="w-full lg:w-auto lg:shrink-0 flex flex-col items-center">
        <div className="w-full lg:w-[668px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 flex flex-col items-center">
          {/* Board + eval bar */}
          <div className="w-full flex gap-3 items-stretch justify-center">
            <div className="flex-1 min-w-0 max-w-[min(100%,600px)]">
              <Chessboard
                fen={boardFen}
                playable
                orientation="white"
                onMove={(from, to) => {
                  const ok = onBoardMove(from, to);
                  return ok;
                }}
                highlightSquares={
                  lastMove && lastCls
                    ? { from: lastMove.from, to: lastMove.to, classification: lastCls }
                    : undefined
                }
                animationDurationInMs={300}
              />
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

          {/* Move history — compact SAN chips with per-move classification icons */}
          <div className="w-full mt-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
              Moves
            </div>
            {boardMoves.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)] italic">
                Make a move to start.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {boardMoves.map((m, i) => {
                  const clsImg = m.classification ? classificationImages[m.classification] : undefined;
                  return (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 text-xs font-mono font-bold text-white"
                    >
                      {i % 2 === 0 && (
                        <span className="text-[10px] font-sans font-bold text-[var(--color-text-muted)]">
                          {Math.floor(i / 2) + 1}.
                        </span>
                      )}
                      {m.san}
                      {clsImg && (
                        <img
                          src={clsImg}
                          alt={m.classification!}
                          className="w-3 h-3 inline-block shrink-0"
                          title={m.classification!}
                        />
                      )}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Last move classification badge + coach note */}
          {(classificationStyle || lastMove?.note) && (
            <div className="w-full mt-4 flex items-start gap-2.5">
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
              {lastMove?.note && (
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                  {lastMove.note}
                </p>
              )}
            </div>
          )}

          {/* Undo / Reset controls */}
          <div className="w-full mt-4 flex items-center gap-2">
            <button
              onClick={onUndoBoardMove}
              disabled={boardMoves.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-primary)]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Undo2 className="w-4 h-4" />
              Undo
            </button>
            <button
              onClick={onResetBoard}
              disabled={boardMoves.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-primary)]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>

          {/* Preview mode — game metadata + open full analysis */}
          {previewGame && (
            <>
              <div className="w-full mt-4 pt-4 border-t border-[var(--color-border)] space-y-2">
                <div className="flex items-center gap-2 min-w-0">
                  <PlayerAvatar name={previewGame.white.username} avatar={previewGame.white.avatar} size={22} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] shrink-0">White</span>
                  <span className="text-xs font-bold text-white truncate">{previewGame.white.username}</span>
                  {previewGame.white.rating != null && (
                    <span className="ml-auto shrink-0 text-[11px] font-mono font-bold text-[var(--color-text-muted)]">{previewGame.white.rating}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <PlayerAvatar name={previewGame.black.username} avatar={previewGame.black.avatar} size={22} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] shrink-0">Black</span>
                  <span className="text-xs font-bold text-white truncate">{previewGame.black.username}</span>
                  {previewGame.black.rating != null && (
                    <span className="ml-auto shrink-0 text-[11px] font-mono font-bold text-[var(--color-text-muted)]">{previewGame.black.rating}</span>
                  )}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{previewGame.date}</span>
                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-[var(--color-background)] border border-[var(--color-border)] text-white">{previewGame.result}</span>
                </div>
              </div>

              <button
                onClick={onOpenFullAnalysis}
                className="w-full mt-4 bg-[var(--color-primary)] text-white font-bold rounded-lg py-2.5 text-sm hover:opacity-90 transition-opacity"
              >
                Open Full Analysis
              </button>
            </>
          )}
        </div>
      </div>

      {/* ═══════════════ RIGHT — game library fills remaining width ═══════════════ */}
      <div className="w-full lg:flex-1 lg:self-stretch min-w-0">
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
      </div>
    </div>
  );
}