import { createHttpApi, createMockApi } from '@dyh/api';
import { usePrefs } from './store/prefs';

/**
 * Picks the backend adapter.
 * - VITE_API_URL empty  → in-memory mock with the prototype's sample data.
 * - VITE_API_URL set    → real REST backend (see packages/api/src/http.ts for endpoints).
 */
const baseUrl = import.meta.env.VITE_API_URL as string | undefined;

export const api = baseUrl
  ? createHttpApi({ baseUrl, getToken: () => usePrefs.getState().session?.token ?? null })
  : createMockApi({ latency: 200 });

export const usingMock = !baseUrl;
