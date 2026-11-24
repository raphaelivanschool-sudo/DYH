import { createBackend } from '@dyh/api';
import { usePrefs } from './store/prefs';

/**
 * Picks the backend adapter from apps/admin/.env.local:
 * - VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (+ VITE_FIREBASE_*) → Supabase + Firebase Auth
 * - VITE_API_URL → a custom REST backend (packages/api/src/http.ts)
 * - nothing set → in-memory mock with the prototype's sample data
 */
const env = import.meta.env;

export const { api, mode: apiMode } = createBackend({
  supabaseUrl: env.VITE_SUPABASE_URL as string | undefined,
  supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY as string | undefined,
  firebase: {
    apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
    projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
    appId: env.VITE_FIREBASE_APP_ID as string | undefined,
  },
  httpUrl: env.VITE_API_URL as string | undefined,
  getToken: () => usePrefs.getState().session?.token ?? null,
  mockLatency: 200,
});

export const usingMock = apiMode === 'mock';
