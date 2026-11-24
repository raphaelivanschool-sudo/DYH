import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBackend } from '@dyh/api';

/**
 * Backend adapter, chosen from apps/kiosk/.env:
 * - EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY (+ Firebase config) → Supabase + Firebase Auth
 * - EXPO_PUBLIC_API_URL → a custom REST backend (packages/api/src/http.ts)
 * - nothing set → in-memory mock with the prototype's sample data
 * The kiosk is an unattended device: it signs in with the device key the Admin issued
 * (EXPO_PUBLIC_KIOSK_TOKEN), never with a person's login.
 */
const deviceKey = process.env.EXPO_PUBLIC_KIOSK_TOKEN ?? undefined;

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
  kioskDeviceKey: deviceKey,
  httpUrl: process.env.EXPO_PUBLIC_API_URL,
  getToken: () => deviceKey ?? null,
});
