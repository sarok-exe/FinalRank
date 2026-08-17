import type { FirebaseApp } from 'firebase/app';
import { initializeApp } from 'firebase/app';
import type { Auth,
  User as FirebaseUser} from 'firebase/auth';
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  onAuthStateChanged, signOut as fbSignOut, signInAnonymously as fbSignInAnonymously
} from 'firebase/auth';
import type { Firestore} from 'firebase/firestore';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp,
  collection, getDocs, query, orderBy, limit,
} from 'firebase/firestore';

import { queueWrite, flushQueue } from './syncQueue';

import { getTurso } from './turso';
import { saveFavoriteTurso, fetchFavoritesTurso, deleteFavoriteTurso } from './tursoCache';
import {
  setLocalGame, setLocalGameMeta, markGameUnsavedById,
  getLocalFavorites, getLocalGames, setLocalFavorites,
  type FavoriteMeta, type FullGame,
} from './localStore';

type AuthCallback = (user: FirebaseUser | null) => void;

const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined) ?? '',
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) ?? '',
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) ?? '',
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined) ?? '',
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined) ?? '',
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string | undefined) ?? '',
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let provider: GoogleAuthProvider | null = null;
let db: Firestore | null = null;
let firestoreDisabled = false;
let firestoreProbe: Promise<boolean> | null = null;
let firestoreFailStreak = 0;
const FIRESTORE_FAIL_LIMIT = 1;

export function initFirebase() {
  if (!app && firebaseConfig.apiKey !== '') {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
  }
  return { app, auth, provider };
}

/** If Firestore isn't reachable in this project, the SDK retries the WebChannel
 *  Listen stream forever — a setTimeout storm that freezes the tab. So we gate
 *  the SDK behind a probe: only create the Firestore instance once the REST
 *  endpoint answers 200. Any non-200 (403/404/400) with a valid token disables
 *  Firestore for the session; the app falls back to Turso / the CF API.
 *  A probe without a token (auth not resolved yet) defers so we can retry once
 *  the user is signed in. */
export function probeFirestore(): Promise<boolean> {
  if (firestoreProbe) return firestoreProbe;
  firestoreProbe = (async () => {
    const projectId = firebaseConfig.projectId;
    if (!projectId) return false;
    try {
      let headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const current = auth?.currentUser;
      if (!current) return false; // defer until signed in — unauthenticated probe is useless
      try { headers['Authorization'] = `Bearer ${await current.getIdToken()}`; } catch { /* token unavailable */ }
      // Use a rules-allowable call. documents:listCollectionIds returns 403 even
      // with a valid token, so probe via a scoped runQuery on the user's own
      // games subcollection (200 even when empty once rules let the user read it).
      const body = JSON.stringify({
        structuredQuery: { from: [{ collectionId: 'games' }], limit: 1 },
      });
      const probeController = new AbortController();
      const probeTimer = setTimeout(() => probeController.abort(), 3000);
      let res: Response;
      try {
        res = await fetch(
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${current.uid}:runQuery`,
          { method: 'POST', headers, body, signal: probeController.signal }
        );
      } finally {
        clearTimeout(probeTimer);
      }
      if (res.ok) return true;
      console.warn(
        `[Firestore] probe ${res.status}`,
        current ? '— disabling Firestore for this session' : '— deferring until signed in'
      );
      return false;
    } catch (err) {
      console.warn('[Firestore] probe network error — Firestore disabled for this session', err);
      return false;
    }
  })();
  firestoreProbe = firestoreProbe.catch(() => false);
  firestoreProbe.then(ok => {
    if (ok) {
      // Probe passed — materialize the SDK instance for the next caller.
      if (app) db = getFirestore(app);
    } else {
      const hadToken = !!auth?.currentUser;
      if (hadToken) {
        firestoreDisabled = true;
        // Do NOT reset firestoreProbe to null — permanently reject re-probing
        // once we have a token and the probe already failed.
      }
      // If no token yet, leave firestoreProbe as-is so initFirestore can
      // re-trigger the probe when the user signs in.
    }
  });
  return firestoreProbe;
}

function disableFirestore(reason: string): void {
  if (firestoreDisabled) return;
  firestoreDisabled = true;
  console.warn(`[Firestore] disabled: ${reason}`);
  // Do NOT call terminate(db) — it generates blocked requests from ad-blockers.
  // Just null out the reference.
  db = null;
}

export function noteFirestoreFailure(): void {
  firestoreFailStreak++;
  if (firestoreFailStreak >= FIRESTORE_FAIL_LIMIT) {
    disableFirestore('repeated request failures');
  }
}

export function noteFirestoreSuccess(): void {
  firestoreFailStreak = 0;
}

export function isFirestoreDisabled(): boolean {
  return firestoreDisabled;
}

/** Firestore WebChannel can hang (e.g. ad-blockers block the channel) instead of
 *  rejecting. Race every SDK call against a timeout so callers can fall back. */
const FIRESTORE_TIMEOUT_MS = 4000;

export function withTimeout<T>(promise: Promise<T>, ms: number = FIRESTORE_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Firestore timed out')), ms);
    promise.then(
      v => { clearTimeout(timer); resolve(v); },
      e => { clearTimeout(timer); reject(e); }
    );
  });
}

export async function initFirestore(): Promise<Firestore | null> {
  if (firestoreDisabled) return null;
  if (!db) {
    const ok = await probeFirestore();
    if (ok && app && !db) {
      db = getFirestore(app);
    }
  }
  return db;
}

export function getFirestoreDb() {
  return db;
}

/** Firestore rejects writes containing `undefined`. Deep-strip them so saves
 *  (e.g. a game with no avatar) don't throw. */
export function sanitizeFirestoreData<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(v => sanitizeFirestoreData(v)) as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = sanitizeFirestoreData(v);
    }
    return out as T;
  }
  return value;
}

export async function fetchUserProfile(uid: string): Promise<Record<string, unknown> | null> {
  const fs = await initFirestore();
  if (!fs) return null;
  try {
    const snap = await getDoc(doc(fs, 'users', uid));
    noteFirestoreSuccess();
    return snap.exists() ? snap.data() : null;
  } catch {
    noteFirestoreFailure();
    return null;
  }
}

export async function saveUserProfile(uid: string, data: Record<string, unknown>) {
  // Queue for batched Firestore sync (high priority — user profile)
  queueWrite({
    id: `profile:${uid}`,
    priority: 'high',
    collection: 'users',
    document: uid,
    data: { ...sanitizeFirestoreData(data) },
    merge: true,
    timestamp: Date.now(),
  });
  // Trigger async flush if it's time (non-blocking)
  flushQueue();
  return true;
}

export async function updateUserProfile(uid: string, data: Record<string, unknown>) {
  // Queue for batched Firestore sync (high priority — user profile)
  queueWrite({
    id: `profile:${uid}`,
    priority: 'high',
    collection: 'users',
    document: uid,
    data: { ...sanitizeFirestoreData(data) },
    merge: true,
    timestamp: Date.now(),
  });
  flushQueue();
  return true;
}

export function getFirebaseAuth() {
  return auth;
}

export function getFirebaseUser(): FirebaseUser | null {
  return auth?.currentUser ?? null;
}

export async function signInWithGoogle(): Promise<FirebaseUser | null> {
  initFirebase();
  if (!auth || !provider) return null;
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signInAnonymously(): Promise<FirebaseUser | null> {
  initFirebase();
  if (!auth) return null;
  try {
    const cred = await fbSignInAnonymously(auth);
    return cred.user;
  } catch {
    return null;
  }
}

export async function signOut() {
  if (!auth) return;
  await fbSignOut(auth);
}

/**
 * Subscribe to Firebase auth state changes.
 * Fires immediately on subscribe if a session exists, and on every sign-in/sign-out.
 */
export function onAuthChanged(callback: AuthCallback): () => void {
  initFirebase();
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export function isFirebaseConfigured(): boolean {
  return firebaseConfig.apiKey !== '';
}

export async function saveUserGame(uid: string, gameId: string, data: Record<string, unknown>) {
  const clean = sanitizeFirestoreData(data);
  const shortId = (data.shortId as string | undefined) ?? gameId;

  // 1. Write to device cache immediately — the UI can read this synchronously.
  const localGame: FullGame = {
    id: gameId,
    shortId: shortId || gameId,
    white: (data.white as FullGame['white']) ?? { username: 'White' },
    black: (data.black as FullGame['black']) ?? { username: 'Black' },
    result: (data.result as string) ?? '*',
    date: (data.date as string) ?? '',
    pgn: (data.pgn as string) ?? '',
    moves: (data.moves as unknown[]) ?? [],
    initialPosition: data.initialPosition as string | undefined,
    classificationCounts: data.classificationCounts as FullGame['classificationCounts'],
    accuracy: data.accuracy as FullGame['accuracy'],
    userSaved: data.userSaved as boolean | undefined,
    analyzedAt: data.analyzedAt as string | undefined,
    analysisDurationMs: data.analysisDurationMs as number | undefined,
    analysisDepth: data.analysisDepth as number | undefined,
  };
  setLocalGame(localGame);
  setLocalGameMeta({ id: gameId, shortId: shortId || gameId, userSaved: data.userSaved as boolean | undefined });

  // 2. Write to Turso (existing mirroring code).
  if (clean.userSaved === true) {
    try {
      await saveFavoriteTurso(uid, gameId, JSON.stringify(clean));
    } catch (e) { console.warn('[Turso] saveFavoriteTurso failed:', e); }
  }
  // Mirror to Turso for resilience when Firestore is unreachable
  const turso = getTurso();
  if (turso && shortId !== '') {
    try {
      await turso.execute({
        sql: `INSERT INTO shared_games (short_id, game_data, uid, updated_at)
              VALUES (?, ?, ?, datetime('now'))
              ON CONFLICT(short_id) DO UPDATE SET
                game_data = excluded.game_data,
                uid = excluded.uid,
                updated_at = datetime('now')`,
        args: [shortId, JSON.stringify({ uid, ...data }), uid],
      });
    } catch (e) { console.warn('[Turso] saveSharedGame mirror failed:', e); }
  }

  // 3. Queue Firestore writes for batched sync (fire-and-forget via queue).
  if (!firestoreDisabled) {
    queueWrite({
      id: `game:${uid}:${gameId}`,
      priority: 'low',
      collection: `users/${uid}/games`,
      document: gameId,
      data: { ...clean },
      merge: true,
      timestamp: Date.now(),
    });
    if (shortId !== '') {
      queueWrite({
        id: `shared:${shortId}`,
        priority: 'low',
        collection: 'games',
        document: shortId,
        data: { uid, ...clean },
        merge: true,
        timestamp: Date.now(),
      });
    }
    flushQueue();
  }

  // 4. Always resolve successfully — never throw on Firestore failure.
}

/** Convert a raw Firestore/Turso game record to a FavoriteMeta for the local cache. */
function rawToFavMeta(raw: Record<string, unknown>): FavoriteMeta {
  return {
    id: raw.id as string,
    shortId: (raw.shortId as string) ?? (raw.id as string),
    white: (raw.white as FavoriteMeta['white']) ?? { username: 'White' },
    black: (raw.black as FavoriteMeta['black']) ?? { username: 'Black' },
    result: (raw.result as string) ?? '*',
    date: (raw.date as string) ?? '',
    classificationCounts: raw.classificationCounts as FavoriteMeta['classificationCounts'],
    accuracy: raw.accuracy as FavoriteMeta['accuracy'],
    userSaved: raw.userSaved as boolean | undefined,
    analyzedAt: raw.analyzedAt as string | undefined,
  };
}

/** Favorite games: device cache first (instant), Turso background, Firestore last. */
export async function fetchUserFavorites(uid: string): Promise<Record<string, unknown>[]> {
  // 1. Read device cache first — return immediately if present.
  const cached = getLocalFavorites();
  if (cached.length > 0) {
    // Kick off a background Turso refresh so the cache stays fresh for next time.
    void (async () => {
      try {
        const tursoFavs = await fetchFavoritesTurso(uid);
        const metas = tursoFavs
          .filter((g: Record<string, unknown>) => g.userSaved === true)
          .map(rawToFavMeta);
        setLocalFavorites(metas);
      } catch { /* silent — cache is already returned */ }
    })();
    return cached as unknown as Record<string, unknown>[];
  }

  // 2. Cache empty — fetch from Turso (primary remote store).
  try {
    const tursoFavs = await fetchFavoritesTurso(uid);
    const metas = tursoFavs
      .filter((g: Record<string, unknown>) => g.userSaved === true)
      .map(rawToFavMeta);
    if (metas.length > 0) setLocalFavorites(metas);
    if (tursoFavs.length > 0) return tursoFavs;
  } catch { /* fall through to Firestore */ }

  // 3. Firestore last (skip if unavailable).
  if (!firestoreDisabled) {
    const fs = await initFirestore();
    if (fs) {
      try {
        const q = query(collection(fs, 'users', uid, 'games'), orderBy('updatedAt', 'desc'), limit(50));
        const snap = await withTimeout(getDocs(q));
        noteFirestoreSuccess();
        const favs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((g: Record<string, unknown>) => g.userSaved === true);
        if (favs.length > 0) {
          setLocalFavorites(favs.map(rawToFavMeta));
          return favs;
        }
      } catch {
        noteFirestoreFailure();
      }
    }
  }
  return [];
}

/** Convert a raw Firestore/Turso game record to a FullGame for the local cache. */
function rawToFullGame(raw: Record<string, unknown>): FullGame {
  return {
    id: raw.id as string,
    shortId: (raw.shortId as string) ?? (raw.id as string),
    white: (raw.white as FullGame['white']) ?? { username: 'White' },
    black: (raw.black as FullGame['black']) ?? { username: 'Black' },
    result: (raw.result as string) ?? '*',
    date: (raw.date as string) ?? '',
    pgn: (raw.pgn as string) ?? '',
    moves: (raw.moves as unknown[]) ?? [],
    initialPosition: raw.initialPosition as string | undefined,
    classificationCounts: raw.classificationCounts as FullGame['classificationCounts'],
    accuracy: raw.accuracy as FullGame['accuracy'],
    userSaved: raw.userSaved as boolean | undefined,
    analyzedAt: raw.analyzedAt as string | undefined,
    analysisDurationMs: raw.analysisDurationMs as number | undefined,
    analysisDepth: raw.analysisDepth as number | undefined,
  };
}

/** All saved games: device cache first (instant), Turso background, Firestore last. */
export async function fetchUserGames(uid: string): Promise<Record<string, unknown>[]> {
  // 1. Read device cache first — return immediately if present.
  const cached = getLocalGames();
  if (cached.length > 0) {
    // Kick off a background Turso refresh so the cache stays fresh for next time.
    void (async () => {
      try {
        const tursoGames = await fetchFavoritesTurso(uid);
        for (const g of tursoGames) {
          setLocalGame(rawToFullGame(g));
        }
      } catch { /* silent — cache is already returned */ }
    })();
    return cached as unknown as Record<string, unknown>[];
  }

  // 2. Cache empty — fetch from Turso (primary remote store).
  try {
    const tursoGames = await fetchFavoritesTurso(uid);
    if (tursoGames.length > 0) {
      for (const g of tursoGames) {
        setLocalGame(rawToFullGame(g));
      }
      return tursoGames;
    }
  } catch { /* fall through to Firestore */ }

  // 3. Firestore last (skip if unavailable).
  if (!firestoreDisabled) {
    const fs = await initFirestore();
    if (fs) {
      try {
        const q = query(collection(fs, 'users', uid, 'games'), orderBy('updatedAt', 'desc'), limit(50));
        const snap = await withTimeout(getDocs(q));
        noteFirestoreSuccess();
        const games = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        for (const g of games) {
          setLocalGame(rawToFullGame(g));
        }
        return games;
      } catch {
        noteFirestoreFailure();
      }
    }
  }
  return [];
}

export async function fetchPublishedGame(shortId: string): Promise<Record<string, unknown> | null> {
  const fs = await initFirestore();
  if (fs) {
    try {
      const snap = await getDoc(doc(fs, 'games', shortId));
      noteFirestoreSuccess();
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() };
      }
    } catch (e) {
      noteFirestoreFailure();
      console.warn('[Firestore] fetchPublishedGame Firestore failed:', e);
    }
  }
  // Fallback to Turso when Firestore is unreachable
  const turso = getTurso();
  if (turso) {
    try {
      const rs = await turso.execute({
        sql: 'SELECT game_data FROM shared_games WHERE short_id = ?',
        args: [shortId],
      });
      if (rs.rows.length > 0) {
        const row = rs.rows[0];
        const parsed = JSON.parse(row.game_data as string) as Record<string, unknown>;
        return { id: shortId, ...parsed };
      }
    } catch (e) { console.warn('[Turso] fetchPublishedGame fallback failed:', e); }
  }
  return null;
}

/** Unfavorite a game. Updates device cache + Turso immediately; Firestore in
 *  background if available. Never throws — callers never need to revert. */
export async function deleteUserGame(uid: string, gameId: string) {
  // 1. Update device cache immediately — mark userSaved:false / remove from favorites.
  markGameUnsavedById(gameId);

  // 2. Turso — delete the favorites row.
  try {
    await deleteFavoriteTurso(uid, gameId);
  } catch (e) { console.warn('[Turso] deleteFavoriteTurso failed:', e); }

  // 3. Queue Firestore write for batched sync (medium priority — favorites).
  if (!firestoreDisabled) {
    queueWrite({
      id: `fav:${uid}:${gameId}`,
      priority: 'medium',
      collection: `users/${uid}/games`,
      document: gameId,
      data: { userSaved: false },
      merge: true,
      timestamp: Date.now(),
    });
    flushQueue();
  }
}
