/**
 * DYH server function (Supabase Edge Function "dyh").
 *
 * Firebase Auth is the identity provider; Supabase holds the data and enforces
 * the rules. This function does only what an app must never do itself, and it
 * runs on Supabase's free tier, so Firebase can stay on the free Spark plan:
 *
 *  requestOtp / verifyOtp   Patient sign-in with mobile number + SMS code → Firebase custom token
 *  kioskSignIn              Unattended kiosk exchanges its device key for a Firebase custom token
 *  createStaffAccount       Admin creates a doctor / secretary / admin login
 *  updateStaffAccount       Admin edits an account (keeps the Firebase email in sync)
 *  setAccountStatus         Admin activates / deactivates (disables the Firebase login too)
 *  setupStaffLogins         First-time setup: Firebase logins for the staff already in the database
 *  drainSms                 Sends what the database queued in sms_outbox (called by pg_cron)
 *
 * Call it with { action, data }. Secrets (Edge Functions → Secrets):
 *  FIREBASE_SERVICE_ACCOUNT  the JSON key from Firebase → Project settings → Service accounts (required)
 *  SEMAPHORE_API_KEY         optional; without it SMS text is only written to the function logs
 *  SMS_SENDER_NAME           optional, default "DYH"
 *  DEMO_PASSWORD             optional; the password setupStaffLogins gives every account (else random)
 *  OTP_DEV_MODE              "true" returns the SMS code to the app. Testing only, never in production.
 *
 * Every token we mint carries `role: "authenticated"`, which Supabase requires for
 * third-party auth. Who the user is inside DYH is decided by the database (uid lookup),
 * so a stale claim can never grant access.
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { SignJWT, createRemoteJWKSet, importPKCS8, jwtVerify, type JWTPayload } from 'npm:jose@5';

const env = (k: string) => Deno.env.get(k) ?? '';
const SUPABASE_URL = env('SUPABASE_URL');
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
const ANON_KEY = env('SUPABASE_ANON_KEY');

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class Fail extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/* ------------------------------------------------------------------ */
/* Firebase (service account, no Admin SDK needed)                     */
/* ------------------------------------------------------------------ */

interface ServiceAccount { project_id: string; client_email: string; private_key: string }
let sa: ServiceAccount | null = null;
const serviceAccount = (): ServiceAccount => {
  if (sa) return sa;
  try {
    sa = JSON.parse(env('FIREBASE_SERVICE_ACCOUNT')) as ServiceAccount;
  } catch {
    sa = null;
  }
  if (!sa?.private_key || !sa.client_email || !sa.project_id) throw new Fail(500, 'Server not set up: add the FIREBASE_SERVICE_ACCOUNT secret');
  return sa;
};
const signingKey = () => importPKCS8(serviceAccount().private_key, 'RS256');

/** Same as firebase-admin createCustomToken. */
async function customToken(uid: string, claims: Record<string, unknown>) {
  const s = serviceAccount();
  return new SignJWT({ uid, claims })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(s.client_email)
    .setSubject(s.client_email)
    .setAudience('https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(await signingKey());
}

let google: { token: string; exp: number } | null = null;
async function googleToken() {
  if (google && google.exp > Date.now() + 60_000) return google.token;
  const s = serviceAccount();
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(s.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(await signingKey());
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Google sign-in for the service account failed: ${j.error_description ?? j.error ?? r.status}`);
  google = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return google.token;
}

/** Firebase Auth admin REST API (Identity Toolkit). */
async function idt<T = Record<string, unknown>>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${serviceAccount().project_id}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await googleToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Firebase: ${j.error?.message ?? r.status}`);
  return j as T;
}

const firebaseUser = {
  async byEmail(email: string) {
    const r = await idt<{ users?: { localId: string }[] }>('accounts:lookup', { email: [email] });
    return r.users?.[0]?.localId ?? null;
  },
  async create(email: string, displayName: string, password: string, disabled = false) {
    const r = await idt<{ localId: string }>('accounts', { email, displayName, password, disabled, emailVerified: false });
    return r.localId;
  },
  update: (localId: string, patch: Record<string, unknown>) => idt('accounts:update', { localId, ...patch }),
};

const randomPassword = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18)))).replace(/[+/=]/g, 'x');

/** The signed-in Firebase user who called us, or null. */
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
async function caller(req: Request): Promise<{ token: string; claims: JWTPayload } | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const pid = serviceAccount().project_id;
  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: `https://securetoken.google.com/${pid}`, audience: pid });
    return { token, claims: payload };
  } catch {
    return null; // the anon key, an expired token, or another project's token
  }
}

/* ------------------------------------------------------------------ */
/* Supabase                                                            */
/* ------------------------------------------------------------------ */

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
/** Service role: bypasses RLS. Only used for the narrow service-role helper functions. */
const admin = () => createClient(SUPABASE_URL, SERVICE_KEY, noSession);
/** As the caller, so the database applies the caller's own permissions. */
const asCaller = (token: string) => createClient(SUPABASE_URL, ANON_KEY, { ...noSession, accessToken: async () => token });

async function rpc<T>(db: SupabaseClient, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Fail(error.code === '42501' ? 403 : error.code === 'P0429' ? 429 : 400, error.message || error.details || `Database error ${error.code ?? ''}`.trim());
  return data as T;
}

const digits = (s: unknown) => String(s ?? '').replace(/\D/g, '');
const validMobile = (m: string) => /^09\d{9}$/.test(m);
const ROLE = { role: 'authenticated' } as const;

/* ------------------------------------------------------------------ */
/* SMS                                                                 */
/* ------------------------------------------------------------------ */

/** Semaphore (PH). Without an API key the message is only logged. */
async function sendSms(mobile: string, message: string) {
  const key = env('SEMAPHORE_API_KEY');
  if (!key) {
    console.log(`[SMS not sent: no SEMAPHORE_API_KEY] to ${mobile.slice(0, 4)}•••${mobile.slice(-4)}: ${message}`);
    return;
  }
  const res = await fetch('https://api.semaphore.co/api/v4/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ apikey: key, number: mobile, message, sendername: env('SMS_SENDER_NAME') || 'DYH' }),
  });
  if (!res.ok) throw new Error(`SMS provider returned ${res.status}: ${await res.text()}`);
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

type StaffKind = 'doctor' | 'secretary' | 'admin';
interface LoginInfo { uid: string | null; email: string; name: string; status: 'active' | 'deactivated' }
type Data = Record<string, unknown>;

async function needCaller(req: Request) {
  const c = await caller(req);
  if (!c) throw new Fail(401, 'Sign in first');
  return c;
}

/** Creates (or reuses) the Firebase login for a staff row and links it. */
async function ensureStaffLogin(id: string, kind: StaffKind, email: string, name: string, opts: { password?: string; disabled?: boolean } = {}) {
  const uid = (await firebaseUser.byEmail(email)) ?? (await firebaseUser.create(email, name, opts.password ?? randomPassword(), opts.disabled));
  await firebaseUser.update(uid, { customAttributes: JSON.stringify({ ...ROLE, app_role: kind }) });
  await rpc(admin(), 'link_staff_uid', { p_id: id, p_uid: uid });
  return uid;
}

const actions: Record<string, (d: Data, req: Request) => Promise<unknown>> = {
  /** Sends a 6-digit code. "login" is open to anyone (rate-limited in the database); "kiosk" only for kiosks. */
  async requestOtp(d, req) {
    const mobile = digits(d.mobile);
    const purpose = d.purpose === 'kiosk' ? 'kiosk' : 'login';
    if (!validMobile(mobile)) throw new Fail(400, 'Enter an 11-digit mobile number starting with 09');
    if (purpose === 'kiosk' && (await caller(req))?.claims.app_role !== 'kiosk') throw new Fail(403, 'Kiosk only');
    const code = await rpc<string>(admin(), 'otp_issue', { p_mobile: mobile, p_purpose: purpose });
    await sendSms(mobile, `Ang iyong DYH code ay ${code}. Huwag itong ibahagi. / Your DYH code is ${code}. Do not share it.`);
    return { sent: true, ...(env('OTP_DEV_MODE') === 'true' ? { devCode: code } : {}) };
  },

  /** Checks the code and returns a Firebase custom token for the patient. */
  async verifyOtp(d) {
    const mobile = digits(d.mobile);
    const code = digits(d.code);
    if (!validMobile(mobile) || code.length !== 6) throw new Fail(400, 'Enter the 6-digit code');
    const db = admin();
    if (!(await rpc<boolean>(db, 'otp_check', { p_mobile: mobile, p_code: code, p_purpose: 'login' }))) throw new Fail(403, 'Wrong or expired code');
    const patient = await rpc<{ id: string; uid: string | null } | null>(db, 'patient_for_mobile', { p_mobile: mobile });
    // Existing record: sign in as that patient (linking it on first sign-in). New number: a fresh uid; the app shows registration.
    const uid = patient?.uid ?? (patient ? `p_${patient.id}` : `m_${mobile}`);
    if (patient && !patient.uid) await rpc(db, 'link_patient_uid', { p_patient: patient.id, p_uid: uid });
    return { token: await customToken(uid, { ...ROLE, app_role: 'patient', mobile }), isNew: !patient };
  },

  async kioskSignIn(d) {
    const key = String(d.deviceKey ?? '');
    if (key.length < 8) throw new Fail(400, 'Missing device key');
    const db = admin();
    const kiosk = await rpc<{ id: string; uid: string | null } | null>(db, 'kiosk_for_key', { p_key: key });
    if (!kiosk) throw new Fail(403, 'Unknown or disabled kiosk');
    const uid = kiosk.uid ?? `kiosk_${kiosk.id}`;
    if (!kiosk.uid) await rpc(db, 'link_kiosk_uid', { p_kiosk: kiosk.id, p_uid: uid });
    return { token: await customToken(uid, { ...ROLE, app_role: 'kiosk' }) };
  },

  /** The database checks the caller's admin permissions and creates the row; then we create the login. */
  async createStaffAccount(d, req) {
    const kind = d.kind as StaffKind;
    if (!['doctor', 'secretary', 'admin'].includes(kind)) throw new Fail(400, 'Unknown account kind');
    const c = await needCaller(req);
    const row = await rpc<{ id: string; email: string }>(asCaller(c.token), 'admin_create_account', { a: d });
    await ensureStaffLogin(row.id, kind, row.email, String(d.name ?? ''));
    return { id: row.id, email: row.email };
  },

  async updateStaffAccount(d, req) {
    const c = await needCaller(req);
    const info = await rpc<LoginInfo>(asCaller(c.token), 'admin_update_account', { p_id: d.id, p: d.patch ?? {} });
    if (info?.uid) await firebaseUser.update(info.uid, { email: info.email, displayName: info.name });
    return { ok: true };
  },

  async setAccountStatus(d, req) {
    const c = await needCaller(req);
    const info = await rpc<LoginInfo>(asCaller(c.token), 'set_account_status', { p_id: d.id, p_status: d.status, p_reason: d.reason });
    if (info?.uid) {
      const off = d.status === 'deactivated';
      // validSince = now signs the person out everywhere (same as revokeRefreshTokens).
      await firebaseUser.update(info.uid, { disableUser: off, ...(off ? { validSince: String(Math.floor(Date.now() / 1000)) } : {}) });
    }
    return { ok: true };
  },

  /**
   * First-time setup: gives every staff row without a login a Firebase login.
   * Open only until the first admin has a login; after that, only a Super Admin.
   */
  async setupStaffLogins(_d, req) {
    const db = admin();
    const missing = await rpc<{ linkedAdmins: number; rows: { kind: StaffKind; id: string; name: string; email: string; status: string }[] }>(db, 'staff_missing_logins');
    if (missing.linkedAdmins > 0) {
      const c = await needCaller(req);
      const me = await rpc<{ role?: string }>(asCaller(c.token), 'whoami', { p_app: 'admin' });
      if (me?.role !== 'super') throw new Fail(403, 'Super Admin only');
    }
    const password = env('DEMO_PASSWORD') || undefined;
    const done: { kind: StaffKind; id: string; email: string }[] = [];
    // Admins come last, so a failure part-way can simply be run again.
    for (const row of missing.rows) {
      await ensureStaffLogin(row.id, row.kind, row.email, row.name, { password, disabled: row.status !== 'active' });
      done.push({ kind: row.kind, id: row.id, email: row.email });
    }
    return { linked: done.length, accounts: done, password: password ? 'DEMO_PASSWORD' : 'random (send a reset email)' };
  },

  /** Sends queued SMS. Safe to call by anyone: it only sends what the database already queued. */
  async drainSms() {
    const db = admin();
    const rows = await rpc<{ id: number; mobile: string; message: string }[]>(db, 'sms_claim', { p_limit: 50 });
    let failed = 0;
    for (const r of rows ?? []) {
      try {
        await sendSms(r.mobile, r.message);
      } catch (e) {
        failed++;
        console.error('SMS failed', r.id, String(e));
        await rpc(db, 'sms_failed', { p_id: r.id, p_error: String(e) });
      }
    }
    return { sent: (rows?.length ?? 0) - failed, failed };
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  try {
    const { action, data } = (await req.json().catch(() => ({}))) as { action?: string; data?: Data };
    const fn = action ? actions[action] : undefined;
    if (!fn) throw new Fail(404, `Unknown action ${action ?? ''}`.trim());
    return json(await fn(data ?? {}, req));
  } catch (e) {
    if (e instanceof Fail) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
