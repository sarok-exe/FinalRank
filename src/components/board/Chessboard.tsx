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
  bestMoveArrow?: { from: string; to: string };
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
  premoveEnabled?: boolean;
  premoveColor?: 'w' | 'b';
  canDragPiece?: boolean;
  onPremoveChange?: (premove: { from: string; to: string } | null) => void;
  hypothesisActive?: boolean;
  hypothesisBaseIndex?: number;
};

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

const CUSTOM_PIECES: PieceRenderObject = {
  wK: () => <PieceIcon type="k" color="w" />,
  wQ: () => <PieceIcon type="q" color="w" />,
  wR: () => <PieceIcon type="r" color="w" />,
  wB: () => <PieceIcon type="b" color="w" />,
  wN: () => <PieceIcon type="n" color="w" />,
  wP: () => <PieceIcon type="p" color="w" />,
  bK: () => <PieceIcon type="k" color="b" />,
  bQ: () => <PieceIcon type="q" color="b" />,
  bR: () => <PieceIcon type="r" color="b" />,
  bB: () => <PieceIcon type="b" color="b" />,
  bN: () => <PieceIcon type="n" color="b" />,
  bP: () => <PieceIcon type="p" color="b" />,
};

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
        top: '3px',
        right: '3px',
        width: 'min(36px, 50%)',
        height: 'min(36px, 50%)',
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
    hypothesisActive,
    hypothesisBaseIndex,
  } = props;
  const { settings } = useSettingsStore();
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);
  // Badge latched — survives transient gaps in highlightSquares.
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

  const pieceMap = useMemo(() => {
    const FEN_FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const FEN_RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];
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
  }, [fen]);

  // Badge latch — kept in sync with the latest valid classification.
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
    setLastBadge(null);
  }

  const colors = THEME_COLORS[settings.boardColor] ?? THEME_COLORS.green;
  const rcColor = settings.rightClickHighlightColor ?? settings.highlightColors.rightClick ?? '#e53935';
  const { moveTrail: mtColor, selectedSquare: ssColor } = settings.highlightColors;

  const isDraggable = playable || premoveEnabled;
  const draggableColor: 'w' | 'b' | null = !playable && premoveEnabled ? premoveColor : null;
  // Suppress the "unused" warning — draggableColor is kept for future use.
  void draggableColor;

  const canDragPiece = useCallback((args: PieceHandlerArgs): boolean => {
    if (playable) return true;
    if (!premoveEnabled) return false;
    if (args.isSparePiece) return true;
    const pieceColor = args.piece.pieceType[0];
    return premoveColor == null || pieceColor === premoveColor;
  }, [playable, premoveEnabled, premoveColor]);

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
    // Right-click markers as simple background tints (old approach).
    for (const sq of rightClickedSquares) {
      setBg(sq, hexToRgba(rcColor, isDarkSquare(sq, orientation) ? 0.55 : 0.40));
    }
    return styles;
  }, [highlightSquares, selectedSquare, hintSquare, orientation, mtColor, ssColor, rightClickedSquares, rcColor]);

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

  const canPremovePiece = useCallback((square: string): boolean => {
    const piece = pieceMap[square];
    return piece != null && (premoveColor == null || piece[0] === premoveColor);
  }, [pieceMap, premoveColor]);

  const handlePremoveClick = useCallback((square: string) => {
    const piece = pieceMap[square];
    if (premoveFromRef.current != null) {
      if (square === premoveFromRef.current) {
        clearPremoveSelection();
        return;
      }
      if (piece != null && (premoveColor == null || piece[0] === premoveColor)) {
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
      if (targetSquare == null) return false;
      if (!playable) {
        if (premoveEnabled && sourceSquare !== targetSquare && canPremovePiece(sourceSquare)) {
          queuePremove({ from: sourceSquare, to: targetSquare });
        }
        return false;
      }
      if (sourceSquare === targetSquare) return false;
      const accepted = props.onMove?.(sourceSquare, targetSquare);
      return accepted !== false;
    },
    [playable, props, premoveEnabled, canPremovePiece, queuePremove],
  );

  // A queued premove only survives while it stays legal in the current position.
  useEffect(() => {
    const pm = premoveRef.current;
    if (pm == null) return;
    if (!isLegalMoveInFen(fen, pm.from, pm.to)) clearPremove();
  }, [fen, clearPremove]);

  // The board just became playable again: fire any queued premove instantly.
  useEffect(() => {
    const wasPlayable = prevPlayableRef.current;
    prevPlayableRef.current = playable;
    if (wasPlayable || !playable) return;
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
    onMoveRef.current?.(pm.from, pm.to);
  }, [playable, fen]);

  // If premove support is switched off, drop any queued premove.
  useEffect(() => {
    if (premoveEnabledRef.current || premoveRef.current == null) return;
    premoveRef.current = null;
    setPremove(null);
    onPremoveChangeRef.current?.(null);
  }, [premoveEnabled]);

  // Escape cancels an in-flight premove selection or a queued premove.
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
      const isBadge = lastBadge?.square === square;
      const isHint = hintSquare === square;
      if (!isDot && !isBadge && !isHint && !isTo) return <>{children}</>;

      return (
        <div style={{ width: '100%', height: '100%', position: 'relative', ...(squareStyles[square] ?? {}) }}>
          {children}
          {isBadge && lastBadge != null && (
            <div key={`badge-${lastBadge.fen}-${lastBadge.square}-${lastBadge.classification}`} style={{ display: 'contents' }}>
              {renderClassificationBadge(lastBadge.classification)}
            </div>
          )}
          {isHint && (
            <div className="animate-pulse" style={{
              position: 'absolute', inset: '6%', borderRadius: '50%',
              border: '4px solid #fbbf24', boxShadow: '0 0 14px rgba(251, 191, 36, 0.8)',
              pointerEvents: 'none', zIndex: 12,
            }} />
          )}
          {isDot && !children && (
            <div style={{
              width: '28%', height: '28%', borderRadius: '50%',
              backgroundColor: 'rgba(0,0,0,0.25)',
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none', zIndex: 10,
            }} />
          )}
          {isDot && children && (
            <div style={{
              width: '82%', height: '82%', borderRadius: '50%',
              border: '4px solid rgba(0,0,0,0.2)',
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none', zIndex: 10,
            }} />
          )}
        </div>
      );
    },
    [validMoves, highlightSquares, hintSquare, squareStyles, lastBadge],
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
        minWidth: 0,
        minHeight: 0,
      } as React.CSSProperties}
    >
      <RCChessboard
        key={hypothesisActive ? `hyp-${hypothesisBaseIndex}` : undefined}
        options={{
          id: 'finalrank',
          position: fen,
          pieces: CUSTOM_PIECES,
          boardOrientation: orientation,
          boardStyle: {
            border: '4px solid var(--color-surface)',
            borderRadius: '8px',
            overflow: 'visible',
          },
          lightSquareStyle: { backgroundColor: colors.light },
          darkSquareStyle: { backgroundColor: colors.dark },
          squareStyles,
          arrows: boardArrows,
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
