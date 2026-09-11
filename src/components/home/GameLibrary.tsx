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
      className={`text-left w-full p-3.5 rounded-xl border flex flex-col justify-between min-h-[120px] bg-[var(--color-surface)] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/25 transition-all ${
        analyzed ? 'border-green-600' : 'border-[var(--color-border)]'
      }`}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-[var(--color-text-muted)] font-semibold truncate">{game.date}</span>
          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-[var(--color-background)] border border-[var(--color-border)] text-white shrink-0">{game.result}</span>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <PlayerAvatar name={game.white.username} avatar={game.white.avatar} size={22} />
            <span className="text-xs font-bold text-white truncate">{game.white.username}</span>
            {game.white.rating != null && (
              <span className="ml-auto shrink-0 text-[10px] font-mono font-bold text-[var(--color-text-muted)]">{game.white.rating}</span>
            )}
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <PlayerAvatar name={game.black.username} avatar={game.black.avatar} size={22} />
            <span className="text-xs font-bold text-white truncate">{game.black.username}</span>
            {game.black.rating != null && (
              <span className="ml-auto shrink-0 text-[10px] font-mono font-bold text-[var(--color-text-muted)]">{game.black.rating}</span>
            )}
          </div>
        </div>
      </div>
      {saved && (
        <Heart className="w-3 h-3 text-[var(--color-accent)] fill-current ml-auto mt-2" />
      )}
    </button>
  );
}

function GameCardSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 min-h-[120px]">
      <div className="animate-pulse space-y-3">
        <div className="flex justify-between">
          <div className="h-3 w-16 bg-[var(--color-border)] rounded" />
          <div className="h-3 w-12 bg-[var(--color-border)] rounded" />
        </div>
        <div className="h-4 w-3/4 bg-[var(--color-border)] rounded" />
        <div className="h-4 w-1/2 bg-[var(--color-border)] rounded" />
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
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5" id="game-library">
      {/* ── Import tabs ── */}
      <div className="flex border-b border-[var(--color-border)] mb-4 overflow-x-auto">
        <button
          onClick={() => { onImportModeChange('chesscom'); }}
          className={`pb-3 px-2.5 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap flex-shrink-0 transition-colors ${
            importMode === 'chesscom'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <img src="/img/icons/chesscom.svg" alt="" className="w-5 h-5 inline mr-1" />
          Chess.com
        </button>
        <button
          onClick={() => { onImportModeChange('lichess'); }}
          className={`pb-3 px-2.5 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap flex-shrink-0 transition-colors ${
            importMode === 'lichess'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <img src="/img/icons/lichess.svg" alt="" className="w-5 h-5 inline mr-1" />
          Lichess
        </button>
        <button
          onClick={() => { onImportModeChange('pgn'); }}
          className={`pb-3 px-2.5 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap flex-shrink-0 transition-colors ${
            importMode === 'pgn'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-1" />
          Paste PGN
        </button>
      </div>

      {/* ── Import input ── */}
      {importMode === 'pgn' ? (
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
            className="bg-[var(--color-primary)] text-white font-bold text-sm py-2.5 rounded-lg self-end px-6 hover:opacity-90 transition-opacity"
          >
            Analyze PGN
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onFetchGames();
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <input
            type="text"
            value={usernameInput}
            onChange={(e) => { onUsernameInputChange(e.target.value); }}
            placeholder={importMode === 'lichess' ? 'e.g. DrNykterstein' : 'e.g. Hikaru'}
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm text-white placeholder-[var(--color-text-muted)] flex-1 min-w-0 focus:outline-none focus:border-[var(--color-primary)]/60 transition-colors"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-[var(--color-primary)] text-white text-sm px-5 py-2.5 rounded-lg font-bold disabled:opacity-50 hover:opacity-90 transition-opacity flex-shrink-0"
          >
            {loading ? 'Searching...' : 'Fetch Games'}
          </button>
        </form>
      )}

      {/* ── Search + date range ── */}
      <div className="mt-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { onSearchQueryChange(e.target.value); }}
            placeholder="Search by opponent..."
            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]/60 transition-colors"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DATE_RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => { onDateRangeChange(r.value); }}
              className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all ${
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

      {/* ── Game list ── */}
      <div className="mt-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
          Games ({filteredGames.length})
        </div>
        {showSkeleton ? (
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
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
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
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

      {/* ── Linked games ── */}
      <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[var(--color-accent)]" />
            Linked Games
          </h3>
          <button
            onClick={onRefreshLinked}
            disabled={linkedLoading}
            className="text-[11px] font-bold text-[var(--color-primary)] border border-[var(--color-primary)] px-3 py-1 rounded-lg disabled:opacity-50 hover:bg-[var(--color-primary)]/10 transition-colors flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${linkedLoading ? 'animate-spin' : ''}`} />
            {linkedLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        {linkedLoading && linkedGames.length === 0 ? (
          <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
            {Array.from({ length: 2 }).map((_, i) => <GameCardSkeleton key={i} />)}
          </div>
        ) : linkedGames.length > 0 ? (
          <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
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
  );
}