/**
 * Flush pending sync-queue entries to Firestore using writeBatch.
 *
 * This module is separate from syncQueue.ts so that the queue module
 * stays free of Firestore SDK imports (avoids circular deps).
 */

import { writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import {
  initFirestore,
  noteFirestoreSuccess,
  noteFirestoreFailure,
  withTimeout,
  sanitizeFirestoreData,
  isFirestoreDisabled,
} from './firebase';
import {
  getQueueSnapshot,
  replaceQueue,
  registerFlusher,
  type SyncEntry,
} from './syncQueue';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIRESTORE_BATCH_LIMIT = 500;
const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sortByPriority(entries: SyncEntry[]): SyncEntry[] {
  return [...entries].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9),
  );
}

// ---------------------------------------------------------------------------
// Flush implementation
// ---------------------------------------------------------------------------

async function flushPendingWrites(): Promise<void> {
  // 1. If Firestore is known-disabled, don't bother.
  if (isFirestoreDisabled()) {
    replaceQueue([]);
    return;
  }

  // 2. Ensure we have a Firestore instance (triggers probe if needed).
  const fs = await initFirestore();
  if (!fs) return;

  // 3. Read the queue snapshot.
  const all = getQueueSnapshot();
  if (all.length === 0) return;

  // 4. Sort by priority (high → medium → low).
  const sorted = sortByPriority(all);

  // 5. Process in batches of up to FIRESTORE_BATCH_LIMIT.
  const succeededIds: string[] = [];
  const failedIds: string[] = [];

  for (let i = 0; i < sorted.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = sorted.slice(i, i + FIRESTORE_BATCH_LIMIT);

    try {
      const b = writeBatch(fs);
      for (const entry of batch) {
        const ref = doc(fs, entry.collection, entry.document);
        const clean = sanitizeFirestoreData(entry.data);
        if (entry.merge) {
          b.set(ref, { ...clean, updatedAt: serverTimestamp() }, { merge: true });
        } else {
          b.set(ref, { ...clean, updatedAt: serverTimestamp() });
        }
      }
      await withTimeout(b.commit());
      noteFirestoreSuccess();
      for (const entry of batch) {
        succeededIds.push(entry.id);
      }
    } catch (e) {
      noteFirestoreFailure();
      console.warn('[SyncFlush] batch commit failed:', e);
      for (const entry of batch) {
        failedIds.push(entry.id);
      }
    }
  }

  // 6. Remove succeeded entries; keep failed ones for the next flush cycle.
  if (succeededIds.length > 0 || failedIds.length > 0) {
    const failedSet = new Set(failedIds);
    const remaining = getQueueSnapshot().filter(e => failedSet.has(e.id));
    replaceQueue(remaining);
  }
}

// ---------------------------------------------------------------------------
// Register the flusher so syncQueue.flushQueue() can invoke it.
// ---------------------------------------------------------------------------

registerFlusher(flushPendingWrites);
