import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getAuth, Auth, GoogleAuthProvider, signInWithPopup,
  onAuthStateChanged, signOut as fbSignOut, signInAnonymously as fbSignInAnonymously,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore, Firestore, doc, getDoc, setDoc, updateDoc, serverTimestamp,
  collection, getDocs, query, orderBy, limit, deleteDoc,
} from 'firebase/firestore';

import { generateShortId } from './shortId';
import { getTurso, isTursoConfigured } from './turso';

type AuthCallback = (user: FirebaseUser | null) => void;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let provider: GoogleAuthProvider | null = null;
let db: Firestore | null = null;

export function initFirebase() {
  if (!app && firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
  }
  return { app, auth, provider };
}

export function initFirestore() {
  if (!db && app) {
    db = getFirestore(app);
  }
  return db;
}

export function getFirestoreDb() {
  return db;
}

export async function fetchUserProfile(uid: string): Promise<Record<string, unknown> | null> {
  initFirestore();
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

export async function saveUserProfile(uid: string, data: Record<string, unknown>) {
  initFirestore();
  if (!db) return null;
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
    } else {
      await setDoc(ref, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
    return true;
  } catch {
    return null;
  }
}

export async function updateUserProfile(uid: string, data: Record<string, unknown>) {
  initFirestore();
  if (!db) return null;
  try {
    await updateDoc(doc(db, 'users', uid), { ...data, updatedAt: serverTimestamp() });
    return true;
  } catch {
    return null;
  }
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
  return !!firebaseConfig.apiKey;
}

export async function saveUserGame(uid: string, gameId: string, data: Record<string, unknown>) {
  initFirestore();
  if (!db) return;
  try {
    await setDoc(doc(db, 'users', uid, 'games', gameId), { ...data, updatedAt: serverTimestamp() });
  } catch {}
  const shortId = (data as any).shortId || gameId;
  if (shortId) {
    try {
      await setDoc(doc(db, 'games', shortId), { uid, ...data, updatedAt: serverTimestamp() });
    } catch {}
  }
  // Mirror to Turso for resilience when Firestore is unreachable
  const turso = getTurso();
  if (turso && shortId) {
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
    } catch {}
  }
}

export async function fetchUserGames(uid: string): Promise<Record<string, unknown>[]> {
  initFirestore();
  if (!db) return [];
  try {
    const q = query(collection(db, 'users', uid, 'games'), orderBy('updatedAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

export async function fetchPublishedGame(shortId: string): Promise<Record<string, unknown> | null> {
  initFirestore();
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'games', shortId));
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() };
      }
    } catch {}
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
    } catch {}
  }
  return null;
}

export async function deleteUserGame(uid: string, gameId: string) {
  initFirestore();
  if (!db) return;
  try {
    const shortId = gameId;
    await deleteDoc(doc(db, 'users', uid, 'games', shortId));
    await deleteDoc(doc(db, 'games', shortId));
  } catch {}
}
