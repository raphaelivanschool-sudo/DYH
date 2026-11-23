import { createHttpApi, createMockApi } from '@dyh/api';
import { useSession } from './store';

/**
 * Backend adapter.
 * - EXPO_PUBLIC_API_URL empty → in-memory mock with the prototype's sample data.
 * - EXPO_PUBLIC_API_URL set   → real REST backend (endpoints in packages/api/src/http.ts).
 */
const baseUrl = process.env.EXPO_PUBLIC_API_URL;

export const api = baseUrl ? createHttpApi({ baseUrl, getToken: () => useSession.getState().token }) : createMockApi({ latency: 150 });
