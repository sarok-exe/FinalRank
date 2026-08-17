/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { ArrowLeft, MessageSquare, Globe, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const socialLinks = [
  {
    name: 'Telegram',
    username: 'sarok_ibnx',
    url: 'https://t.me/sarok_ibnx',
    icon: MessageSquare,
    color: '#0088cc',
  },
  {
    name: 'Reddit',
    username: 'sarok_ibnx',
    url: 'https://reddit.com/u/sarok_ibnx',
    icon: Globe,
    color: '#ff4500',
  },
] as const;

export default function Report(): React.JSX.Element {
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => { navigate(-1); }}
          className="w-10 h-10 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center hover:bg-[var(--color-background)] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[var(--color-text)]" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--color-text)] tracking-tight">
            Get in Touch
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Reach out on any of these platforms.
          </p>
        </div>
      </div>

      {/* Social cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {socialLinks.map((link) => {
          const Icon = link.icon;
          return (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 flex flex-col items-center gap-4 text-center hover:border-[var(--color-accent)] transition-colors"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: `${link.color}20` }}
              >
                <Icon className="w-7 h-7" style={{ color: link.color }} />
              </div>

              <div className="space-y-1">
                <h2 className="text-base font-bold text-[var(--color-text)]">
                  {link.name}
                </h2>
                <p className="text-sm text-[var(--color-text-muted)] font-mono">
                  {link.username}
                </p>
              </div>

              <span className="mt-auto inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-accent)] group-hover:underline">
                Open
                <ExternalLink className="w-3 h-3" />
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
