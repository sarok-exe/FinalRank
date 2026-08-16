import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chessboard as RCChessboard } from 'react-chessboard';
import { Chess, type Square } from 'chess.js';
import { STARTING_FEN, type MoveClassification } from '../../types';
import { useSettingsStore } from '../../stores/settingsStore';
import { PieceIcon } from './PieceIcon';
import type { PieceHandlerArgs, PieceRenderObject } from 'react-chessboard';
import './board-animations.css';

export type Arrow = { from: string; to: string; color?: string };

function findKingSquare(fen: string, side: 'w' | 'b'): string | null {
  const boardPart = fen.split(' ')[0];
  const rows = boardPart.split('/');
  const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];
  for (let r = 0; r < 8; r++) {
    let col = 0;
    for (const ch of rows[r]) {
      if (/\d/.test(ch)) { col += parseInt(ch); continue; }
      const pieceColor = ch === ch.toUpperCase() ? 'w' : 'b';
      const pieceType = ch.toLowerCase();
      if (pieceType === 'k' && pieceColor === side) {
        return FILES[col] + RANKS[r];
      }
      col++;
    }
  }
  return null;
}

const FEN_FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const FEN_RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

/** Parse the board half of a FEN into { square: pieceCode }, e.g. { e4: 'wP' }. */
function fenToPieceMap(fen: string): Record<string, string> {
  const rows = fen.split(' ')[0].split('/');
  const map: Record<string, string> = {};
  for (let r = 0; r < 8 && r < rows.length; r++) {
    let col = 0;
    for (const ch of rows[r]) {
      if (/\d/.test(ch)) { col += parseInt(ch); continue; }
      if (col >= 8) break;
      const pieceColor = ch === ch.toUpperCase() ? 'w' : 'b';
      map[FEN_FILES[col] + FEN_RANKS[r]] = pieceColor + ch.toUpperCase();
      col++;
    }
  }
  return map;
}

function countPawns(board: Record<string, string>, color: 'w' | 'b'): number {
  let n = 0;
  for (const code of Object.values(board)) {
    if (code === color + 'P') n++;
  }
  return n;
}

type BoardFx = {
  /** Monotonic id — new value per move so the one-shot effect replays. */
  id: number;
  kind: 'capture' | 'promotion';
  square: string;
};

/**
 * Diff the previous and next FEN to figure out what kind of move happened.
 * react-chessboard doesn't tell us about captures/promotions directly, so we
 * infer them: a capture removes exactly one more piece than it adds (also
 * covers en passant), and a promotion turns one of the mover's pawns into a
 * Q/R/B/N on the arrival square.
 */
function detectBoardFx(prevFen: string, fen: string): Omit<BoardFx, 'id'> | null {
  if (!prevFen || !fen || prevFen === fen) return null;

  const prevMap = fenToPieceMap(prevFen);
  const nextMap = fenToPieceMap(fen);

  const removed: string[] = [];
  const added: string[] = [];
  for (const sq of new Set([...Object.keys(prevMap), ...Object.keys(nextMap)])) {
    if (prevMap[sq] === nextMap[sq]) continue;
    if (nextMap[sq] == null) removed.push(sq);
    else if (prevMap[sq] == null) added.push(sq);
    else { removed.push(sq); added.push(sq); } // same square, different piece
  }

  // The side that just moved is whoever was to move in the previous position.
  const moverColor = prevFen.split(' ')[1];
  if (moverColor !== 'w' && moverColor !== 'b') return null;

  // Captures and capture-promotions: one more piece vanished than appeared.
  if (removed.length - added.length === 1 && added.length === 1) {
    const arrival = added[0];
    const arrived = nextMap[arrival];
    const pawnsLost =
      countPawns(prevMap, moverColor) > countPawns(nextMap, moverColor);
    if (
      arrived != null &&
      arrived[0] === moverColor &&
      'QRBN'.includes(arrived[1]) &&
      pawnsLost
    ) {
      return { kind: 'promotion', square: arrival };
    }
    return { kind: 'capture', square: arrival };
  }

  // Quiet promotions: a pawn vanished and a Q/R/B/N of the mover's color
  // appeared (1 piece in, 1 piece out, same totals).
  if (removed.length === 1 && added.length === 1) {
    const arrival = added[0];
    const arrived = nextMap[arrival];
    if (
      arrived != null &&
      arrived[0] === moverColor &&
      'QRBN'.includes(arrived[1]) &&
      countPawns(prevMap, moverColor) > countPawns(nextMap, moverColor)
    ) {
      return { kind: 'promotion', square: arrival };
    }
  }

  return null;
}

type ChessboardProps = {
  fen: string;
  onMove?(from: string, to: string): boolean | void;
  playable?: boolean;
  orientation?: 'white' | 'black';
  className?: string;
  highlightSquares?: {
    from?: string;
    to?: string;
    classification?: MoveClassification;
  };
  bestMoveArrow?: {
    from: string;
    to: string;
  };
  hintSquare?: string;
  rightClickedSquares?: string[];
  onSquareRightClick?(square: string): void;
  onLeftClick?(): void;
  arrows?: Arrow[];
  onArrowsChange?(arrows: Arrow[]): void;
  winnerOverlay?: boolean;
  winnerSide?: 'w' | 'b';
  checkmateOverlay?: boolean;
  checkmateSide?: 'w' | 'b';
  animationDurationInMs?: number;
  /** Arm premove capture: while `playable` is false, attempts to move a piece
   *  of the premove color are queued as a premove instead of calling onMove. */
  premoveEnabled?: boolean;
  /** Color allowed to premove. Defaults to the side that will move next
   *  (opposite of the side to move in the current FEN). */
  premoveColor?: 'w' | 'b';
  /** Notified whenever the queued premove changes or is cleared. */
  onPremoveChange?(premove: { from: string; to: string } | null): void;
}

const THEME_COLORS: Record<string, { light: string; dark: string }> = {
  elegant:         { light: '#B0B0B0', dark: '#4D4D4D' },
  blue:            { light: '#e9edf6', dark: '#4b73be' },
  brown:           { light: '#f0d9b5', dark: '#b58863' },
  charcoal:        { light: '#e8ebef', dark: '#4d5d75' },
  'ocean-sunset':  { light: '#F2E8CF', dark: '#0A9396' },
  'fresh-greens':  { light: '#F2E8CF', dark: '#6A994E' },
  'cherry-blossom':{ light: '#FFCCD5', dark: '#C9184A' },
  'golden-blue':   { light: '#FFF3B0', dark: '#003566' },
  'pine-forest':   { light: '#EDEDE9', dark: '#3A5A40' },
  coastal:         { light: '#CAF0F8', dark: '#0077B6' },
  'amber-glow':    { light: '#FEFAE0', dark: '#D62828' },
  'soft-sand':     { light: '#F5EBE0', dark: '#A9927D' },
  green:           { light: '#eedcbf', dark: '#769656' },
};

/**
 * Build the custom piece renderers. react-chessboard v5 hands these
 * functions only a `{ square }` arg — the isDragging/isDraggable flags
 * only landed in v6, so we emulate them here: `playable` is the
 * draggable signal (it drives allowDragging) and `draggingSquare` is
 * tracked from onPieceDrag/onPieceDrop. That lets the wrapper apply a
 * chess.com-style lift to the grabbed piece (board-piece-lift) and a
 * subtle grip hint on hover (board-piece-hover). The wrapper stays
 * 100% x 100% so PieceIcon's w-full h-full svg keeps filling the
 * square, and its transform never touches the library's own slide
 * animation on the piece div.
 */
function buildCustomPieces(
  isDraggable: boolean,
  draggingSquare: string | null,
  dragColor: 'w' | 'b' | null,
): PieceRenderObject {
  const make = (type: string, color: 'w' | 'b') => (props?: { square?: string }) => {
    const square = props?.square;
    const isDragging =
      isDraggable && draggingSquare != null && square === draggingSquare;
    // While the board is locked for a premove, only the color that will move
    // next is grabbable — restrict the hover/lift nudge to those pieces.
    // The renderer is keyed by piece color (wK, bP, …) and the piece on the
    // square is always this renderer, so the piece's own `color` is the check.
    // Reading the FEN map here would put `pieceMap` in the useMemo deps and
    // rebuild all 12 renderers on every FEN change — react-chessboard calls
    // `pieces[pieceType]` for each piece, so a fresh function identity makes
    // React tear down and remount every piece's DOM mid-slide (the flicker).
    const canGrip =
      isDraggable && (dragColor == null || color === dragColor);
    const className = isDragging
      ? 'board-piece-lift'
      : canGrip
        ? 'board-piece-hover'
        : '';
    return (
      <div className={`w-full h-full ${className}`.trim()}>
        <PieceIcon type={type} color={color} />
      </div>
    );
  };
  return {
    wK: make('k', 'w'),
    wQ: make('q', 'w'),
    wR: make('r', 'w'),
    wB: make('b', 'w'),
    wN: make('n', 'w'),
    wP: make('p', 'w'),
    bK: make('k', 'b'),
    bQ: make('q', 'b'),
    bR: make('r', 'b'),
    bB: make('b', 'b'),
    bN: make('n', 'b'),
    bP: make('p', 'b'),
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function isDarkSquare(square: string, orientation: 'white' | 'black'): boolean {
  const file = square.charCodeAt(0) - 97;
  const rank = 8 - parseInt(square[1]);
  const dr = orientation === 'black' ? 7 - rank : rank;
  const dc = orientation === 'black' ? 7 - file : file;
  return (dr + dc) % 2 === 1;
}

/** Center of a square in board-percentage units (0–100), orientation-aware. */
function squareCenterPct(
  square: string,
  orientation: 'white' | 'black',
): { x: number; y: number } {
  const file = square.charCodeAt(0) - 97;
  const rank = 8 - parseInt(square[1], 10);
  const col = orientation === 'black' ? 7 - file : file;
  const row = orientation === 'black' ? 7 - rank : rank;
  return { x: (col + 0.5) * 12.5, y: (row + 0.5) * 12.5 };
}

/**
 * Is { from → to } a legal move in this exact position? Used to decide whether
 * a queued premove still applies after the position underneath it changes and
 * right before auto-firing it. Promotion defaults to queen (chess.com style).
 */
function isLegalMoveInFen(fen: string, from: string, to: string): boolean {
  try {
    const chess = new Chess(fen);
    chess.move({ from, to, promotion: 'q' });
    return true;
  } catch {
    return false;
  }
}

function renderClassificationBadge(cls: MoveClassification): React.JSX.Element | null {
  let iconPath: string | undefined;

  switch (cls) {
    case 'brilliant':  iconPath = '/img/classifications/brilliant.svg';  break;
    case 'excellent':  iconPath = '/img/classifications/excellent.svg';  break;
    case 'best':       iconPath = '/img/classifications/best.svg';       break;
    case 'good':
    case 'okay':       iconPath = '/img/classifications/good.svg';       break;
    case 'inaccuracy': iconPath = '/img/classifications/inaccuracy.svg'; break;
    case 'mistake':    iconPath = '/img/classifications/mistake.svg';    break;
    case 'blunder':    iconPath = '/img/classifications/blunder.svg';    break;
    case 'forced':     iconPath = '/img/classifications/forced.svg';     break;
    case 'book':       iconPath = '/img/classifications/book.svg';       break;
    case 'critical':   iconPath = '/img/classifications/critical.svg';   break;
    case 'risky':      iconPath = '/img/classifications/risky.svg';      break;
    default: return null;
  }

  return (
    <img
      src={iconPath}
      alt={cls}
      className="board-badge"
      style={{
        position: 'absolute',
        // Anchored to the square's top-right corner but fully INSIDE the
        // square — PARALLEL to the piece, beside it, never covering its body.
        // Anything that pokes outside the board gets cropped — by
        // react-chessboard's overflow:hidden (already overridden to visible)
        // and, on edge squares, by the page-level overflow-x:hidden on
        // #root/html/body when the board hugs the viewport edge on phones.
        // Inset 3px into the corner, the badge can never be cut on any edge
        // square (top row, right column, corners), stays clear of the board's
        // 4px border rounding, and the pop-in animation is untouched. Size is
        // set responsively in .board-badge (min(26px, 36%)).
        top: '3px',
        right: '3px',
        // Above the SLIDING piece only where it matters: react-chessboard's
        // moving piece carries z-index:10 while it slides, so 13 keeps the
        // symbol visible as the piece moves INTO the square — they arrive
        // together ("the piece moves with its symbol in parallel"). Once at
        // rest the badge sits in the corner beside the piece; arrows (z20)
        // and the winner/checkmate overlay (z30) still render above it.
        zIndex: 13,
      }}
      title={`Move classified as ${cls}`}
    />
  );
}

const Chessboard = memo(function Chessboard(props: ChessboardProps) {
  const {
    fen,
    playable = true,
    orientation = 'white',
    className = '',
    highlightSquares,
    bestMoveArrow,
    hintSquare,
    rightClickedSquares = [],
    arrows = [],
    winnerOverlay = false,
    winnerSide,
    checkmateOverlay = false,
    checkmateSide,
    animationDurationInMs = 300,
    premoveEnabled = false,
    premoveColor: premoveColorProp,
    onPremoveChange,
  } = props;
  const { settings } = useSettingsStore();
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);
  const [fx, setFx] = useState<BoardFx | null>(null);
  const prevFenRef = useRef<string | null>(null);
  const fxIdRef = useRef(0);
  // Square of the in-flight drag, for the piece-lift class. react-chessboard
  // v5 doesn't pass isDragging to piece renderers, so we track it ourselves.
  const [draggingSquare, setDraggingSquare] = useState<string | null>(null);
  // Legal target squares for the piece currently being dragged (chess.com-style
  // "move trail" rings). Only meaningful while a drag is in flight; cleared on
  // drop/cancel so it never lingers next to the click-select dots.
  const [dragHighlights, setDragHighlights] = useState<{
    from: string;
    to: string[];
  } | null>(null);
  // The classification badge is LATCHED, not derived from highlightSquares
  // each render, so it survives transient gaps in that prop: hypothesis
  // exploration updates the board position one render before the badge index
  // catches up, and a deviation's classification only arrives once the engine
  // finishes searching. The latch is replaced only by a genuinely new
  // classification and cleared only on the true start position — it can never
  // vanish mid-interaction.
  const [lastBadge, setLastBadge] = useState<{
    square: string;
    classification: MoveClassification;
    fen: string;
  } | null>(null);

  // ── Premove state (a queued move, chess.com-style) ────────────────────
  const [premove, setPremove] = useState<{ from: string; to: string } | null>(null);
  const [premoveFrom, setPremoveFrom] = useState<string | null>(null);
  const premoveRef = useRef<{ from: string; to: string } | null>(null);
  const premoveFromRef = useRef<string | null>(null);
  const prevPlayableRef = useRef(playable);
  const onMoveRef = useRef(props.onMove);
  onMoveRef.current = props.onMove;
  const onPremoveChangeRef = useRef(onPremoveChange);
  onPremoveChangeRef.current = onPremoveChange;
  const premoveEnabledRef = useRef(premoveEnabled);
  premoveEnabledRef.current = premoveEnabled;

  // The color allowed to premove: explicit prop, or derived as the side that
  // will move next (the opposite of whoever is to move right now).
  const premoveColor: 'w' | 'b' | null = premoveColorProp ?? (() => {
    const side = fen.split(' ')[1];
    if (side !== 'w' && side !== 'b') return null;
    return side === 'w' ? 'b' : 'w';
  })();

  const pieceMap = useMemo(() => fenToPieceMap(fen), [fen]);

  // One-shot capture/promotion effects, keyed by a fresh id per move so the
  // animation replays on every new move and never lingers across navigation.
  useEffect(() => {
    const prevFen = prevFenRef.current;
    prevFenRef.current = fen;
    const detected = prevFen != null ? detectBoardFx(prevFen, fen) : null;
    if (detected != null) {
      setFx({ id: ++fxIdRef.current, ...detected });
    }
  }, [fen]);

  // Badge latch — kept in sync with the latest valid classification via
  // React's "adjust state while rendering" pattern (guarded, so it settles
  // immediately and never loops). highlightSquares is a fresh object on every
  // parent render, so the latch compares VALUES; only a genuinely different
  // square / classification / position replaces it. Without this the badge
  // vanished whenever the prop went undefined for a render — exactly what
  // happens on the first frame of hypothesis exploration (the badge index
  // lags the position by one render) and for as long as the engine is still
  // classifying the current move.
  const badgeTo = highlightSquares?.to;
  const badgeCls = highlightSquares?.classification;
  if (badgeTo != null && badgeCls != null) {
    if (
      lastBadge == null ||
      lastBadge.square !== badgeTo ||
      lastBadge.classification !== badgeCls ||
      lastBadge.fen !== fen
    ) {
      setLastBadge({ square: badgeTo, classification: badgeCls, fen });
    }
  } else if (highlightSquares == null && fen === STARTING_FEN && lastBadge != null) {
    // The genuine start position (no move played yet) is the only place the
    // badge clears — a fresh position is waiting to be classified instead.
    setLastBadge(null);
  }

  const colors = THEME_COLORS[settings.boardColor] ?? THEME_COLORS.green;
  // The Profile "Right-Click" picker writes settings.rightClickHighlightColor,
  // so that field drives the marker; highlightColors.rightClick is the themed
  // default (both now default to the chess.com red #e53935).
  const rightClickHighlightColor =
    settings.rightClickHighlightColor ?? settings.highlightColors.rightClick ?? '#e53935';

  // Premove arms grabbing while the board is locked: only the color that will
  // move next is grabbable (canDragPiece enforces it; the lift/hover nudge in
  // buildCustomPieces is restricted the same way).
  const isDraggable = playable || premoveEnabled;
  const draggableColor: 'w' | 'b' | null = !playable && premoveEnabled ? premoveColor : null;

  const customPieces = useMemo(
    () => buildCustomPieces(isDraggable, draggingSquare, draggableColor),
    [isDraggable, draggingSquare, draggableColor],
  );

  // Same grab restriction, as a stable callback (it only depends on board
  // lock state, not on the position) so the options object stays cheap.
  const canDragPiece = useCallback((args: PieceHandlerArgs): boolean => {
    if (playable) return true;
    if (!premoveEnabled) return false;
    if (args.isSparePiece) return true;
    const pieceColor = args.piece.pieceType[0];
    return premoveColor == null || pieceColor === premoveColor;
  }, [playable, premoveEnabled, premoveColor]);

  const { moveTrail: mtColor, selectedSquare: ssColor } = settings.highlightColors;

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    const setBg = (sq: string, bg: string): void => {
      styles[sq] = { ...styles[sq], background: bg };
    };
    if (highlightSquares?.from != null) {
      setBg(highlightSquares.from,
        hexToRgba(mtColor, isDarkSquare(highlightSquares.from, orientation) ? 0.65 : 0.85));
    }
    if (highlightSquares?.to != null) {
      setBg(highlightSquares.to,
        hexToRgba(mtColor, isDarkSquare(highlightSquares.to, orientation) ? 0.65 : 0.85));
    }
    if (selectedSquare != null) {
      setBg(selectedSquare, hexToRgba(ssColor, 0.55));
    }
    if (hintSquare != null) {
      setBg(hintSquare, 'rgba(251, 191, 36, 0.40)');
    }
    // Right-click markers render as a chess.com-style overlay (see
    // squareRenderer) instead of a whole-square background tint.
    return styles;
  }, [highlightSquares, selectedSquare, hintSquare, orientation, mtColor, ssColor]);

  const boardArrows = useMemo(() => {
    const result: { startSquare: string; endSquare: string; color: string }[] = [];
    for (const a of arrows) {
      result.push({ startSquare: a.from, endSquare: a.to, color: a.color ?? '#ffaa00' });
    }
    if (bestMoveArrow != null) {
      result.push({ startSquare: bestMoveArrow.from, endSquare: bestMoveArrow.to, color: '#00a000' });
    }
    return result;
  }, [arrows, bestMoveArrow]);

  // ── Premove plumbing ──────────────────────────────────────────────────
  const queuePremove = useCallback((pm: { from: string; to: string }) => {
    premoveRef.current = pm;
    premoveFromRef.current = null;
    setPremove(pm);
    setPremoveFrom(null);
    onPremoveChangeRef.current?.(pm);
  }, []);

  const clearPremove = useCallback(() => {
    if (premoveRef.current == null) return;
    premoveRef.current = null;
    setPremove(null);
    onPremoveChangeRef.current?.(null);
  }, []);

  const clearPremoveSelection = useCallback(() => {
    if (premoveFromRef.current == null) return;
    premoveFromRef.current = null;
    setPremoveFrom(null);
  }, []);

  // Can this square's piece be used for a premove right now?
  const canPremovePiece = useCallback((square: string): boolean => {
    const piece = pieceMap[square];
    return piece != null && (premoveColor == null || piece[0] === premoveColor);
  }, [pieceMap, premoveColor]);

  // Click-click premove while the board is locked: the first click on a piece
  // of the premove color arms the selection, the second click on any other
  // square (empty or enemy-occupied) queues it. Clicking empty with no
  // selection cancels a queued premove, mirroring chess.com.
  const handlePremoveClick = useCallback((square: string) => {
    const piece = pieceMap[square];
    if (premoveFromRef.current != null) {
      if (square === premoveFromRef.current) {
        clearPremoveSelection();
        return;
      }
      if (piece != null && (premoveColor == null || piece[0] === premoveColor)) {
        // Another own-color piece — move the selection instead of targeting it.
        premoveFromRef.current = square;
        setPremoveFrom(square);
        return;
      }
      queuePremove({ from: premoveFromRef.current, to: square });
      return;
    }
    if (piece != null && (premoveColor == null || piece[0] === premoveColor)) {
      premoveFromRef.current = square;
      setPremoveFrom(square);
      return;
    }
    if (piece == null) {
      clearPremove();
    }
  }, [pieceMap, premoveColor, queuePremove, clearPremove, clearPremoveSelection]);

  const handlePieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
      // Any drag end clears the lift and the drag highlights — including
      // cancelled/vetoed drops.
      setDraggingSquare(null);
      setDragHighlights(null);
      if (targetSquare == null) return false;
      if (!playable) {
        // Board locked: with premove armed, dropping an own-color piece queues
        // the move as a premove. The piece still snaps back (return false) —
        // the position only changes when the premove fires later.
        if (premoveEnabled && sourceSquare !== targetSquare && canPremovePiece(sourceSquare)) {
          queuePremove({ from: sourceSquare, to: targetSquare });
        }
        return false;
      }
      // Picking a piece up and putting it back on the same square is not a move.
      if (sourceSquare === targetSquare) return false;
      // Allow the caller to veto the move (e.g. wrong puzzle move): when onMove
      // returns false the piece snaps back instead of staying on the square.
      const accepted = props.onMove?.(sourceSquare, targetSquare);
      return accepted !== false;
    },
    [playable, props, premoveEnabled, canPremovePiece, queuePremove],
  );

  const handlePieceDragStart = useCallback(
    ({ square }: { square: string | null }) => {
      if (square == null) {
        setDraggingSquare(null);
        setDragHighlights(null);
        return;
      }
      setDraggingSquare(square);
      // A drag supersedes any click-select state: drop the dots so the
      // drag's legal-move highlights are the only marks on the board.
      setSelectedSquare(null);
      setValidMoves([]);
      // Chess.com-style: while dragging, ring every square this piece can
      // legally move to (in the current position). On a premove-locked board
      // only premove-color pieces can be grabbed, and their targets are the
      // legal ones here — a drop that's not in this list simply won't ring.
      let targets: string[] = [];
      try {
        const chess = new Chess(fen);
        targets = chess.moves({ square: square as Square, verbose: true }).map(m => m.to);
      } catch {
        // Malformed FEN — no targets to show.
      }
      setDragHighlights({ from: square, to: targets });
    },
    [fen],
  );

  // A drag can be cancelled without ever reaching onPieceDrop (e.g. pressing
  // Escape), which would leave a square stuck "lifted". Clear the lift state
  // on any stray pointer-up or Escape while a drag is in flight.
  useEffect(() => {
    if (draggingSquare == null) return;
    const clear = () => {
      setDraggingSquare(null);
      setDragHighlights(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clear();
    };
    document.addEventListener('pointerup', clear);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerup', clear);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [draggingSquare]);

  // A queued premove only survives while it stays legal in the current
  // position — when the position underneath it changes (engine reply,
  // browsing, a new puzzle) and the move no longer applies, drop it silently
  // so the dashed arrow simply disappears.
  useEffect(() => {
    const pm = premoveRef.current;
    if (pm == null) return;
    if (!isLegalMoveInFen(fen, pm.from, pm.to)) clearPremove();
  }, [fen, clearPremove]);

  // The board just became playable again: fire any queued premove instantly.
  // The premove is spent the moment the board unlocks — cleared first, then
  // validated once more (the position may have shifted under it) and played.
  useEffect(() => {
    const wasPlayable = prevPlayableRef.current;
    prevPlayableRef.current = playable;
    if (wasPlayable || !playable) return;
    // An unlocked board also invalidates any in-flight premove selection.
    if (premoveFromRef.current != null) {
      premoveFromRef.current = null;
      setPremoveFrom(null);
    }
    const pm = premoveRef.current;
    if (pm == null) return;
    premoveRef.current = null;
    setPremove(null);
    setSelectedSquare(null);
    setValidMoves([]);
    onPremoveChangeRef.current?.(null);
    if (!isLegalMoveInFen(fen, pm.from, pm.to)) return;
    // onMove may return false to veto (e.g. a wrong puzzle move); either way
    // the premove is already cleared above.
    onMoveRef.current?.(pm.from, pm.to);
  }, [playable, fen]);

  // If premove support is switched off, drop any queued premove.
  useEffect(() => {
    if (premoveEnabledRef.current || premoveRef.current == null) return;
    premoveRef.current = null;
    setPremove(null);
    onPremoveChangeRef.current?.(null);
  }, [premoveEnabled]);

  // Escape cancels an in-flight premove selection or a queued premove
  // (mirrors the existing drag-cancel Escape handler above).
  useEffect(() => {
    if (premove == null && premoveFrom == null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      clearPremove();
      clearPremoveSelection();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [premove, premoveFrom, clearPremove, clearPremoveSelection]);

  const handleSquareClick = useCallback(
    ({ square }: { square: string }) => {
      props.onLeftClick?.();
      if (!playable) {
        handlePremoveClick(square);
        return;
      }

      // Clicking the already-selected square again deselects — never a move.
      if (selectedSquare != null && square === selectedSquare) {
        setSelectedSquare(null);
        setValidMoves([]);
        return;
      }

      if (selectedSquare != null && validMoves.includes(square)) {
        if (props.onMove) props.onMove(selectedSquare, square);
        setSelectedSquare(null);
        setValidMoves([]);
        return;
      }

      try {
        const chess = new Chess(fen);
        const piece = chess.get(square as Square);
        if (piece) {
          const moves = chess.moves({ square: square as Square, verbose: true }).map(m => m.to);
          setSelectedSquare(square);
          setValidMoves(moves);
        } else {
          setSelectedSquare(null);
          setValidMoves([]);
        }
      } catch {
        setSelectedSquare(null);
        setValidMoves([]);
      }
    },
    [playable, fen, selectedSquare, validMoves, props, handlePremoveClick],
  );

  const handleSquareRightClick = useCallback(
    ({ square }: { square: string }) => { props.onSquareRightClick?.(square); },
    [props],
  );

  const handleArrowsChange = useCallback(
    ({ arrows: libArrows }: { arrows: { startSquare: string; endSquare: string; color: string }[] }) => {
      const converted = libArrows.map(a => ({ from: a.startSquare, to: a.endSquare, color: a.color }));
      props.onArrowsChange?.(converted);
    },
    [props],
  );

  const squareRenderer = useCallback(
    ({ square, children }: { square: string; children?: React.ReactNode }) => {
      const isDot = validMoves.includes(square);
      const isTo = highlightSquares?.to === square;
      const isSlideSource = highlightSquares?.from === square;
      const isRightClicked = rightClickedSquares.includes(square);
      const isDragTarget =
        dragHighlights != null && dragHighlights.from !== square &&
        dragHighlights.to.includes(square);
      // The badge is the LATCHED classification (lastBadge), not the live
      // highlightSquares, so it stays on its square while the current move is
      // still being classified or the prop is transiently undefined.
      const isBadge = lastBadge?.square === square;
      const isHint = hintSquare === square;
      const isFx = fx != null && fx.square === square;
      const isPremoveSource = premove?.from === square;
      const isPremoveTarget = premove?.to === square;
      const isPremoveArm = premoveFrom === square && premove == null;
      const isPremoveMarker = isPremoveSource || isPremoveTarget || isPremoveArm;
      if (!isDot && !isBadge && !isHint && !isTo && !isFx && !isRightClicked && !isPremoveMarker && !isDragTarget) return <>{children}</>;

      const hasPiece = children != null;
      return (
        <div style={{
          width: '100%', height: '100%', position: 'relative',
          ...(squareStyles[square] ?? {}),
          // Under-piece overlays (glow, right-click marker) need a stacking
          // context so a z-index:-1 layer paints behind the piece but above
          // the square's highlight. The "from" square is deliberately left
          // un-isolated: react-chessboard slides the piece from there and any
          // stacking context would trap its z-index:10 and break the slide.
          // Premove markers must survive alongside the same slide-on-fire
          // animations, so they follow the same un-isolated rule and float
          // above the sliding piece instead.
          ...((isTo || ((isDragTarget || isRightClicked) && !isSlideSource)) ? { isolation: 'isolate' } : {}),
        }}>
          {isTo && (
            <div
              className="board-glow"
              style={{
                position: 'absolute', inset: '4%', borderRadius: '50%',
                background: `radial-gradient(circle at center, ${hexToRgba(mtColor, 0.6)}, ${hexToRgba(mtColor, 0.16)} 55%, transparent 74%)`,
                pointerEvents: 'none', zIndex: -1,
              }}
            />
          )}
          {isRightClicked && (
            <div
              className="board-rightclick-pop"
              style={{
                position: 'absolute', inset: 0,
                backgroundColor: hexToRgba(rightClickHighlightColor, 0.5),
                boxShadow: `inset 0 0 0 2px ${rightClickHighlightColor}`,
                pointerEvents: 'none',
                // On the slide source the wrapper can't be isolated (see
                // above), so float the marker above the sliding piece; every
                // other square keeps it tucked under the piece.
                zIndex: isSlideSource ? 12 : -1,
              }}
            />
          )}
          {isDragTarget && (
            <div
              style={{
                position: 'absolute', inset: 0,
                // Chess.com-style move trail: faint translucent fill with a
                // crisp ring, using the same accent as the last-move trail.
                backgroundColor: hexToRgba(mtColor, 0.28),
                boxShadow: `inset 0 0 0 3px ${mtColor}`,
                pointerEvents: 'none', zIndex: -1,
              }}
            />
          )}
          {children}
          {isBadge && lastBadge != null && (
            <div
              key={`badge-${lastBadge.fen}-${lastBadge.square}-${lastBadge.classification}`}
              style={{ display: 'contents' }}
            >
              {renderClassificationBadge(lastBadge.classification)}
            </div>
          )}
          {isHint && (
            <div
              className="animate-pulse"
              style={{
                position: 'absolute', inset: '6%', borderRadius: '50%',
                border: '4px solid #fbbf24',
                boxShadow: '0 0 14px rgba(251, 191, 36, 0.8)',
                pointerEvents: 'none', zIndex: 12,
              }}
            />
          )}
          {(isPremoveArm || isPremoveSource) && (
            <div
              className="board-premove-marker"
              style={{
                position: 'absolute', inset: 0,
                // The source square may double as the slide source when the
                // premove fires; in that case its wrapper isn't isolated and
                // the marker floats above the sliding piece (see comment up
                // top). Everywhere else it tucks under the piece.
                boxShadow: `inset 0 0 0 3px #fbbf24, inset 0 0 0 5px ${hexToRgba('#fbbf24', 0.35)}`,
                pointerEvents: 'none',
                zIndex: isPremoveSource ? 12 : -1,
              }}
            />
          )}
          {isPremoveTarget && (
            <div
              className="board-premove-marker"
              style={{
                position: 'absolute', inset: '4%', borderRadius: '50%',
                border: '3px dashed #fbbf24',
                boxShadow: `0 0 0 2px ${hexToRgba('#fbbf24', 0.22)}, 0 0 12px ${hexToRgba('#fbbf24', 0.45)}`,
                pointerEvents: 'none', zIndex: -1,
              }}
            />
          )}
          {isDot && !hasPiece && (
            <div style={{
              width: '28%', height: '28%', borderRadius: '50%',
              backgroundColor: 'rgba(0,0,0,0.25)',
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none', zIndex: 10,
            }} />
          )}
          {isDot && hasPiece && (
            <div style={{
              width: '82%', height: '82%', borderRadius: '50%',
              border: '4px solid rgba(0,0,0,0.2)',
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none', zIndex: 10,
            }} />
          )}
          {isFx && fx.kind === 'capture' && (
            <div
              key={`fx-capture-${fx.id}`}
              className="board-fx-ring"
              style={{
                position: 'absolute', top: '50%', left: '50%',
                width: '78%', height: '78%', borderRadius: '50%',
                border: `3px solid ${hexToRgba(mtColor, 0.9)}`,
                boxShadow: `0 0 18px ${hexToRgba(mtColor, 0.75)}, inset 0 0 12px ${hexToRgba(mtColor, 0.4)}`,
                pointerEvents: 'none', zIndex: 12,
                // Hold the ring invisible until the sliding piece lands.
                animationDelay: `${animationDurationInMs}ms`,
              }}
            />
          )}
          {isFx && fx.kind === 'promotion' && (
            <div
              key={`fx-promotion-${fx.id}`}
              style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                pointerEvents: 'none', zIndex: 12,
              }}
            >
              <div
                className="board-fx-promotion-burst"
                style={{
                  position: 'absolute', top: '50%', left: '50%',
                  width: '96%', height: '96%', borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.95), rgba(253,224,71,0.45) 45%, transparent 70%)',
                  animationDelay: `${animationDurationInMs}ms`,
                }}
              />
              <div
                className="board-fx-promotion-ring"
                style={{
                  position: 'absolute', top: '50%', left: '50%',
                  width: '80%', height: '80%', borderRadius: '50%',
                  border: '2px solid rgba(255, 245, 200, 0.95)',
                  boxShadow: '0 0 16px rgba(253, 224, 71, 0.8)',
                  animationDelay: `${animationDurationInMs}ms`,
                }}
              />
            </div>
          )}
        </div>
      );
    },
    [validMoves, highlightSquares, hintSquare, squareStyles, fx, fen, mtColor, rightClickedSquares, rightClickHighlightColor, animationDurationInMs, premove, premoveFrom, dragHighlights, lastBadge],
  );

  const renderSquareOverlay = (kingSquare: string, icon: string): React.JSX.Element => {
    const flipped = orientation === 'black';
    const f = kingSquare.charCodeAt(0) - 97;
    const r = 8 - parseInt(kingSquare[1]);
    const col = flipped ? 7 - f : f;
    const row = flipped ? 7 - r : r;
    return (
      <div
        style={{
          position: 'absolute',
          top: `${(row / 8) * 100}%`,
          left: `${(col / 8) * 100}%`,
          width: '12.5%',
          height: '12.5%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 30,
        }}
      >
        <img src={icon} alt="" className="w-[55%] h-[55%] drop-shadow-lg" />
      </div>
    );
  };

  return (
    <div
      className={`relative aspect-square w-full min-w-0 ${className}`}
      style={{
        // Explicit min sizes so a transient parent reflow can never collapse
        // the board to 0×0 mid-update — react-chessboard reads the square
        // width to animate slides and would throw (and blank the board) on
        // a 0-width read. min-w-0 also keeps flex/grid parents from blowout.
        minWidth: 0,
        minHeight: 0,
        '--board-slide-duration': `${animationDurationInMs}ms`,
      } as React.CSSProperties}
    >
      <RCChessboard
        options={{
          id: 'finalrank',
          position: fen,
          pieces: customPieces,
          boardOrientation: orientation,
          // chess.com-style grab lift: the scale/shadow live on the piece
          // wrapper (.board-piece-lift, animated in via @starting-style), so
          // the clone's default scale(1.2) is neutralized here to avoid
          // double-scaling the dragged piece. zIndex keeps the clone above
          // the board during the drag.
          draggingPieceStyle: { transform: 'none', zIndex: 40 },
          // While dragging, leave the origin square empty (chess.com look)
          // instead of showing a ghost — the lifted clone replaces it.
          draggingPieceGhostStyle: { opacity: 0 },
          boardStyle: {
            border: '4px solid #2a2a2a',
            borderRadius: '8px',
            // RCChessboard defaults to overflow:hidden, which chops anything
            // poking out of a square (classification badge, edge FX) flat at
            // the board edge. The opaque 4px border follows the rounded
            // corner and masks the squares' corners, so overflow:visible
            // keeps the rounded board look while badges pop out in full.
            overflow: 'visible',
          },
          lightSquareStyle: { backgroundColor: colors.light },
          darkSquareStyle: { backgroundColor: colors.dark },
          squareStyles,
          arrows: boardArrows,
          // Premove arms grabbing while the board is locked, so the dashed
          // premove can be queued by dragging. When locked, canDragPiece
          // restricts grab to the color allowed to premove.
          allowDragging: isDraggable,
          canDragPiece,
          allowDrawingArrows: true,
          clearArrowsOnClick: true,
          clearArrowsOnPositionChange: false,
          showAnimations: true,
          animationDurationInMs,
          showNotation: settings.featureToggles.showCoordinates,
          alphaNotationStyle: { fontSize: Math.max(settings.coordinatesSize, 6) },
          numericNotationStyle: { fontSize: Math.max(settings.coordinatesSize, 6) },
          onPieceDrop: handlePieceDrop,
          onPieceDrag: handlePieceDragStart,
          onSquareClick: handleSquareClick,
          onSquareRightClick: handleSquareRightClick,
          onArrowsChange: handleArrowsChange,
          squareRenderer,
        }}
      />
      {winnerOverlay && winnerSide != null && (() => {
        const sq = findKingSquare(fen, winnerSide);
        return sq != null ? renderSquareOverlay(sq, '/img/classifications/winner.svg') : null;
      })()}
      {checkmateOverlay && checkmateSide != null && (() => {
        const sq = findKingSquare(fen, checkmateSide);
        const icon = checkmateSide === 'w'
          ? '/img/classifications/checkmate_white.svg'
          : '/img/classifications/checkmate_black.svg';
        return sq != null ? renderSquareOverlay(sq, icon) : null;
      })()}
    </div>
  );
});

Chessboard.displayName = 'Chessboard';
export default Chessboard;
