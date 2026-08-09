import React, { useState } from 'react';

type Props = {
  name?: string;
  avatar?: string;
  size?: number;
};

export default function PlayerAvatar({ name, avatar, size = 22 }: Props) {
  const [failed, setFailed] = useState(false);
  const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?';
  if (avatar && !failed) {
    return (
      <img
        src={avatar}
        alt={name ?? 'player'}
        width={size}
        height={size}
        loading="lazy"
        onError={() => { setFailed(true); }}
        className="rounded-full object-cover border border-[var(--color-border)] shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center font-bold shrink-0"
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.42) }}
    >
      {initial}
    </div>
  );
}
