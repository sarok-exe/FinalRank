import React, { memo, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { MoveClassification } from '../../types';
import { useSettingsStore } from '../../stores/settingsStore';
import { PieceIcon } from './PieceIcon';

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
}: ChessboardProps) {
  const { settings } = useSettingsStore();
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);

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
        badgeBg = 'bg-[#3182bd]';
        badgeText = '✓';
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

            let squareBg = isDark ? colors.dark : colors.light;

            if (isMoveTrail) {
              squareBg = isDark 
                ? 'bg-[rgba(247,215,108,0.65)]' 
                : 'bg-[rgba(247,215,108,0.85)]';
            }
            if (isSelected) {
              squareBg = 'bg-[rgba(255,170,0,0.55)]';
            }

            return (
              <div
                key={squareName}
                className={`relative w-full h-full flex items-center justify-center ${squareBg}`}
                onClick={() => handleSquareClick(squareName, piece)}
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

        {bestMoveArrow && (() => {
          const s = squareToPoint(bestMoveArrow.from);
          const e = squareToPoint(bestMoveArrow.to);
          return (
            <svg
              viewBox="0 0 100 100"
              className="absolute inset-0 w-full h-full pointer-events-none z-20"
            >
              <line
                x1={s.x} y1={s.y} x2={e.x} y2={e.y}
                stroke="#14b8a6"
                strokeWidth="1.8"
                strokeDasharray="5 4"
                strokeLinecap="round"
                className="opacity-85"
                style={{ animation: 'ch-arrow-dash 3s linear infinite' }}
              />
              <circle cx={e.x} cy={e.y} r="2.5" fill="#14b8a6" className="opacity-85" />
            </svg>
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
