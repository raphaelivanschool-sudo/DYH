# DYH Outpatient Management System — Front End

The front end for Dr. Yanga's Hospital's outpatient system, converted from the
HTML/CSS/JS prototype into real, typed apps that share one data contract. Every
app runs today on built-in sample data and switches to a real backend by setting
one environment variable.

| App | Who uses it | Platform | Folder |
| --- | --- | --- | --- |
| **Admin** | Hospital administrators | Web (React + Vite) | `apps/admin` |
| **Patient** | Patients and their families | Mobile (React Native / Expo) | `apps/patient` |
| **Doctor** | Doctors | Mobile (Expo) | `apps/doctor` |
| **Secretary** | Clinic secretaries | Mobile (Expo) | `apps/secretary` |
| **Kiosk** | Walk-in patients in the OPD lobby | Tablet, landscape (Expo) | `apps/kiosk` |

## How it is organised

```
dyh/
├── apps/
│   ├── admin/        React web portal (Vite, Tailwind, TanStack Query/Table)
│   ├── patient/      Expo app
│   ├── doctor/       Expo app
│   ├── secretary/    Expo app
│   └── kiosk/        Expo app (tablet)
└── packages/
    ├── core/         Domain types, business rules, sample data (+ unit tests)
    ├── api/          The API contract, a mock adapter and an HTTP adapter, React Query hooks
    ├── i18n/         Tagalog / English messages
    ├── tokens/       Brand colours, spacing, chart palette
    └── ui-native/    Shared React Native UI kit (buttons, forms, dialogs, consult form, profile fields…)
```

The important idea is **one contract, two adapters**:

- `packages/api/src/contract.ts` defines every call the apps make (`DyhApi`), with the REST route next to each one.
- `createMockApi()` implements it in memory with the prototype's sample data, including live updates between screens.
- `createHttpApi()` implements the same interface over REST (`packages/api/src/http.ts`).

Screens never talk to `fetch` directly. They call hooks such as `useQueue(doctorId)` or
`useApiMutation((api, v) => api.saveVitals(...))`, so swapping the mock for a real server
changes no screen code.

Business rules (queue ordering, priority lanes, scan windows, booking availability,
follow-up dates, room conflicts, permissions) live in `packages/core/src/rules` and are
covered by unit tests, so the backend can mirror them exactly.

## Tech stack

- **Monorepo:** pnpm workspaces + Turborepo, TypeScript everywhere
- **Admin:** React 19, Vite, Tailwind CSS, TanStack Query and Table, Recharts
- **Mobile and tablet:** Expo SDK 58, Expo Router, NativeWind (Tailwind for React Native), lucide icons, Zustand
- **Data:** TanStack Query for server state; Zustand for session and UI state
- **Languages:** Tagalog (default) and English, switchable in every app
- **Theme:** light and dark mode, larger-text option

## Getting started

Requirements: **Node 22+** and **pnpm 10** (`corepack enable`).

```bash
pnpm install

pnpm dev:admin       # http://localhost:5173
pnpm dev:patient     # Expo — press w for web, a for Android, i for iOS, or scan with Expo Go
pnpm dev:doctor
pnpm dev:secretary
pnpm dev:kiosk       # best on a tablet or a wide browser window
```

Other useful commands:

```bash
pnpm typecheck                         # every package and app
pnpm test                              # business-rule unit tests (Vitest)
pnpm --filter @dyh/admin build         # production build of the Admin portal
pnpm --filter @dyh/doctor export:web   # static web export of an Expo app
```

### Demo logins (mock mode)

| App | Sign in with |
| --- | --- |
| Admin | `admin@dyh.ph` / `password123` |
| Doctor | prefilled, or fingerprint; signing PIN `123456` |
| Secretary | prefilled (`c.ramos@dyh.ph`), or fingerprint |
| Patient | any mobile number, OTP is shown on screen |
| Kiosk | no login; tap the attract screen |

The demo clock is fixed at **Friday, Oct 30, 2026, 10:30 AM** so queues, clinic hours and
scan windows behave the same every run (`packages/core/src/data`).

## Connecting a backend

Each app reads one variable. Leave it empty for the mock; set it to use your server.

| App | Variable |
| --- | --- |
| Admin | `VITE_API_URL` (in `apps/admin/.env.local`) |
| Patient, Doctor, Secretary, Kiosk | `EXPO_PUBLIC_API_URL` (in `apps/<app>/.env`) |
| Kiosk device token | `EXPO_PUBLIC_KIOSK_TOKEN` |

The HTTP adapter sends JSON, adds `Authorization: Bearer <token>` from the signed-in
session, and turns non-2xx responses into an `ApiError` with the status and body.

Live updates: in mock mode the apps update each other instantly through an in-memory
event bus (`queue:<doctorId>`, `schedule:<doctorId>`, `drafts`, …). With a real backend the
queue hooks poll every 10–15 seconds; a WebSocket or SSE channel can feed the same topic
names into `ApiProvider` later for instant updates.

### Endpoints the backend needs

All routes are defined, with their request and response types, in
`packages/api/src/contract.ts` and `packages/api/src/http.ts`. Summary:

| Area | Routes |
| --- | --- |
| Auth | `POST /auth/{app}/login`, `POST /auth/logout` |
| Catalog | `GET /specializations`, `GET /doctors`, `GET /doctors/live`, `GET /doctors/{id}/availability`, `GET /announcements`, `GET/PATCH /settings`, `GET /notifications?app=` , `POST /ai/guide` |
| Patient | `GET /me`, `GET/POST /me/family`, `GET /me/bookings`, `GET /me/records`, `GET /me/consultations`, `POST /bookings`, `POST /bookings/{id}/cancel`, `POST /bookings/{id}/confirm`, `POST /consultations/{id}/rating`, `POST /patients/{id}/record-qr` |
| Doctor | `GET /queues/{doctorId}`, `GET /doctors/{id}/patients`, `GET /patients/{id}/records`, `GET /doctors/{id}/drafts`, `GET /doctors/{id}/follow-ups`, `POST /consultations`, `POST /records/{id}/addenda`, `POST /follow-ups`, `POST /drafts/delegate`, `GET/PUT /doctors/{id}/schedule`, `POST/DELETE /doctors/{id}/blocked-dates` |
| Secretary | `POST /queues/{doctorId}/{start\|skip\|done\|callBack\|noShow}`, `GET /vitals/today`, `PUT /vitals/{queueNo}`, `GET /doctors/{id}/delegated`, `POST /drafts`, `POST /notices` |
| Kiosk | `POST /kiosk/scan`, `POST /kiosk/identify`, `POST /kiosk/queues/{doctorId}/join`, `POST /kiosk/patients`, `POST /kiosk/survey` |
| Admin | `/admin/admins`, `/admin/secretaries`, `/admin/rooms`, `/admin/doctors/{id}/room`, `/admin/accounts` (+ `/status`, `/reset-password`), `/admin/clinics`, `/admin/password-requests`, `/admin/audit-logs`, `/admin/reports`, `/admin/ratings/comments`, `/admin/master/patients`, `/admin/announcements` |

Rules the server must enforce (the apps enforce them in the UI too):

- Queue numbers are issued only at the Kiosk, and only from the scan window (default 60 minutes) before the doctor's clinic. Earlier visitors get a Walk-in QR instead.
- Senior and PWD patients go into the priority lane, ahead of regular patients.
- Consultation records become permanent only when the authoring doctor signs with PIN or biometrics; changes after that are addenda.
- Secretaries only see the doctors the Admin assigned to them, and patient notices only reach that doctor's patients.
- Medical records and the Patient Master List are restricted by role (`canAccess`, `canDo`, `canSeePatientMasterList` in `packages/core`).

## What each app covers

**Admin (web):** dashboard, analytics, accounts (doctors, secretaries, admins, permissions,
password requests), clinics and services, rooms with conflict checks, announcements,
master patient list, reports, ratings, audit logs, system settings.

**Patient:** onboarding, register or link an existing record, PIN and biometrics, family
members, doctor search and booking calendar, booking QR, live queue, medical records,
record QR, ratings, notifications, AI Guide, announcements.

**Doctor:** staff login, today's live queue, secured patient record (PIN check), consult
by typing, photo or voice with AI fill and per-field checks, e-signature, addenda,
delegating to the secretary, follow-ups, weekly schedule and blocked dates, reports,
notifications.

**Secretary:** switch between assigned doctors, queue control (call, skip, done, call
back, no-show), vital signs with BMI, four-step findings drafts (text or photo) for the
doctor to sign, SMS / in-app patient notices including blocked-date forwarding,
notifications, settings.

**Kiosk:** attract video, new-patient registration (same fields as the Patient App),
existing-patient lookup by Record QR or mobile + OTP, booking / walk-in QR scan,
specialization and doctor picker with live queue, printed queue slip or Walk-in QR with
auto-close, hospital survey. It returns to the attract screen after 90 seconds idle and
keeps no data between visitors.

## Not wired yet (needs the backend or a provider)

- SMS sending, OTP delivery and push notifications (the UI and API calls exist; the mock just succeeds)
- Real camera QR scanning on the Kiosk and Doctor apps (the scan screens accept typed or USB-scanner input and demo buttons)
- AI fill from photo / voice and the AI Guide answers (mocked responses)
- Receipt printer integration on the Kiosk ("Print Again" shows a toast)
- Blockchain hash for signed records (placeholder shown)
