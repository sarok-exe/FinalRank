/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState } from 'react';
import { User as UserIcon } from 'lucide-react';

type Props = {
  readonly avatar: string;
  readonly username: string;
  readonly size?: number;
};

export default function CommunityAvatar({ avatar, username, size = 36 }: Props): React.ReactElement {
  const [failed, setFailed] = useState(false);

  if (avatar !== '' && !failed) {
    return (
      <img
        src={avatar}
        alt={username}
        loading="lazy"
        onError={() => { setFailed(true); }}
        className="rounded-full object-cover border border-[var(--color-border)] shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full bg-[var(--color-primary)]/15 border border-[var(--color-border)] flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <UserIcon
        className="text-[var(--color-text-muted)]"
        style={{ width: Math.round(size * 0.45), height: Math.round(size * 0.45) }}
      />
    </div>
  );
}
