# DYH backend: Firebase Auth + Supabase

The apps sign people in with **Firebase Auth** and keep all hospital data in **Supabase**
(Postgres). Supabase trusts Firebase's sign-in tokens directly ("third-party auth"), so
there is one login per person and the database itself decides what each person may see.

```
 Patient / Doctor / Secretary / Kiosk / Admin app
        │  1. sign in ───────────────► Firebase Auth  (email + password, SMS code, kiosk key)
        │                                   ▲
        │                                   │ custom tokens, staff logins (service account key)
        │                       Supabase Edge Function "dyh"  (supabase/functions/dyh)
        │                                   │ service role (narrow helpers only)
        │  2. every request carries the     ▼
        └──── Firebase ID token ─────► Supabase Postgres
                                        • tables + RLS        (supabase/migrations/…0100, 0200)
                                        • rules as functions  (…0300, 0400)
                                        • Realtime "live_topics" → instant queue updates
```

## Who does what

| Concern | Where | Why there |
| --- | --- | --- |
| Staff login (email + password) | Firebase Auth | Password storage, resets, lockouts are handled for us |
| Patient login (mobile + SMS code) | Edge Function actions `requestOtp` / `verifyOtp` → Firebase custom token | Works the same in Expo Go, web and native builds; no reCAPTCHA |
| Kiosk login | Edge Function action `kioskSignIn` (device key → custom token) | The kiosk is unattended, so it never holds a person's login |
| Creating / disabling staff accounts | Edge Function actions `createStaffAccount`, `updateStaffAccount`, `setAccountStatus` | Needs Firebase admin rights (service account key); the database checks the admin's permission first |
| Patient records, queue, bookings, schedules, audit log | Supabase Postgres | Relational data with real constraints and row-level security |
| Business rules (queue numbers, priority lane, scan window, signing, capacity) | Postgres functions | Enforced in one place, atomically, no matter which app calls |
| SMS (OTP, patient notices) | OTP sent directly; notices go `sms_outbox` → pg_cron → `drainSms` → Semaphore | Database queues; one place talks to the SMS provider |
| Live updates | Supabase Realtime on `live_topics` | Carries only topic names (`queue:d1`), never patient details |

### Rules the database enforces

- Queue numbers are issued only by the Kiosk, only inside the scan window (default 60 minutes before clinic), never past the doctor's daily cap, one active number per patient per doctor. Too early → a Walk-in QR that works once the window opens.
- Senior and PWD patients go ahead of the first regular patient (same as `insertIntoQueue` in `@dyh/core`). Called-back patients go to the front.
- Consultation records exist only once the attending doctor signs (PIN or fingerprint). Signed records are hash-chained and **cannot be updated or deleted**, even by the database owner. Corrections are addenda, only by the authoring doctor.
- Medical records: the patient (and the family member managing them) and doctors who have that patient in their queue, bookings or history. Not secretaries, not admins.
- Secretaries reach only the doctors the Admin assigned to them; patient notices go only to that doctor's patients.
- Admin permissions follow the same `canDo` matrix as the Admin portal. The Patient Master List is Super Admin only.
- Deactivating an account cuts access on the next request (the database checks status), and the Firebase login is disabled and signed out too.
- Every admin action, signature and no-show goes to an append-only, hash-chained audit log (`app.verify_audit_chain()` checks it).
- Booking: only inside the booking window, never on full, blocked or no-clinic days, one booking per patient per doctor per day, cancellation cut-off enforced, and after a no-show the next visit must be a same-day walk-in.

## Setup

Everything runs on free plans: Firebase **Spark** (sign-in only) and Supabase **Free**
(database, Edge Function, scheduled SMS). Nothing here needs Firebase Blaze or Cloud Functions.

### 1. Firebase

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** (e.g. `dyh-opd`). Note the **project id**.
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable.**
3. **Project settings → Your apps → Web app (`</>`)**, register "DYH". Copy `apiKey`, `authDomain`, `projectId`, `appId`.
4. **Project settings → Service accounts → Generate new private key.** This downloads a JSON file.
   It is the master key to your Firebase logins: never put it in Git or an app. It only goes into a Supabase secret (step 3).

### 2. Supabase database

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project** (Singapore is closest to the Philippines).
2. **Authentication → Sign In / Providers → Third-party Auth → Add provider → Firebase**, enter your Firebase project id.
3. Load the database: open `supabase/setup-all.sql`, paste it into the **SQL Editor** and **Run**
   (when Supabase warns about RLS, choose **Run without RLS**: the script turns RLS on itself).
   It already contains the migrations, the sample data and the Firebase project id `dyh-opd`;
   with another project id, run afterwards:
   ```sql
   update app.config set value = 'your-firebase-project-id' where key = 'firebase_project_id';
   ```
   (With the Supabase CLI instead: `npx supabase link --project-ref <ref>`, `npx supabase db push`, then run `supabase/seed.sql`.)
4. **Project settings → API Keys**: copy the **Project URL** and the **anon / publishable** key (these go in the apps).
   The **service_role / secret** key never leaves Supabase: the Edge Function gets it automatically.

### 3. Edge Function

1. **Edge Functions → Deploy a new function → Via Editor**, name it `dyh`, paste `supabase/functions/dyh/index.ts`, **Deploy**.
   (CLI: `npx supabase functions deploy dyh`, which reads `supabase/config.toml`.)
2. In the function's **Details**, turn **Verify JWT** off. The function checks Firebase tokens itself; the gateway only knows Supabase tokens.
3. **Edge Functions → Secrets**, add:

   | Name | Value |
   | --- | --- |
   | `FIREBASE_SERVICE_ACCOUNT` | the whole JSON file from Firebase step 4 |
   | `DEMO_PASSWORD` | testing only: one password for every sample staff account |
   | `OTP_DEV_MODE` | testing only: `true` shows the SMS code in the app. **Remove before real use.** |
   | `SEMAPHORE_API_KEY` | when you have a [Semaphore](https://semaphore.co) account; until then codes appear in the function's **Logs** |

4. **Scheduled SMS:** put your project ref into `supabase/sms-cron.sql` and run it in the SQL editor.

### 4. Staff logins for the sample accounts

Call the function once; it gives every doctor, secretary and admin in the database a Firebase login
(with `DEMO_PASSWORD`, or a random password if that secret is not set):

```bash
curl -X POST https://<ref>.supabase.co/functions/v1/dyh -H 'Content-Type: application/json' -d '{"action":"setupStaffLogins"}'
```

This works without signing in only until the first admin has a login; after that only a Super Admin can run it.
After this, `admin@dyh.ph`, `m.santos@dyh.ph`, `c.ramos@dyh.ph` and the rest sign in with that password.
New staff created in the Admin portal get a "set your password" email from Firebase instead.

### 5. Point the apps at it

Copy each app's `.env.example` to `.env` (`.env.local` for Admin) and fill in the values:

| App | File | Variables |
| --- | --- | --- |
| Admin | `apps/admin/.env.local` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` |
| Patient, Doctor, Secretary | `apps/<app>/.env` | the same with the `EXPO_PUBLIC_` prefix |
| Kiosk | `apps/kiosk/.env` | the same, plus `EXPO_PUBLIC_KIOSK_TOKEN` (the device key) |

Restart the dev server after changing these. With the variables empty, every app keeps running on the built-in sample data.

The anon key and Firebase web config are safe to ship in an app; the database rules protect the data. The service_role key is not.

### 6. Kiosk devices

The seed includes one demo kiosk whose key is `demo-kiosk-key`. For a real device, make a long random key and register its hash:

```sql
insert into public.kiosk_devices (id, name, key_hash)
values ('kiosk-2', 'OPD Lobby, left', encode(extensions.digest('<long random key>', 'sha256'), 'hex'));
-- disable a lost device:
update public.kiosk_devices set active = false where id = 'kiosk-2';
```

## How each sign-in works

- **Staff (Doctor, Secretary, Admin):** email + password → Firebase → the app calls `whoami('<app>')`. A secretary cannot open the Doctor app with their login, and a deactivated account is refused. Fingerprint unlock reuses the saved Firebase session on the device.
- **Patient, first time:** Register → enter mobile → `requestOtp` texts a code → `verifyOtp` checks it and returns a custom token → if that number already has a hospital record (for example from the Kiosk), the account is linked to it automatically; otherwise the app creates the record with `register_patient`. PIN and fingerprint unlock afterwards reuse the saved session.
- **Kiosk:** signs in by itself with its device key. Existing patients are found by Record QR (60-second token from the Patient App) or mobile + SMS code.

## Demo clock

The mock always runs on Friday, Oct 30, 2026, 10:30 AM. The database uses real Manila time, but you can pin it for a presentation so queues and scan windows behave predictably:

```sql
alter database postgres set app.demo_now = '2026-10-30 10:30';   -- pin
alter database postgres reset app.demo_now;                       -- back to real time
```

## Testing the database locally

With any Postgres 15+ (`psql` on your PATH):

```bash
PGHOST=localhost PGUSER=postgres ./supabase/tests/run-local.sh
```

It loads the migrations and seed into a scratch database and plays each role: the kiosk issues
numbers (a senior jumps ahead of regular patients), the secretary runs the queue, the doctor signs a
record, the patient books and rates, the admin manages accounts. It also checks that the wrong
people are refused: another project's token, an unassigned secretary, another doctor, a limited admin,
a deactivated account, and any attempt to edit a signed record.

## Files

| Path | What it is |
| --- | --- |
| `supabase/migrations/20261123000100_schema.sql` | Tables |
| `supabase/migrations/20261123000200_access.sql` | Who-is-calling helpers, RLS, audit hash chain, immutability, Realtime topics |
| `supabase/migrations/20261123000300_helpers.sql` | JSON shapes, queue/availability rules, notifications, OTP storage |
| `supabase/migrations/20261123000400_api.sql` | One function per app action (`get_queue`, `kiosk_join`, `sign_consultation`, …) |
| `supabase/seed.sql` | Sample data, generated by `pnpm seed:gen` from `@dyh/core` |
| `supabase/tests/` | Local smoke test |
| `supabase/setup-all.sql` | Migrations + seed + project id in one file, for the SQL editor |
| `supabase/functions/dyh/index.ts` | The Edge Function (sign-in tokens, staff logins, SMS) |
| `supabase/sms-cron.sql` | Schedules the SMS outbox every minute |
| `packages/api/src/supabase.ts` | The Supabase adapter (implements `DyhApi`) |
| `packages/api/src/firebase.ts` | Firebase Auth wrapper (web and React Native) |
| `packages/api/src/backend.ts` | Picks mock, REST or Supabase from the environment variables |

## Not done yet

- **Patient App "Link existing record" screen** is still the prototype flow. With Supabase you don't need it: registering with the mobile number already on file links the record automatically.
- **AI Guide** still uses the built-in answers (`askGuide` in the adapter is where a model would plug in).
- **Photo uploads** (photo consults, findings photos) aren't stored yet; Supabase Storage is the natural place.
- **Reports and analytics charts** in the Admin portal still read sample numbers; `generated_reports` holds the list only.
- **Push notifications**: notifications are stored and shown in-app; sending them to phones needs Expo push tokens.

## Before real patients use it

- **Supabase plan:** Free projects pause after 7 days without activity and have no automatic backups. Use **Pro** for the hospital.
- **Remove the demo data:** sample patients, the `demo-kiosk-key` kiosk, `DEMO_PASSWORD` and `OTP_DEV_MODE`. Give each staff member their own login (Admin portal → reset password).
- **Kiosk keys:** one long random key per device (section 6).
- **SMS:** add `SEMAPHORE_API_KEY` and a registered sender name.
- **Data privacy:** tell the hospital's Data Protection Officer where the data is stored (the Supabase region) and who can see what (the rules above).
- **Firebase:** Spark is enough. Only the sign-in methods you use need to be on.
- **Rotate the Firebase service account key** if it was ever shared (chat, email, USB): generate a new one, update `FIREBASE_SERVICE_ACCOUNT`, then delete the old key in Google Cloud → IAM → Service accounts.
