/**
 * Firebase Auth, wrapped in the small interface the Supabase
 * adapter needs. Works on the web (Admin) and in React Native (Expo apps).
 */
import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app';
import * as fbAuth from 'firebase/auth';

export interface FirebaseBridge {
  /** Current user's ID token (refreshed by the SDK), or null when signed out. */
  getIdToken(): Promise<string | null>;
  /** Resolves once the persisted session (if any) has been restored. */
  ready(): Promise<boolean>;
  signInWithEmail(email: string, password: string): Promise<void>;
  signInWithCustomToken(token: string): Promise<void>;
  signOut(): Promise<void>;
  sendPasswordResetEmail(email: string): Promise<void>;
  /** Fires when the user signs in or out. */
  onChange(fn: (signedIn: boolean) => void): () => void;
}

export interface FirebaseBridgeOptions {
  config: FirebaseOptions;
  /** React Native only: pass AsyncStorage so the session survives app restarts. */
  storage?: unknown;
}

export function createFirebaseBridge(o: FirebaseBridgeOptions): FirebaseBridge {
  const app = getApps()[0] ?? initializeApp(o.config);
  // In React Native, firebase/auth resolves to its RN build, which exports getReactNativePersistence.
  const rnPersistence = (fbAuth as unknown as { getReactNativePersistence?: (s: unknown) => fbAuth.Persistence }).getReactNativePersistence;
  let auth: fbAuth.Auth;
  try {
    auth = o.storage && rnPersistence ? fbAuth.initializeAuth(app, { persistence: rnPersistence(o.storage) }) : fbAuth.getAuth(app);
  } catch {
    auth = fbAuth.getAuth(app); // already initialised (fast refresh)
  }
  const ready = new Promise<boolean>((res) => {
    const off = fbAuth.onAuthStateChanged(auth, (u) => {
      off();
      res(!!u);
    });
  });

  return {
    getIdToken: async () => (auth.currentUser ? auth.currentUser.getIdToken() : null),
    ready: async () => {
      await ready;
      return !!auth.currentUser;
    },
    signInWithEmail: async (email, password) => {
      await fbAuth.signInWithEmailAndPassword(auth, email.trim(), password);
    },
    signInWithCustomToken: async (token) => {
      await fbAuth.signInWithCustomToken(auth, token);
    },
    signOut: () => fbAuth.signOut(auth),
    sendPasswordResetEmail: (email) => fbAuth.sendPasswordResetEmail(auth, email),
    onChange: (fn) => fbAuth.onAuthStateChanged(auth, (u) => fn(!!u)),
  };
}
