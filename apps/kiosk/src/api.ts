import { createHttpApi, createMockApi } from '@dyh/api';

/**
 * Backend adapter.
 * - EXPO_PUBLIC_API_URL empty → in-memory mock with the prototype's sample data.
 * - EXPO_PUBLIC_API_URL set   → real REST backend (endpoints in packages/api/src/http.ts).
 *   The kiosk is an unattended device, so it authenticates with a device token
 *   (EXPO_PUBLIC_KIOSK_TOKEN) issued by the Admin, not a user login.
 */
const baseUrl = process.env.EXPO_PUBLIC_API_URL;
const deviceToken = process.env.EXPO_PUBLIC_KIOSK_TOKEN ?? null;

export const api = baseUrl ? createHttpApi({ baseUrl, getToken: () => deviceToken }) : createMockApi({ latency: 150 });
