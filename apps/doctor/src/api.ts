import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBackend } from '@dyh/api';
import { useSession } from './store';

/**
 * Backend adapter, chosen from apps/<app>/.env:
 * - EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY (+ Firebase config) → Supabase + Firebase Auth
 * - EXPO_PUBLIC_API_URL → a custom REST backend (packages/api/src/http.ts)
 * - nothing set → in-memory mock with the prototype's sample data
 * Expo only inlines EXPO_PUBLIC_* variables written out in full, so keep them literal.
 */
export const { api, mode: apiMode } = createBackend({
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  firebase: {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  },
  storage: AsyncStorage,
  httpUrl: process.env.EXPO_PUBLIC_API_URL,
  getToken: () => useSession.getState().token,
});
