import { memo, useCallback, useMemo, useState } from 'react';
import { Chessboard as RCChessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { MoveClassification } from '../../types';
import { useSettingsStore } from '../../stores/settingsStore';
import { PieceIcon } from './PieceIcon';
import type { PieceRenderObject } from 'react-chessboard';

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

interface ChessboardProps {
  fen: string;
  onMove?: (from: string, to: string) => void;
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
  rightClickedSquares?: string[];
  onSquareRightClick?: (square: string) => void;
  onLeftClick?: () => void;
  arrows?: Arrow[];
  onArrowsChange?: (arrows: Arrow[]) => void;
  winnerOverlay?: boolean;
  winnerSide?: 'w' | 'b';
  checkmateOverlay?: boolean;
  checkmateSide?: 'w' | 'b';
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

function isDarkSquare(square: string, orientation: 'white' | 'black'): boolean {
  const file = square.charCodeAt(0) - 97;
  const rank = 8 - parseInt(square[1]);
  const dr = orientation === 'black' ? 7 - rank : rank;
  const dc = orientation === 'black' ? 7 - file : file;
  return (dr + dc) % 2 === 1;
}

function renderClassificationBadge(cls: MoveClassification) {
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
    default: return null;
  }

  return (
    <img
      src={iconPath}
      alt={cls}
      style={{
        position: 'absolute', top: '-8px', right: '-8px',
        width: '28px', height: '28px', zIndex: 10,
      }}
      title={`Move classified as ${cls}`}
    />
  );
}

const Chessboard = memo(function Chessboard({
  fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  onMove,
  playable = true,
  orientation = 'white',
  className = '',
  highlightSquares,
  bestMoveArrow,
  rightClickedSquares = [],
  onSquareRightClick,
  onLeftClick,
  arrows = [],
  onArrowsChange,
  winnerOverlay = false,
  winnerSide,
  checkmateOverlay = false,
  checkmateSide,
}: ChessboardProps) {
  const { settings } = useSettingsStore();
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);

  const colors = THEME_COLORS[settings.boardColor] || THEME_COLORS.green;

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    const setBg = (sq: string, bg: string) => {
      styles[sq] = { ...styles[sq], background: bg };
    };
    if (highlightSquares?.from) {
      setBg(highlightSquares.from,
        isDarkSquare(highlightSquares.from, orientation)
          ? 'rgba(247,215,108,0.65)' : 'rgba(247,215,108,0.85)');
    }
    if (highlightSquares?.to) {
      setBg(highlightSquares.to,
        isDarkSquare(highlightSquares.to, orientation)
          ? 'rgba(247,215,108,0.65)' : 'rgba(247,215,108,0.85)');
    }
    if (selectedSquare) {
      setBg(selectedSquare, 'rgba(255,170,0,0.55)');
    }
    for (const sq of rightClickedSquares) {
      setBg(sq,
        isDarkSquare(sq, orientation)
          ? 'rgba(0,48,136,0.55)' : 'rgba(0,48,136,0.40)');
    }
    return styles;
  }, [highlightSquares, selectedSquare, rightClickedSquares, orientation]);

  const boardArrows = useMemo(() => {
    const result: { startSquare: string; endSquare: string; color: string }[] = [];
    for (const a of arrows) {
      result.push({ startSquare: a.from, endSquare: a.to, color: a.color || '#ffaa00' });
    }
    if (bestMoveArrow) {
      result.push({ startSquare: bestMoveArrow.from, endSquare: bestMoveArrow.to, color: '#00a000' });
    }
    return result;
  }, [arrows, bestMoveArrow]);

  const handlePieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
      if (!playable || !targetSquare) return false;
      onMove?.(sourceSquare, targetSquare);
      return true;
    },
    [playable, onMove],
  );

  const handleSquareClick = useCallback(
    ({ square }: { square: string }) => {
      onLeftClick?.();
      if (!playable) return;

      if (selectedSquare && validMoves.includes(square)) {
        if (onMove) onMove(selectedSquare, square);
        setSelectedSquare(null);
        setValidMoves([]);
        return;
      }

      try {
        const chess = new Chess(fen);
        const piece = chess.get(square as any);
        if (piece) {
          const moves = chess.moves({ square: square as any, verbose: true }).map(m => m.to);
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
    [playable, fen, selectedSquare, validMoves, onMove, onLeftClick],
  );

  const handleSquareRightClick = useCallback(
    ({ square }: { square: string }) => { onSquareRightClick?.(square); },
    [onSquareRightClick],
  );

  const handleArrowsChange = useCallback(
    ({ arrows: libArrows }: { arrows: { startSquare: string; endSquare: string; color: string }[] }) => {
      const converted = libArrows.map(a => ({ from: a.startSquare, to: a.endSquare, color: a.color }));
      onArrowsChange?.(converted);
    },
    [onArrowsChange],
  );

  const squareRenderer = useCallback(
    ({ square, children }: { square: string; children?: React.ReactNode }) => {
      const isDot = validMoves.includes(square);
      const isBadge = highlightSquares?.to === square && highlightSquares?.classification;
      if (!isDot && !isBadge) return null;

      const hasPiece = children != null;
      return (
        <div style={{ width: '100%', height: '100%', position: 'relative', ...(squareStyles[square] || {}) }}>
          {children}
          {isBadge && renderClassificationBadge(highlightSquares!.classification!)}
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
        </div>
      );
    },
    [validMoves, highlightSquares, squareStyles],
  );

  const renderSquareOverlay = (kingSquare: string, icon: string) => {
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
    <div className={`relative aspect-square w-full ${className}`}>
      <RCChessboard
        options={{
          id: 'finalrank',
          position: fen,
          pieces: CUSTOM_PIECES,
          boardOrientation: orientation,
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
          showAnimations: false,
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
      {winnerOverlay && winnerSide && (() => {
        const sq = findKingSquare(fen, winnerSide);
        return sq ? renderSquareOverlay(sq, '/img/classifications/winner.svg') : null;
      })()}
      {checkmateOverlay && checkmateSide && (() => {
        const sq = findKingSquare(fen, checkmateSide);
        const icon = checkmateSide === 'w'
          ? '/img/classifications/checkmate_white.svg'
          : '/img/classifications/checkmate_black.svg';
        return sq ? renderSquareOverlay(sq, icon) : null;
      })()}
    </div>
  );
});

export default Chessboard;
