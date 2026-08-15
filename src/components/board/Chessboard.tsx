import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chessboard as RCChessboard } from 'react-chessboard';
import { Chess, type Square } from 'chess.js';
import type { MoveClassification } from '../../types';
import { useSettingsStore } from '../../stores/settingsStore';
import { PieceIcon } from './PieceIcon';
import type { PieceRenderObject } from 'react-chessboard';
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
): PieceRenderObject {
  const make = (type: string, color: 'w' | 'b') => (props?: { square?: string }) => {
    const isDragging =
      isDraggable && draggingSquare != null && props?.square === draggingSquare;
    const className = isDragging
      ? 'board-piece-lift'
      : isDraggable
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
        position: 'absolute', top: '-8px', right: '-8px',
        width: '28px', height: '28px', zIndex: 10,
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

  const colors = THEME_COLORS[settings.boardColor] ?? THEME_COLORS.green;
  // The Profile "Right-Click" picker writes settings.rightClickHighlightColor,
  // so that field drives the marker; highlightColors.rightClick is the themed
  // default (both now default to the chess.com red #e53935).
  const rightClickHighlightColor =
    settings.rightClickHighlightColor ?? settings.highlightColors.rightClick ?? '#e53935';

  const customPieces = useMemo(
    () => buildCustomPieces(playable, draggingSquare),
    [playable, draggingSquare],
  );

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

  const handlePieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
      // Any drag end clears the lift — including cancelled/vetoed drops.
      setDraggingSquare(null);
      if (!playable || targetSquare == null) return false;
      // Picking a piece up and putting it back on the same square is not a move.
      if (sourceSquare === targetSquare) return false;
      // Allow the caller to veto the move (e.g. wrong puzzle move): when onMove
      // returns false the piece snaps back instead of staying on the square.
      const accepted = props.onMove?.(sourceSquare, targetSquare);
      return accepted !== false;
    },
    [playable, props],
  );

  const handlePieceDragStart = useCallback(
    ({ square }: { square: string | null }) => {
      if (square != null) setDraggingSquare(square);
    },
    [],
  );

  // A drag can be cancelled without ever reaching onPieceDrop (e.g. pressing
  // Escape), which would leave a square stuck "lifted". Clear the lift state
  // on any stray pointer-up or Escape while a drag is in flight.
  useEffect(() => {
    if (draggingSquare == null) return;
    const clear = () => setDraggingSquare(null);
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

  const handleSquareClick = useCallback(
    ({ square }: { square: string }) => {
      props.onLeftClick?.();
      if (!playable) return;

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
    [playable, fen, selectedSquare, validMoves, props],
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
      const badgeClassification = isTo ? highlightSquares?.classification : undefined;
      const isBadge = badgeClassification != null;
      const isHint = hintSquare === square;
      const isFx = fx != null && fx.square === square;
      if (!isDot && !isBadge && !isHint && !isTo && !isFx && !isRightClicked) return <>{children}</>;

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
          ...((isTo || (isRightClicked && !isSlideSource)) ? { isolation: 'isolate' } : {}),
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
          {children}
          {isBadge && badgeClassification != null && (
            <div key={`badge-${fen}`} style={{ display: 'contents' }}>
              {renderClassificationBadge(badgeClassification)}
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
    [validMoves, highlightSquares, hintSquare, squareStyles, fx, fen, mtColor, rightClickedSquares, rightClickHighlightColor, animationDurationInMs],
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
      className={`relative aspect-square w-full ${className}`}
      style={{ '--board-slide-duration': `${animationDurationInMs}ms` } as React.CSSProperties}
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
          },
          lightSquareStyle: { backgroundColor: colors.light },
          darkSquareStyle: { backgroundColor: colors.dark },
          squareStyles,
          arrows: boardArrows,
          allowDragging: playable,
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
