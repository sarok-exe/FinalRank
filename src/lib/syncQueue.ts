/**
 * Batched Firestore sync queue.
 *
 * Writes are queued in-memory and persisted to localStorage under
 * `finalrank-sync-queue`. They are flushed to Firestore periodically
 * (~12 h + per-user random offset) or when the tab regains visibility.
 *
 * Dedup: same `id` means latest write wins.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SyncPriority = 'high' | 'medium' | 'low';

export interface SyncEntry {
  id: string; // unique key, e.g. `profile:${uid}`, `fav:${uid}:${gameId}`
  priority: SyncPriority;
  collection: string; // Firestore collection path segment
  document: string; // Firestore document ID within collection
  data: Record<string, unknown>;
  merge: boolean;
  timestamp: number;
}

/** Internal shape stored in localStorage (array of SyncEntry). */
type SyncQueue = SyncEntry[];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUEUE_KEY = 'finalrank-sync-queue';
const OFFSET_KEY = 'finalrank-sync-offset';
const LAST_FLUSH_KEY = 'finalrank-sync-last-flush';

const SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function readQueue(): SyncQueue {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SyncQueue;
  } catch {
    return [];
  }
}

function writeQueue(queue: SyncQueue): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage full — silently drop (non-critical)
  }
}

// ---------------------------------------------------------------------------
// Offset & timing
// ---------------------------------------------------------------------------

export function getUserOffset(): number {
  try {
    const stored = localStorage.getItem(OFFSET_KEY);
    if (stored !== null) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  const newOffset = Math.floor(Math.random() * 30); // 0-29 minutes
  try {
    localStorage.setItem(OFFSET_KEY, String(newOffset));
  } catch { /* ignore */ }
  return newOffset;
}

export function shouldFlush(): boolean {
  try {
    const lastFlush = parseInt(localStorage.getItem(LAST_FLUSH_KEY) || '0', 10);
    const offset = getUserOffset();
    const elapsed = Date.now() - lastFlush;
    return elapsed >= SYNC_INTERVAL_MS + offset * 60 * 1000;
  } catch {
    return true; // if we can't read, flush to be safe
  }
}

function recordFlushTime(): void {
  try {
    localStorage.setItem(LAST_FLUSH_KEY, String(Date.now()));
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Queue API
// ---------------------------------------------------------------------------

/** Add or replace a write in the queue.  Latest write for the same id wins. */
export function queueWrite(entry: SyncEntry): void {
  const queue = readQueue();
  const idx = queue.findIndex(e => e.id === entry.id);
  if (idx >= 0) {
    queue[idx] = entry; // overwrite
  } else {
    queue.push(entry);
  }
  writeQueue(queue);
}

/** Remove specific entries from the queue (called after successful flush). */
export function removeEntries(ids: string[]): void {
  if (ids.length === 0) return;
  const idSet = new Set(ids);
  const queue = readQueue().filter(e => !idSet.has(e.id));
  writeQueue(queue);
}

/** Replace the entire queue (e.g. after a flush that keeps some failed entries). */
export function replaceQueue(queue: SyncQueue): void {
  writeQueue(queue);
}

/** Read-only snapshot of the current queue. */
export function getQueueSnapshot(): SyncEntry[] {
  return readQueue();
}

/** Number of pending entries. */
export function pendingCount(): number {
  return readQueue().length;
}

// ---------------------------------------------------------------------------
// Flush orchestration
// ---------------------------------------------------------------------------

// Lazy import to avoid circular deps — resolved at call time.
let _flushFn: (() => Promise<void>) | null = null;

export function registerFlusher(fn: () => Promise<void>): void {
  _flushFn = fn;
}

/** Trigger a flush if the flusher is registered and there's work to do. */
export async function flushQueue(): Promise<void> {
  if (!_flushFn) return;
  if (readQueue().length === 0) return;
  try {
    await _flushFn();
    recordFlushTime();
  } catch (e) {
    console.warn('[SyncQueue] flushQueue failed:', e);
  }
}

// ---------------------------------------------------------------------------
// Visibility listener
// ---------------------------------------------------------------------------

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && shouldFlush()) {
      flushQueue();
    }
  });
}
