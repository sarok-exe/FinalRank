import { memo } from 'react';

interface PieceIconProps {
  type: string;
  color: 'w' | 'b';
}

const SPRITE_URL = '/img/pieces/standard.svg';

const PIECE_MAP: Record<string, string> = {
  k: 'k',
  q: 'q',
  r: 'r',
  b: 'b',
  n: 'n',
  p: 'p',
};

export const PieceIcon = memo(function PieceIcon({ type, color }: PieceIconProps) {
  const id = color + (PIECE_MAP[type.toLowerCase()] || type.toLowerCase());

  return (
    <svg viewBox="0 0 40 40" className="w-full h-full select-none drop-shadow">
      <use href={`${SPRITE_URL}#${id}`} />
    </svg>
  );
});
