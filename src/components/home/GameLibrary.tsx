import { useState } from 'react';
import { Search, FileText, Heart, BookOpen, RefreshCw } from 'lucide-react';
import type { ChessGame } from '../../types';
import PlayerAvatar from '../PlayerAvatar';

export type GameLibraryProps = {
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
};

const DATE_RANGES = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last week' },
  { value: 'month', label: 'Last month' },
] as const;

function GameCard({ game, analyzed, saved, onPick }: {
  game: ChessGame;
  analyzed: boolean;
  saved: boolean;
  onPick(gameId: string): void;
}) {
  return (
    <button
      onClick={() => { onPick(game.id); }}
      className={`text-left w-full p-3 rounded-xl border flex flex-col justify-between min-h-[100px] bg-[var(--color-surface)] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/25 transition-all ${
        analyzed ? 'border-green-600' : 'border-[var(--color-border)]'
      }`}
    >
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-[var(--color-text-muted)] font-semibold truncate">{game.date}</span>
          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-background)] border border-[var(--color-border)] text-white shrink-0">{game.result}</span>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <PlayerAvatar name={game.white.username} avatar={game.white.avatar} size={20} />
            <span className="text-[11px] font-bold text-white truncate">{game.white.username}</span>
            {game.white.rating != null && (
              <span className="ml-auto shrink-0 text-[10px] font-mono font-bold text-[var(--color-text-muted)]">{game.white.rating}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <PlayerAvatar name={game.black.username} avatar={game.black.avatar} size={20} />
            <span className="text-[11px] font-bold text-white truncate">{game.black.username}</span>
            {game.black.rating != null && (
              <span className="ml-auto shrink-0 text-[10px] font-mono font-bold text-[var(--color-text-muted)]">{game.black.rating}</span>
            )}
          </div>
        </div>
      </div>
      {saved && (
        <Heart className="w-3 h-3 text-[var(--color-accent)] fill-current ml-auto mt-1.5" />
      )}
    </button>
  );
}

function GameCardSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 min-h-[100px]">
      <div className="animate-pulse space-y-2.5">
        <div className="flex justify-between">
          <div className="h-2.5 w-14 bg-[var(--color-border)] rounded" />
          <div className="h-2.5 w-10 bg-[var(--color-border)] rounded" />
        </div>
        <div className="h-3.5 w-3/4 bg-[var(--color-border)] rounded" />
        <div className="h-3.5 w-1/2 bg-[var(--color-border)] rounded" />
      </div>
    </div>
  );
}

export default function GameLibrary(props: GameLibraryProps) {
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
  } = props;
  const [pgnInput, setPgnInput] = useState('');

  const showSkeleton = loading && games.length === 0;
  const showEmptyNoGames = !loading && games.length === 0;
  const showEmptyNoMatch = !loading && games.length > 0 && filteredGames.length === 0;

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5" id="game-library">
      {/* ── Compact import controls strip ── */}
      <div className="flex flex-col gap-3">
        {/* Row 1: segmented tabs + username input */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-1 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-1 flex-shrink-0 overflow-x-auto">
            <button
              onClick={() => { onImportModeChange('chesscom'); }}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors ${
                importMode === 'chesscom'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              <img src="/img/icons/chesscom.svg" alt="" className="w-3.5 h-3.5 inline mr-1" />
              Chess.com
            </button>
            <button
              onClick={() => { onImportModeChange('lichess'); }}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors ${
                importMode === 'lichess'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              <img src="/img/icons/lichess.svg" alt="" className="w-3.5 h-3.5 inline mr-1" />
              Lichess
            </button>
            <button
              onClick={() => { onImportModeChange('pgn'); }}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors ${
                importMode === 'pgn'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              <FileText className="w-3.5 h-3.5 inline mr-1" />
              PGN
            </button>
          </div>

          {importMode !== 'pgn' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onFetchGames();
              }}
              className="flex-1 flex gap-2 min-w-0"
            >
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => { onUsernameInputChange(e.target.value); }}
                placeholder={importMode === 'lichess' ? 'e.g. DrNykterstein' : 'e.g. Hikaru'}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3.5 py-2 text-sm text-white placeholder-[var(--color-text-muted)] flex-1 min-w-0 focus:outline-none focus:border-[var(--color-primary)]/60 transition-colors"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-[var(--color-primary)] text-white text-xs px-4 py-2 rounded-lg font-bold disabled:opacity-50 hover:opacity-90 transition-opacity flex-shrink-0"
              >
                {loading ? 'Searching...' : 'Fetch'}
              </button>
            </form>
          )}
        </div>

        {/* PGN textarea — appears below the row when the PGN tab is active */}
        {importMode === 'pgn' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const pgn = pgnInput.trim();
              if (!pgn) return;
              onPgnSubmit(pgn);
              setPgnInput('');
            }}
            className="flex flex-col gap-2"
          >
            <textarea
              value={pgnInput}
              onChange={(e) => { setPgnInput(e.target.value); }}
              placeholder="Paste PGN here..."
              rows={3}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3 text-xs font-mono text-white placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]/60 transition-colors"
            />
            <button
              type="submit"
              className="bg-[var(--color-primary)] text-white font-bold text-xs py-2 rounded-lg self-end px-5 hover:opacity-90 transition-opacity"
            >
              Analyze PGN
            </button>
          </form>
        )}

        {/* Row 2: search + date chips */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { onSearchQueryChange(e.target.value); }}
              placeholder="Search by opponent..."
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]/60 transition-colors"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 flex-shrink-0">
            {DATE_RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => { onDateRangeChange(r.value); }}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                  dateRange === r.value
                    ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                    : 'bg-[var(--color-background)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:text-white hover:border-[var(--color-primary)]/40'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Two divided bars: Games + Linked Games ── */}
      <div className="flex-1 min-h-0 overflow-y-auto mt-4 space-y-4 pr-1">
        {/* Bar 1 — Games */}
        <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
            Games ({filteredGames.length})
          </div>
          {showSkeleton ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, i) => <GameCardSkeleton key={i} />)}
            </div>
          ) : showEmptyNoGames ? (
            <p className="text-xs text-[var(--color-text-muted)] italic py-6 text-center">
              No games yet — fetch your games above.
            </p>
          ) : showEmptyNoMatch ? (
            <p className="text-xs text-[var(--color-text-muted)] italic py-6 text-center">
              No matches for this filter.
            </p>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
              {filteredGames.map((g) => (
                <GameCard
                  key={g.id}
                  game={g}
                  analyzed={analyzedGameIds.has(g.id)}
                  saved={savedGameIds.has(g.id)}
                  onPick={onPickGame}
                />
              ))}
            </div>
          )}
        </div>

        {/* Bar 2 — Linked Games */}
        <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[var(--color-accent)]" />
              Linked Games
            </h3>
            <button
              onClick={onRefreshLinked}
              disabled={linkedLoading}
              className="text-[10px] font-bold text-[var(--color-primary)] border border-[var(--color-primary)] px-2.5 py-1 rounded-lg disabled:opacity-50 hover:bg-[var(--color-primary)]/10 transition-colors flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${linkedLoading ? 'animate-spin' : ''}`} />
              {linkedLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          {linkedLoading && linkedGames.length === 0 ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
              {Array.from({ length: 2 }).map((_, i) => <GameCardSkeleton key={i} />)}
            </div>
          ) : linkedGames.length > 0 ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
              {linkedGames.map((g) => (
                <GameCard
                  key={g.id}
                  game={g}
                  analyzed={analyzedGameIds.has(g.id)}
                  saved={savedGameIds.has(g.id)}
                  onPick={onPickGame}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--color-text-muted)] italic py-2 text-center">
              No linked games yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}