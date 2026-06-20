import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

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

export function initFirebase() {
  if (!app && firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
  }
  return { app, auth, provider };
}

export function getFirebaseAuth() {
  return auth;
}

export async function signInWithGoogle(): Promise<FirebaseUser | null> {
  initFirebase();
  if (!auth || !provider) return null;
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOut() {
  if (!auth) return;
  await fbSignOut(auth);
}

export function onAuthChange(callback: (user: FirebaseUser | null) => void) {
  initFirebase();
  if (!auth) return () => {};
  return onAuthStateChanged(auth, callback);
}

export function isFirebaseConfigured(): boolean {
  return !!firebaseConfig.apiKey;
}
