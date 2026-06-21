import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { MoveClassification } from '../../types';
import { useSettingsStore } from '../../stores/settingsStore';
import { PieceIcon } from './PieceIcon';

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
  arrows?: Arrow[];
  onArrowsChange?: (arrows: Arrow[]) => void;
  winnerOverlay?: boolean;
  winnerSide?: 'w' | 'b';
  checkmateOverlay?: boolean;
  checkmateSide?: 'w' | 'b';
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

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
  const [internalArrows, setInternalArrows] = useState<Arrow[]>([]);
  const [drawingArrow, setDrawingArrow] = useState<{ from: string; to: string } | null>(null);
  const drawingStartRef = useRef<string | null>(null);
  const drewArrowRef = useRef(false);
  const boardRef = useRef<HTMLDivElement>(null);

  const fenParts = fen.split(' ');
  const positionPart = fenParts[0];

  const rows = positionPart.split('/');
  const boardGrid: ({ type: string; color: 'w' | 'b' } | null)[][] = rows.map((row) => {
    const squares: ({ type: string; color: 'w' | 'b' } | null)[] = [];
    for (let char of row) {
      if (/\d/.test(char)) {
        for (let i = 0; i < parseInt(char, 10); i++) {
          squares.push(null);
        }
      } else {
        squares.push({
          type: char.toLowerCase(),
          color: char === char.toUpperCase() ? 'w' : 'b'
        });
      }
    }
    return squares;
  });

  const getThemeClasses = () => {
    switch (settings.boardColor) {
      case 'elegant':
        return {
          light: 'bg-[#B0B0B0] text-[#1A1A1A]',
          dark: 'bg-[#4D4D4D] text-[#B0B0B0]',
        };
      case 'blue':
        return {
          light: 'bg-[#e9edf6] text-[#4b73be]',
          dark: 'bg-[#4b73be] text-[#e9edf6]',
        };
      case 'brown':
        return {
          light: 'bg-[#f0d9b5] text-[#b58863]',
          dark: 'bg-[#b58863] text-[#f0d9b5]',
        };
      case 'charcoal':
        return {
          light: 'bg-[#e8ebef] text-[#4d5d75]',
          dark: 'bg-[#4d5d75] text-[#e8ebef]',
        };
      case 'ocean-sunset':
        return {
          light: 'bg-[#F2E8CF] text-[#0A9396]',
          dark: 'bg-[#0A9396] text-[#F2E8CF]',
        };
      case 'fresh-greens':
        return {
          light: 'bg-[#F2E8CF] text-[#6A994E]',
          dark: 'bg-[#6A994E] text-[#F2E8CF]',
        };
      case 'cherry-blossom':
        return {
          light: 'bg-[#FFCCD5] text-[#C9184A]',
          dark: 'bg-[#C9184A] text-[#FFCCD5]',
        };
      case 'golden-blue':
        return {
          light: 'bg-[#FFF3B0] text-[#003566]',
          dark: 'bg-[#003566] text-[#FFF3B0]',
        };
      case 'pine-forest':
        return {
          light: 'bg-[#EDEDE9] text-[#3A5A40]',
          dark: 'bg-[#3A5A40] text-[#EDEDE9]',
        };
      case 'coastal':
        return {
          light: 'bg-[#CAF0F8] text-[#0077B6]',
          dark: 'bg-[#0077B6] text-[#CAF0F8]',
        };
      case 'amber-glow':
        return {
          light: 'bg-[#FEFAE0] text-[#D62828]',
          dark: 'bg-[#D62828] text-[#FEFAE0]',
        };
      case 'soft-sand':
        return {
          light: 'bg-[#F5EBE0] text-[#A9927D]',
          dark: 'bg-[#A9927D] text-[#F5EBE0]',
        };
      case 'green':
      default:
        return {
          light: 'bg-[#eedcbf] text-[#769656]',
          dark: 'bg-[#769656] text-[#eedcbf]',
        };
    }
  };

  const colors = getThemeClasses();

  const isHighlighted = (squareName: string) => {
    if (!highlightSquares) return false;
    return highlightSquares.from === squareName || highlightSquares.to === squareName;
  };

  const handleSquareClick = (squareName: string, piece: { type: string; color: 'w' | 'b' } | null) => {
    if (!playable) return;

    if (selectedSquare && validMoves.includes(squareName)) {
      if (onMove) {
        onMove(selectedSquare, squareName);
      }
      setSelectedSquare(null);
      setValidMoves([]);
      return;
    }

    if (piece) {
      try {
        const chess = new Chess(fen);
        const legalDestinations = chess
          .moves({ square: squareName as any, verbose: true })
          .map((m) => m.to);

        setSelectedSquare(squareName);
        setValidMoves(legalDestinations);
      } catch {
        setSelectedSquare(null);
        setValidMoves([]);
      }
    } else {
      setSelectedSquare(null);
      setValidMoves([]);
    }
  };

  const renderClassificationBadge = (cls?: MoveClassification) => {
    if (!cls) return null;

    let badgeBg = 'bg-gray-500';
    let badgeText = '★';
    let iconPath: string | undefined;

    switch (cls) {
      case 'brilliant':
        badgeBg = 'bg-[#1baca6]';
        iconPath = '/img/classifications/brilliant.svg';
        break;
      case 'excellent':
        badgeBg = 'bg-[#31a354]';
        iconPath = '/img/classifications/excellent.svg';
        break;
      case 'best':
        badgeBg = 'bg-[#47a829]';
        iconPath = '/img/classifications/best.svg';
        break;
      case 'good':
      case 'okay':
        badgeBg = 'bg-[#3182bd]';
        iconPath = '/img/classifications/good.svg';
        break;
      case 'inaccuracy':
        badgeBg = 'bg-[#f0a600]';
        iconPath = '/img/classifications/inaccuracy.svg';
        break;
      case 'mistake':
        badgeBg = 'bg-[#e6550d]';
        iconPath = '/img/classifications/mistake.svg';
        break;
      case 'blunder':
        badgeBg = 'bg-[#de2d26]';
        iconPath = '/img/classifications/blunder.svg';
        break;
      case 'forced':
        badgeBg = 'bg-[#636363]';
        iconPath = '/img/classifications/forced.svg';
        break;
      case 'book':
        badgeBg = 'bg-[#a88764]';
        iconPath = '/img/classifications/book.svg';
        break;
      case 'critical':
        badgeBg = 'bg-[#5b8baf]';
        iconPath = '/img/classifications/critical.svg';
        break;
      default:
        return null;
    }

    return iconPath ? (
      <img src={iconPath} alt={cls} className="absolute -top-2 -right-2 w-7 h-7 z-10" title={`Move classified as ${cls}`} />
    ) : (
      <div
        className={`absolute -top-2 -right-2 ${badgeBg} text-white font-bold text-[9px] w-5 h-5 rounded-full flex items-center justify-center z-10`}
        title={`Move classified as ${cls}`}
      >
        {badgeText}
      </div>
    );
  };

  const squareToPoint = (sq: string) => {
    const f = sq.charCodeAt(0) - 97;
    const r = 8 - parseInt(sq[1]);
    const x = flipped ? 100 - (f + 0.5) * 12.5 : (f + 0.5) * 12.5;
    const y = flipped ? 100 - (r + 0.5) * 12.5 : (r + 0.5) * 12.5;
    return { x, y };
  };

  const flipped = orientation === 'black';
  const displayRows = flipped
    ? [...boardGrid].reverse().map(r => [...r].reverse())
    : boardGrid;

  return (
    <div className={`relative aspect-square w-full ${className}`}>
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full rounded-lg bg-[var(--color-surface)] border-4 border-[#2a2a2a] overflow-hidden relative select-none">
        
        {displayRows.map((rowArr, rowIndex) => {
          return rowArr.map((piece, colIndex) => {
            const logicalRowIndex = flipped ? 7 - rowIndex : rowIndex;
            const logicalColIndex = flipped ? 7 - colIndex : colIndex;
            const squareName = `${FILES[logicalColIndex]}${RANKS[logicalRowIndex]}`;
            const isDark = (rowIndex + colIndex) % 2 === 1;
            const isSelected = selectedSquare === squareName;
            const isValidDest = validMoves.includes(squareName);
            const isMoveTrail = isHighlighted(squareName);
            const isRightClicked = rightClickedSquares.includes(squareName);

            let squareBg = isDark ? colors.dark : colors.light;

            if (isMoveTrail) {
              squareBg = isDark 
                ? 'bg-[rgba(247,215,108,0.65)]' 
                : 'bg-[rgba(247,215,108,0.85)]';
            }
            if (isSelected) {
              squareBg = 'bg-[rgba(255,170,0,0.55)]';
            }
            if (isRightClicked) {
              squareBg = 'bg-[rgba(100,200,255,0.45)]';
            }

            return (
              <div
                key={squareName}
                className={`relative w-full h-full flex items-center justify-center ${squareBg}`}
                onClick={() => handleSquareClick(squareName, piece)}
                onMouseDown={(e) => {
                  if (e.button === 2) {
                    drawingStartRef.current = squareName;
                    setDrawingArrow({ from: squareName, to: squareName });
                  }
                  if (e.button === 0) {
                    setInternalArrows([]);
                    onArrowsChange?.([]);
                  }
                }}
                onMouseOver={(e) => {
                  if (e.buttons === 2 && drawingStartRef.current) {
                    setDrawingArrow({ from: drawingStartRef.current, to: squareName });
                  }
                }}
                onMouseUp={(e) => {
                  if (e.button === 2 && drawingStartRef.current) {
                    if (drawingStartRef.current !== squareName) {
                      const from = drawingStartRef.current;
                      const newArr = { from, to: squareName, color: '#ffaa00' };
                      setInternalArrows(prev => {
                        const exists = prev.some(a => a.from === from && a.to === squareName);
                        const next = exists
                          ? prev.filter(a => !(a.from === from && a.to === squareName))
                          : [...prev, newArr];
                        onArrowsChange?.(next);
                        return next;
                      });
                      drewArrowRef.current = true;
                    }
                    drawingStartRef.current = null;
                    setDrawingArrow(null);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (drewArrowRef.current) {
                    drewArrowRef.current = false;
                  } else if (onSquareRightClick) {
                    onSquareRightClick(squareName);
                  }
                }}
              >
                {settings.featureToggles.showCoordinates && (
                  <>
                    {colIndex === 0 && (
                      <span className="absolute top-1 left-1 font-semibold opacity-60 leading-none"
                        style={{ fontSize: `${Math.max(settings.coordinatesSize, 6)}px` }}>
                        {RANKS[flipped ? 7 - rowIndex : rowIndex]}
                      </span>
                    )}
                    {rowIndex === 7 && (
                      <span className="absolute bottom-1 right-1 font-semibold opacity-60 leading-none"
                        style={{ fontSize: `${Math.max(settings.coordinatesSize, 6)}px` }}>
                        {FILES[flipped ? 7 - colIndex : colIndex]}
                      </span>
                    )}
                  </>
                )}

                {highlightSquares?.to === squareName && renderClassificationBadge(highlightSquares.classification)}

                {piece && (
                  <div className="w-[88%] h-[88%] z-5 select-none">
                    <PieceIcon type={piece.type} color={piece.color} />
                  </div>
                )}

                {isValidDest && !piece && (
                  <div className="w-3.5 h-3.5 rounded-full bg-black/25 absolute z-10 pointer-events-none" />
                )}
                {isValidDest && piece && (
                  <div className="w-[82%] h-[82%] border-4 border-black/20 rounded-full absolute z-10 pointer-events-none" />
                )}
              </div>
            );
          });
        })}

        {[...internalArrows, ...(drawingArrow ? [drawingArrow] : [])].map((arr, i) => {
          const s = squareToPoint(arr.from);
          const e = squareToPoint(arr.to);
          const color = (arr as Arrow).color || '#ffaa00';
          const isDrawing = drawingArrow?.from === arr.from && drawingArrow?.to === arr.to;
          return (
            <svg key={i} viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none z-20">
              <defs>
                <marker id={`arrowhead-${i}`} markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto" markerUnits="userSpaceOnUse">
                  <polygon points="0 0, 6 2, 0 4" fill={color} />
                </marker>
              </defs>
              <line
                x1={s.x} y1={s.y} x2={e.x} y2={e.y}
                stroke={color}
                strokeWidth={isDrawing ? 2 : 1.5}
                strokeLinecap="round"
                markerEnd={`url(#arrowhead-${i})`}
                opacity={isDrawing ? 0.5 : 0.7}
              />
            </svg>
          );
        })}
        {winnerOverlay && winnerSide && (() => {
          const sq = findKingSquare(fen, winnerSide);
          if (!sq) return null;
          const f = sq.charCodeAt(0) - 97;
          const r = 8 - parseInt(sq[1]);
          const lf = flipped ? 7 - f : f;
          const lr = flipped ? 7 - r : r;
          return (
            <div className="absolute inset-0 pointer-events-none z-30" style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gridTemplateRows: 'repeat(8, 1fr)' }}>
              <div style={{ gridRow: lr + 1, gridColumn: lf + 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/img/classifications/winner.svg" alt="winner" className="w-[55%] h-[55%] drop-shadow-lg" />
              </div>
            </div>
          );
        })()}
        {checkmateOverlay && checkmateSide && (() => {
          const sq = findKingSquare(fen, checkmateSide);
          if (!sq) return null;
          const f = sq.charCodeAt(0) - 97;
          const r = 8 - parseInt(sq[1]);
          const lf = flipped ? 7 - f : f;
          const lr = flipped ? 7 - r : r;
          const icon = checkmateSide === 'w' ? '/img/classifications/checkmate_white.svg' : '/img/classifications/checkmate_black.svg';
          return (
            <div className="absolute inset-0 pointer-events-none z-30" style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gridTemplateRows: 'repeat(8, 1fr)' }}>
              <div style={{ gridRow: lr + 1, gridColumn: lf + 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={icon} alt="checkmate" className="w-[55%] h-[55%] drop-shadow-lg" />
              </div>
            </div>
          );
        })()}
      </div>
      <style>{`
        @keyframes ch-arrow-dash {
          to { stroke-dashoffset: -18; }
        }
      `}</style>
    </div>
  );
});

export default Chessboard;
