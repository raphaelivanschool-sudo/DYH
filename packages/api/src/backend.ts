import type { DyhApi } from './contract';
import { createFirebaseBridge } from './firebase';
import { createHttpApi } from './http';
import { createMockApi, type ChangeListener } from './mock';
import { createSupabaseApi } from './supabase';

export interface BackendEnv {
  /** Supabase project URL and anon key → Supabase + Firebase backend. */
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  /** Firebase web app config (Project settings → Your apps). */
  firebase?: { apiKey?: string; authDomain?: string; projectId?: string; appId?: string };
  /** React Native: AsyncStorage, so sign-in survives restarts. */
  storage?: unknown;
  /** Kiosk device key issued by the Admin. */
  kioskDeviceKey?: string;
  /** A custom REST backend instead (packages/api/src/http.ts). */
  httpUrl?: string;
  getToken?: () => string | null | Promise<string | null>;
  mockLatency?: number;
}

export type Backend = DyhApi & { subscribe?: (fn: ChangeListener) => () => void };

/**
 * Picks the adapter from environment variables:
 * Supabase URL set → Supabase + Firebase; else API URL set → REST; else the in-memory mock.
 */
export function createBackend(env: BackendEnv): { api: Backend; mode: 'supabase' | 'http' | 'mock' } {
  if (env.supabaseUrl && env.supabaseAnonKey) {
    const f = env.firebase ?? {};
    if (!f.apiKey || !f.projectId) throw new Error('Supabase is configured but the Firebase config is missing (API key and project id).');
    const firebase = createFirebaseBridge({
      config: { apiKey: f.apiKey, authDomain: f.authDomain ?? `${f.projectId}.firebaseapp.com`, projectId: f.projectId, appId: f.appId },
      storage: env.storage,
    });
    return { api: createSupabaseApi({ supabaseUrl: env.supabaseUrl, supabaseAnonKey: env.supabaseAnonKey, firebase, kioskDeviceKey: env.kioskDeviceKey }), mode: 'supabase' };
  }
  if (env.httpUrl) return { api: createHttpApi({ baseUrl: env.httpUrl, getToken: env.getToken }), mode: 'http' };
  return { api: createMockApi({ latency: env.mockLatency ?? 150 }), mode: 'mock' };
}
