/**
 * REST adapter for the real DYH backend (not built yet).
 * The endpoint map below is the proposed contract — the backend team can implement
 * it as-is, or adjust paths here without touching any screen.
 */
import type { AppId } from '@dyh/core';
import type { DyhApi } from './contract';

export interface HttpOptions {
  baseUrl: string;
  /** Returns the bearer token for the signed-in user (from secure storage). */
  getToken?: () => string | null | Promise<string | null>;
  fetchImpl?: typeof fetch;
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

export function createHttpApi(o: HttpOptions): DyhApi {
  const f = o.fetchImpl ?? fetch;
  const req = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const token = await o.getToken?.();
    const res = await f(`${o.baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = res.status === 204 ? undefined : await res.json().catch(() => undefined);
    if (!res.ok) throw new ApiError(res.status, (data as { message?: string })?.message ?? res.statusText, data);
    return data as T;
  };
  const get = <T>(p: string) => req<T>('GET', p);
  const post = <T>(p: string, b?: unknown) => req<T>('POST', p, b);
  const put = <T>(p: string, b?: unknown) => req<T>('PUT', p, b);
  const patch = <T>(p: string, b?: unknown) => req<T>('PATCH', p, b);
  const del = <T>(p: string) => req<T>('DELETE', p);
  const q = (o2: Record<string, unknown>) => '?' + new URLSearchParams(Object.entries(o2).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])).toString();

  return {
    clock: () => {
      const n = new Date();
      return { today: n.toISOString().slice(0, 10), hour: n.getHours() + n.getMinutes() / 60 };
    },
    login: (app: AppId, c) => post(`/auth/${app}/login`, c),
    logout: () => post('/auth/logout'),

    getSpecializations: () => get('/specializations'),
    getDoctors: () => get('/doctors'),
    getLiveStatus: () => get('/doctors/live'),
    getAvailability: (id, o2) => get(`/doctors/${id}/availability${q({ noShow: o2?.noShowRestricted })}`),
    getAnnouncements: () => get('/announcements'),
    getSettings: () => get('/settings'),
    updateSettings: (p) => patch('/settings', p),
    getNotifications: (app) => get(`/notifications${q({ app })}`),
    askGuide: (question, key) => post('/ai/guide', { question, key }),

    getMe: () => get('/me'),
    getFamily: () => get('/me/family'),
    addFamilyMember: (m) => post('/me/family', m),
    getMyBookings: () => get('/me/bookings'),
    getMyRecords: () => get('/me/records'),
    getMyConsultations: () => get('/me/consultations'),
    createBooking: (b) => post('/bookings', b),
    cancelBooking: (id) => post(`/bookings/${id}/cancel`),
    confirmBooking: (id) => post(`/bookings/${id}/confirm`),
    rateConsultation: (id, stars, comment) => post(`/consultations/${id}/rating`, { stars, comment }),
    getRecordQr: (pid) => post(`/patients/${pid}/record-qr`),

    getQueue: (id) => get(`/queues/${id}`),
    getDoctorPatients: (id) => get(`/doctors/${id}/patients`),
    getPatientHistory: (pid) => get(`/patients/${pid}/records`),
    getTodayVitals: () => get('/vitals/today'),
    getDrafts: (id) => get(`/doctors/${id}/drafts`),
    getFollowUps: (id) => get(`/doctors/${id}/follow-ups`),
    signConsultation: (i) => post('/consultations', i),
    addAddendum: (rid, text) => post(`/records/${rid}/addenda`, { text }),
    bookFollowUp: (i) => post('/follow-ups', i),
    delegateToSecretary: (i) => post('/drafts/delegate', i),
    getSchedule: (id) => get(`/doctors/${id}/schedule`),
    saveSchedule: (s) => put(`/doctors/${s.doctorId}/schedule`, s),
    blockDate: (b) => post(`/doctors/${b.doctorId}/blocked-dates`, b),
    removeBlockedDate: (id, date) => del(`/doctors/${id}/blocked-dates/${date}`),

    queueAction: (id, action, index) => post(`/queues/${id}/${action}`, { index }),
    saveVitals: (n, v) => put(`/vitals/${n}`, v),
    getDelegated: (id) => get(`/doctors/${id}/delegated`),
    submitFindingsDraft: (i) => post('/drafts', i),
    sendPatientNotice: (i) => post('/notices', i),

    kioskScan: (code) => post('/kiosk/scan', { code }),
    kioskJoin: (id, p) => post(`/kiosk/queues/${id}/join`, p),
    kioskRegister: (r) => post('/kiosk/patients', r),
    submitSurvey: (a) => post('/kiosk/survey', a),

    getAdmins: () => get('/admin/admins'),
    getSecretaries: () => get('/admin/secretaries'),
    getRooms: () => get('/admin/rooms'),
    addRoom: (r) => post('/admin/rooms', r),
    assignRoom: (id, room) => put(`/admin/doctors/${id}/room`, { room }),
    createAccount: (a) => post('/admin/accounts', a),
    updateAccount: (id, p) => patch(`/admin/accounts/${id}`, p),
    resetPassword: (id) => post(`/admin/accounts/${id}/reset-password`),
    getClinics: () => get('/admin/clinics'),
    saveClinic: (c) => put(`/admin/clinics/${c.specializationId}`, c),
    setAccountStatus: (id, status, reason) => post(`/admin/accounts/${id}/status`, { status, reason }),
    getPasswordRequests: () => get('/admin/password-requests'),
    sendResetLink: (id) => post(`/admin/password-requests/${id}/send`),
    getAuditLogs: () => get('/admin/audit-logs'),
    getGeneratedReports: () => get('/admin/reports'),
    getRatingComments: () => get('/admin/ratings/comments'),
    getMasterPatients: () => get('/admin/master/patients'),
    publishAnnouncement: (a, o2) => post(`/admin/announcements${o2?.draft ? '?draft=true' : ''}`, a),
  };
}
