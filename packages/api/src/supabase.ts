/**
 * Supabase adapter: the real backend.
 *
 * - Identity: Firebase Auth (email/password for staff, SMS code for patients,
 *   device key for the kiosk). Custom sign-in tokens come from the Supabase Edge
 *   Function "dyh", so Firebase can stay on the free Spark plan. Supabase accepts the Firebase ID token directly
 *   ("third-party auth"), so every request runs as the signed-in person.
 * - Data and rules: Postgres functions in supabase/migrations, called with rpc().
 *   They return the exact JSON shapes of @dyh/core, so results pass straight through.
 * - Live updates: Realtime on the live_topics table, re-emitted with the same topic
 *   names the mock uses (queue:<doctorId>, schedule:<doctorId>, drafts, ...).
 */
import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { AI_GUIDE, routeAiQuestion, type AppId, type Patient, type Session } from '@dyh/core';
import type { DyhApi } from './contract';
import type { FirebaseBridge } from './firebase';
import { ApiError } from './http';
import type { ChangeListener } from './mock';

export interface SupabaseApiOptions {
  supabaseUrl: string;
  /** The project's anon (publishable) key. Never the service role key. */
  supabaseAnonKey: string;
  firebase: FirebaseBridge;
  /** Kiosk only: the device key the Admin issued. The kiosk signs in with it automatically. */
  kioskDeviceKey?: string;
}

/** Philippine time (UTC+8, no daylight saving). */
const manilaNow = () => {
  const t = new Date(Date.now() + 8 * 3_600_000);
  return { today: t.toISOString().slice(0, 10), hour: t.getUTCHours() + t.getUTCMinutes() / 60 };
};

const digits = (s: string) => s.replace(/\D/g, '');

export function createSupabaseApi(o: SupabaseApiOptions): DyhApi & { subscribe(fn: ChangeListener): () => void } {
  const fb = o.firebase;
  const sb = createClient(o.supabaseUrl, o.supabaseAnonKey, {
    accessToken: async () => fb.getIdToken(),
  });

  /** The server function (supabase/functions/dyh): sign-in tokens, staff logins, SMS. */
  const call = async <T>(action: string, data?: unknown): Promise<T> => {
    const { data: out, error } = await sb.functions.invoke('dyh', { body: { action, data: data ?? {} } });
    if (error) {
      let status = 400;
      let message = error.message;
      const res = (error as { context?: unknown }).context;
      if (res instanceof Response) {
        status = res.status;
        message = ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? message;
      }
      throw new ApiError(status, message, error);
    }
    return out as T;
  };

  let kioskSignIn: Promise<void> | null = null;
  const ensureKiosk = async () => {
    if (!o.kioskDeviceKey || (await fb.ready())) return;
    kioskSignIn ??= call<{ token: string }>('kioskSignIn', { deviceKey: o.kioskDeviceKey })
      .then((r) => fb.signInWithCustomToken(r.token))
      .finally(() => (kioskSignIn = null));
    await kioskSignIn;
  };

  const rpc = async <T>(fn: string, args?: Record<string, unknown>): Promise<T> => {
    await ensureKiosk();
    const { data, error, status } = await sb.rpc(fn, args);
    if (error) throw new ApiError(error.code === '42501' ? 403 : status || 400, error.message, error);
    return data as T;
  };

  const sessionFor = async (app: AppId): Promise<Session> => {
    const who = await rpc<Omit<Session, 'token'>>('whoami', { p_app: app });
    return { ...who, token: (await fb.getIdToken()) ?? '' };
  };

  /* ---- live updates ---- */
  const listeners = new Set<ChangeListener>();
  let channel: RealtimeChannel | null = null;
  const connect = () => {
    if (channel || !listeners.size) return;
    channel = sb
      .channel('dyh-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_topics' }, (p) => {
        const topic = (p.new as { topic?: string })?.topic;
        if (topic) listeners.forEach((l) => l(topic));
      })
      .subscribe();
  };
  const reconnect = () => {
    if (channel) void sb.removeChannel(channel);
    channel = null;
    void sb.realtime.setAuth().then(connect);
  };
  fb.onChange(reconnect);

  return {
    subscribe(fn) {
      listeners.add(fn);
      connect();
      return () => {
        listeners.delete(fn);
        if (!listeners.size && channel) {
          void sb.removeChannel(channel);
          channel = null;
        }
      };
    },
    clock: manilaNow,

    /* ---- auth ---- */
    async login(app, cred) {
      if (app === 'kiosk') {
        await ensureKiosk();
        return sessionFor('kiosk');
      }
      const hasSecret = 'secret' in cred;
      if (app === 'patient' && hasSecret && /^\d{6}$/.test(cred.secret) && digits(cred.id).length === 11) {
        // Mobile number + SMS code → custom token from the verifyOtp Cloud Function.
        const r = await call<{ token: string }>('verifyOtp', { mobile: digits(cred.id), code: cred.secret });
        await fb.signInWithCustomToken(r.token);
        return sessionFor('patient');
      }
      if (hasSecret && app !== 'patient') {
        await fb.signInWithEmail(cred.id, cred.secret);
        try {
          return await sessionFor(app);
        } catch (e) {
          await fb.signOut(); // signed in to Firebase but has no access to this app
          throw e;
        }
      }
      // Fingerprint or PIN unlock: the device already holds a Firebase session.
      if (!(await fb.ready())) throw new ApiError(401, app === 'patient' ? 'Sign in with your mobile number first' : 'Sign in with your email and password first');
      return sessionFor(app);
    },
    logout: () => fb.signOut(),
    async requestOtp(mobile, purpose = 'login') {
      if (purpose === 'kiosk') await ensureKiosk();
      return call('requestOtp', { mobile: digits(mobile), purpose });
    },
    registerPatient: (p) => rpc('register_patient', { p }),

    /* ---- catalog ---- */
    getSpecializations: () => rpc('get_specializations'),
    getDoctors: () => rpc('get_doctors'),
    getLiveStatus: () => rpc('get_live_status'),
    getAvailability: (doctorId, opts) => rpc('get_availability', { p_doctor: doctorId, p_no_show: !!opts?.noShowRestricted }),
    getAnnouncements: () => rpc('get_announcements'),
    getSettings: () => rpc('get_settings'),
    updateSettings: (patch) => rpc('update_settings', { p_patch: patch }),
    getNotifications: (app) => rpc('get_notifications', { p_app: app }),
    // The AI Guide still uses the built-in answers; plug a model in here later.
    async askGuide(question, key) {
      const k = (key as keyof typeof AI_GUIDE.answers) ?? routeAiQuestion(question);
      return { key: k, answer: AI_GUIDE.answers[k] ?? AI_GUIDE.answers.def };
    },

    /* ---- patient ---- */
    getMe: () => rpc('get_me'),
    getFamily: () => rpc('get_family'),
    addFamilyMember: (m) => rpc('add_family_member', { m }),
    getMyBookings: () => rpc('get_my_bookings'),
    getMyRecords: () => rpc('get_my_records'),
    getMyConsultations: () => rpc('get_my_consultations'),
    createBooking: (b) => rpc('create_booking', { p_patient: b.patientId, p_doctor: b.doctorId, p_date: b.date, p_complaint: b.chiefComplaint ?? null }),
    cancelBooking: (id) => rpc('cancel_booking', { p_id: id }),
    confirmBooking: (id) => rpc('confirm_booking', { p_id: id }),
    rateConsultation: (id, stars, comment) => rpc('rate_consultation', { p_id: id, p_stars: stars, p_comment: comment ?? null }),
    getRecordQr: (patientId) => rpc('get_record_qr', { p_patient: patientId }),

    /* ---- doctor ---- */
    getQueue: (doctorId) => rpc('get_queue', { p_doctor: doctorId }),
    getDoctorPatients: (doctorId) => rpc('get_doctor_patients', { p_doctor: doctorId }),
    getPatientHistory: (patientId) => rpc('get_patient_history', { p_patient: patientId }),
    getTodayVitals: () => rpc('get_today_vitals'),
    getDrafts: (doctorId) => rpc('get_drafts', { p_doctor: doctorId }),
    getFollowUps: (doctorId) => rpc('get_follow_ups', { p_doctor: doctorId }),
    signConsultation: (i) => rpc('sign_consultation', { i }),
    addAddendum: (recordId, text) => rpc('add_addendum', { p_record: recordId, p_text: text }),
    bookFollowUp: (i) => rpc('book_follow_up', { p_patient: i.patientId, p_doctor: i.doctorId, p_date: i.date, p_purpose: i.purpose, p_note: i.note ?? null }),
    delegateToSecretary: (i) => rpc('delegate_to_secretary', { p_patient: i.patientId, p_doctor: i.doctorId, p_note: i.note ?? null }),
    getSchedule: (doctorId) => rpc('get_schedule', { p_doctor: doctorId }),
    saveSchedule: (s) => rpc('save_schedule', { s }),
    blockDate: (b) => rpc('block_date', { p_doctor: b.doctorId, p_date: b.date, p_reason: b.reason, p_note: b.note ?? null }),
    removeBlockedDate: (doctorId, date) => rpc('remove_blocked_date', { p_doctor: doctorId, p_date: date }),

    /* ---- secretary ---- */
    queueAction: (doctorId, action, index) => rpc('queue_action', { p_doctor: doctorId, p_action: action, p_index: index ?? 0 }),
    saveVitals: (queueNumber, v) => rpc('save_vitals', { p_number: queueNumber, v }),
    getDelegated: (doctorId) => rpc('get_delegated', { p_doctor: doctorId }),
    submitFindingsDraft: (i) => rpc('submit_findings_draft', { i }),
    sendPatientNotice: (i) => rpc('send_patient_notice', { i }),

    /* ---- kiosk ---- */
    kioskScan: (code) => rpc('kiosk_scan', { p_code: code }),
    kioskJoin: (doctorId, p) => rpc('kiosk_join', { p_doctor: doctorId, p_patient: p.id }),
    kioskRegister: (r) => rpc('kiosk_register', { r }),
    async kioskIdentify(by) {
      if ('recordQr' in by) return rpc<{ patient: Patient }>('kiosk_identify_qr', { p_token: by.recordQr });
      if (!by.otp) {
        await ensureKiosk();
        await call('requestOtp', { mobile: digits(by.mobile), purpose: 'kiosk' });
        return { otpSent: true };
      }
      return rpc<{ patient: Patient }>('kiosk_verify_otp', { p_mobile: digits(by.mobile), p_otp: by.otp });
    },
    submitSurvey: (answers) => rpc('submit_survey', { p_answers: answers }),

    /* ---- admin ---- */
    getAdmins: () => rpc('get_admins'),
    getSecretaries: () => rpc('get_secretaries'),
    getRooms: () => rpc('get_rooms'),
    addRoom: (r) => rpc('add_room', { r }),
    assignRoom: (doctorId, room) => rpc('assign_room', { p_doctor: doctorId, p_room: room }),
    async createAccount(a) {
      // Creates the row and the login; the new staff member then gets a "set your password" email.
      const r = await call<{ id: string; email: string }>('createStaffAccount', a);
      await fb.sendPasswordResetEmail(r.email).catch(() => undefined);
      return { id: r.id };
    },
    async updateAccount(id, patch) {
      await call('updateStaffAccount', { id, patch });
    },
    async setAccountStatus(id, status, reason) {
      await call('setAccountStatus', { id, status, reason });
    },
    async resetPassword(accountId) {
      const { email } = await rpc<{ email: string }>('admin_reset_password', { p_id: accountId });
      await fb.sendPasswordResetEmail(email);
    },
    getPasswordRequests: () => rpc('get_password_requests'),
    async sendResetLink(requestId) {
      const { email } = await rpc<{ email: string }>('send_reset_link', { p_id: requestId });
      await fb.sendPasswordResetEmail(email);
    },
    getAuditLogs: () => rpc('get_audit_logs'),
    getGeneratedReports: () => rpc('get_generated_reports'),
    getRatingComments: () => rpc('get_rating_comments'),
    getMasterPatients: () => rpc('get_master_patients'),
    getClinics: () => rpc('get_clinics'),
    saveClinic: (c) => rpc('save_clinic', { c }),
    publishAnnouncement: (a, opts) => rpc('publish_announcement', { a, p_draft: !!opts?.draft }),
  };
}
