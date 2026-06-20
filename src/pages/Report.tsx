import React, { useState, useRef, useEffect } from 'react';
import { Bug, Send, CheckCircle, AlertTriangle, Mail, Shield, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import emailjs from '@emailjs/browser';
import { useAuthStore } from '../stores/authStore';
import { fetchUserProfile, updateUserProfile } from '../lib/firebase';

const STORAGE_KEY = 'finalrank_report_ts';
const RESET_HOURS = 24;

function getLastReportTs(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setLocalReportTs() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Date.now()));
}

function getRemainingSeconds(): number {
  const ts = getLastReportTs();
  if (!ts) return 0;
  const elapsed = Date.now() - ts;
  if (elapsed >= RESET_HOURS * 60 * 60 * 1000) {
    localStorage.removeItem(STORAGE_KEY);
    return 0;
  }
  return Math.ceil((RESET_HOURS * 60 * 60 * 1000 - elapsed) / 1000);
}

function formatCooldown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function Report() {
  const { user } = useAuthStore();
  const formRef = useRef<HTMLFormElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sent' | 'error' | 'rate-limited'>('idle');
  const [blocked, setBlocked] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    checkBlocked();
    const interval = setInterval(() => {
      setCooldown(getRemainingSeconds());
    }, 1000);
    return () => clearInterval(interval);
  }, [user]);

  async function checkBlocked() {
    const localTs = getLastReportTs();
    if (localTs && Date.now() - localTs < RESET_HOURS * 60 * 60 * 1000) {
      setBlocked(true);
      setCooldown(getRemainingSeconds());
      return;
    }
    if (user?.authProvider === 'google') {
      try {
        const profile = await fetchUserProfile(user.id);
        const fbTs = profile?.lastReportAt as unknown as { toMillis?: () => number } | undefined;
        if (fbTs?.toMillis) {
          const ms = fbTs.toMillis();
          if (Date.now() - ms < RESET_HOURS * 60 * 60 * 1000) {
            setLocalReportTs();
            setBlocked(true);
            setCooldown(getRemainingSeconds());
            return;
          }
        }
      } catch {}
    }
    setBlocked(false);
    setCooldown(0);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !user) return;

    if (honeypotRef.current?.value) return;

    if (blocked) {
      setStatus('rate-limited');
      return;
    }

    setSending(true);
    setStatus('idle');

    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

    async function saveReportTs() {
      setLocalReportTs();
      if (user.authProvider === 'google') {
        try {
          await updateUserProfile(user.id, { lastReportAt: new Date().toISOString() });
        } catch {}
      }
    }

    if (!serviceId || !templateId || !publicKey) {
      window.open(
        `mailto:finalrank@protonmail.com?subject=${encodeURIComponent(subject || 'FinalRank Feedback')}&body=${encodeURIComponent(
          `From: ${user.username} (${user.email || 'no email'})\n\n${message}`
        )}`,
        '_blank'
      );
      await saveReportTs();
      setBlocked(true);
      setCooldown(getRemainingSeconds());
      setSending(false);
      setStatus('sent');
      return;
    }

    try {
      await emailjs.sendForm(serviceId, templateId, formRef.current!, publicKey);
      await saveReportTs();
      setBlocked(true);
      setCooldown(getRemainingSeconds());
      setStatus('sent');
      setMessage('');
      setSubject('');
    } catch {
      setStatus('error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)] flex items-center justify-center">
          <Bug className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--color-text)] tracking-tight">Report an Issue</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Found a bug or have feedback? Let me know.</p>
        </div>
      </div>

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
        <AnimatePresence mode="wait">
          {status === 'sent' ? (
            <motion.div
              key="sent"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="text-center py-10 space-y-4"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 400, damping: 15 }}
                className="w-20 h-20 rounded-2xl bg-[var(--color-primary)] flex items-center justify-center mx-auto"
              >
                <CheckCircle className="w-10 h-10 text-white" />
              </motion.div>
              <motion.h2
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-xl font-extrabold text-[var(--color-text)]"
              >
                Thank you!
              </motion.h2>
              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-sm text-[var(--color-text-muted)] max-w-sm mx-auto"
              >
                Your report has been sent to{' '}
                <span className="text-[var(--color-primary)] font-semibold">finalrank@protonmail.com</span>.
                I'll review it as soon as possible.
              </motion.p>
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <button
                  onClick={() => setStatus('idle')}
                  className="text-xs text-[var(--color-accent)] hover:underline mt-2 inline-block"
                >
                  Send another report
                </button>
              </motion.div>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              ref={formRef}
              onSubmit={handleSubmit}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {blocked && (
                <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)] bg-[var(--color-background)] px-3 py-2 rounded-lg border border-[var(--color-border)]">
                  <Clock className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Next report available in {formatCooldown(cooldown)}</span>
                </div>
              )}

              {!user && (
                <div className="flex items-start gap-2.5 bg-[var(--color-background)] border border-[#d65d0e] rounded-xl p-3">
                  <AlertTriangle className="w-4 h-4 text-[#d65d0e] shrink-0 mt-0.5" />
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Sign in with Google on the <a href="/profile" className="text-[var(--color-primary)] underline">Profile</a> page so I can follow up if needed.
                  </p>
                </div>
              )}

              <div className="absolute opacity-0 pointer-events-none" aria-hidden="true">
                <input type="text" name="website" ref={honeypotRef} tabIndex={-1} autoComplete="off" />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5 uppercase tracking-wider">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Brief summary of the issue..."
                  className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5 uppercase tracking-wider">Message</label>
                <textarea
                  required
                  rows={8}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Describe the issue in detail. What were you doing? What happened? What did you expect?"
                  className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)] transition-colors resize-y"
                />
              </div>

              {user && (
                <input type="hidden" name="from_name" value={user.username} />
              )}
              {user?.email && (
                <input type="hidden" name="from_email" value={user.email} />
              )}
              <input type="hidden" name="to_email" value="finalrank@protonmail.com" />
              <input type="hidden" name="message" value={message} />

              {status === 'error' && (
                <div className="flex items-start gap-2.5 bg-[var(--color-background)] border border-[#8b1a1a] rounded-xl p-3">
                  <AlertTriangle className="w-4 h-4 text-[#8b1a1a] shrink-0 mt-0.5" />
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Failed to send. Try again or email <span className="font-mono text-[var(--color-text)]">finalrank@protonmail.com</span> directly.
                  </p>
                </div>
              )}

              {blocked && (
                <div className="flex items-start gap-2.5 bg-[var(--color-background)] border border-[#8b1a1a] rounded-xl p-3">
                  <Clock className="w-4 h-4 text-[#8b1a1a] shrink-0 mt-0.5" />
                  <p className="text-xs text-[var(--color-text-muted)]">
                    You can send 1 report per 24 hours. Next report available in{' '}
                    <span className="font-mono text-[var(--color-text)]">{formatCooldown(cooldown)}</span>.
                    Please email <span className="font-mono text-[var(--color-text)]">finalrank@protonmail.com</span> directly if it's urgent.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={sending || !message.trim() || !user || blocked}
                className="w-full bg-[var(--color-primary)] text-white px-6 py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                <span>{sending ? 'Sending...' : 'Send Report'}</span>
              </button>

              <p className="text-[10px] text-[var(--color-text-muted)] text-center">
                Sent to <span className="font-mono">finalrank@protonmail.com</span>
              </p>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <Mail className="w-5 h-5 text-[var(--color-accent)] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[var(--color-text)]">Prefer email?</h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              Write directly to{' '}
              <a href="mailto:finalrank@protonmail.com" className="text-[var(--color-primary)] underline font-mono">
                finalrank@protonmail.com
              </a>
              {' '}and I'll get back to you as soon as possible.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
