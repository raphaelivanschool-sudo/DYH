-- =====================================================================
-- DYH Outpatient Management System: database schema
--
-- Identity comes from Firebase Auth (Supabase "third-party auth").
-- Every table row that belongs to a person stores that person's Firebase
-- uid, and the access rules in 0200_access.sql look the caller up by
-- auth.jwt()->>'sub'. Ids stay the human-readable ones the apps already
-- use (d1, s1, a1, DYH-2026-004812, BK-261112-004, IM-018 ...).
--
-- Times: the hospital runs on Asia/Manila. app.now() returns local time,
-- and can be pinned for demos with:  alter database postgres set app.demo_now = '2026-10-30 10:30';
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create schema if not exists app;
comment on schema app is 'Internal helpers for DYH (not exposed through the Data API).';

/* ------------------------------------------------------------------ */
/* Clock                                                               */
/* ------------------------------------------------------------------ */

create or replace function app.now() returns timestamp
language sql stable as $$
  select coalesce(nullif(current_setting('app.demo_now', true), '')::timestamp, (now() at time zone 'Asia/Manila'))
$$;
create or replace function app.today() returns date language sql stable as $$ select app.now()::date $$;
/** Fractional hour, e.g. 10.5 for 10:30. */
create or replace function app.hour() returns numeric language sql stable as $$
  select extract(hour from app.now()) + extract(minute from app.now()) / 60.0
$$;
/** "10:30 AM" */
create or replace function app.time_label(t timestamptz) returns text language sql stable as $$
  select ltrim(to_char(t at time zone 'Asia/Manila', 'HH12:MI AM'), '0')
$$;
create or replace function app.time_label(t timestamp) returns text language sql immutable as $$
  select ltrim(to_char(t, 'HH12:MI AM'), '0')
$$;
/** Local timestamp → timestamptz (Manila). */
create or replace function app.now_tz() returns timestamptz language sql stable as $$
  select app.now() at time zone 'Asia/Manila'
$$;

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

create table app.config (
  key   text primary key,
  value text not null
);
comment on table app.config is 'Deployment config. Set firebase_project_id to your Firebase project id.';

create table public.system_settings (
  id   boolean primary key default true check (id),
  data jsonb not null
);
comment on table public.system_settings is 'One row. Shape = SystemSettings in @dyh/core.';

/* ------------------------------------------------------------------ */
/* Clinics, rooms, doctors                                             */
/* ------------------------------------------------------------------ */

create table public.specializations (
  id         text primary key,
  name_tl    text not null,
  name_en    text not null,
  icon       text not null default 'stethoscope',
  services   text[] not null default '{}',   -- extra services shown on the specialization
  clinic_services text[] not null default '{}', -- Clinics & Services (admin)
  visible    boolean not null default true,
  sort       int not null default 0
);

create table public.rooms (
  number   text primary key,
  floor    int  not null,
  capacity int  not null default 1 check (capacity > 0),
  note     text
);

create table public.doctors (
  id                   text primary key,
  uid                  text unique,                  -- Firebase uid
  name                 text not null,
  specialization_id    text not null references public.specializations(id),
  room                 text references public.rooms(number) on update cascade,
  floor                int,
  clinic_days          int[] not null default '{}',  -- 0 = Sunday
  hours_start          int not null default 8 check (hours_start between 0 and 23),
  hours_end            int not null default 12 check (hours_end between 1 and 24),
  queue_prefix         text not null unique,
  credentials          text[] not null default '{}',
  email                text not null unique,
  mobile               text not null default '',
  max_patients_per_day int not null default 30 check (max_patients_per_day > 0),
  status               text not null default 'active' check (status in ('active', 'deactivated')),
  created_at           timestamptz not null default now(),
  check (hours_end > hours_start)
);

create table public.doctor_schedules (
  doctor_id          text primary key references public.doctors(id) on delete cascade,
  week               jsonb not null,        -- WeeklyScheduleDay[7]
  close_online_date  date                   -- "close online booking today" applies to this date only
);

create table public.blocked_dates (
  doctor_id    text not null references public.doctors(id) on delete cascade,
  date         date not null,
  reason       text not null,
  note         text,
  status       text not null default 'none' check (status in ('pending', 'sent', 'none')),
  notified_by  text,
  notified_at  timestamptz,
  created_at   timestamptz not null default now(),
  primary key (doctor_id, date)
);

/* ------------------------------------------------------------------ */
/* Staff                                                               */
/* ------------------------------------------------------------------ */

create table public.secretaries (
  id          text primary key,
  uid         text unique,
  name        text not null,
  email       text not null unique,
  mobile      text not null default '',
  status      text not null default 'active' check (status in ('active', 'deactivated')),
  created_at  date not null default (now() at time zone 'Asia/Manila')::date,
  created_by  text not null default 'System'
);

create table public.secretary_doctors (
  secretary_id text not null references public.secretaries(id) on delete cascade,
  doctor_id    text not null references public.doctors(id) on delete cascade,
  primary key (secretary_id, doctor_id)
);

create table public.admins (
  id           text primary key,
  uid          text unique,
  name         text not null,
  email        text not null unique,
  mobile       text not null default '',
  role         text not null default 'admin' check (role in ('super', 'admin')),
  permissions  jsonb not null default '{}',   -- PermissionSet
  doctor_id    text references public.doctors(id),
  credentials  text[] not null default '{}',
  status       text not null default 'active' check (status in ('active', 'deactivated')),
  created_at   date not null default (now() at time zone 'Asia/Manila')::date,
  created_by   text not null default 'System'
);

create table public.account_status_history (
  id          bigint generated always as identity primary key,
  account_id  text not null,
  status      text not null check (status in ('active', 'deactivated')),
  reason      text not null,
  at          timestamptz not null default now(),
  by_name     text not null
);
create index on public.account_status_history (account_id, at desc);

/** Unattended kiosk devices. The Cloud Function exchanges the device key for a Firebase token. */
create table public.kiosk_devices (
  id          text primary key,
  uid         text unique,
  name        text not null,
  key_hash    text not null,                 -- sha256 of the device key
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

/* ------------------------------------------------------------------ */
/* Patients                                                            */
/* ------------------------------------------------------------------ */

create sequence public.patient_seq start 5300;

create table public.patients (
  id                 text primary key default ('DYH-' || to_char(now() at time zone 'Asia/Manila', 'YYYY') || '-' || lpad(nextval('public.patient_seq')::text, 6, '0')),
  uid                text unique,             -- set when the patient signs in to the Patient App
  last_name          text not null default '',
  first_name         text not null default '',
  middle_name        text,
  suffix             text,
  display_name       text not null,
  birthday           date,
  approx_age         int,                     -- family members added with an age only
  sex                text check (sex in ('M', 'F')),
  mobile             text not null default '',
  mobile_digits      text generated always as (regexp_replace(mobile, '\D', '', 'g')) stored,
  email              text,
  address            jsonb,
  city               text,
  blood_type         text not null default 'unknown' check (blood_type in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown')),
  allergies          text[] not null default '{}',
  priority           text check (priority in ('senior', 'pwd')),
  emergency_contact  jsonb,
  created_via        text not null default 'app' check (created_via in ('app', 'kiosk', 'family', 'staff', 'import')),
  created_at         timestamptz not null default now()
);
create index on public.patients (mobile_digits);
create index on public.patients (lower(display_name));

create table public.family_links (
  owner_patient_id   text not null references public.patients(id) on delete cascade,
  member_patient_id  text not null references public.patients(id) on delete cascade,
  relation           text not null,
  created_at         timestamptz not null default now(),
  primary key (owner_patient_id, member_patient_id)
);
create index on public.family_links (member_patient_id);

/* ------------------------------------------------------------------ */
/* Bookings and the live queue                                         */
/* ------------------------------------------------------------------ */

create table public.bookings (
  id               text primary key,          -- BK-YYMMDD-NNN / WK-YYMMDD-NNN
  patient_id       text not null references public.patients(id),
  doctor_id        text not null references public.doctors(id),
  date             date not null,
  type             text not null check (type in ('online', 'walkin')),
  status           text not null default 'booked' check (status in ('booked', 'confirmed', 'unconfirmed', 'arrived', 'in_consultation', 'done', 'cancelled', 'rescheduled', 'skipped', 'no_show')),
  queue_number     text,
  is_follow_up     boolean not null default false,
  booked_by        jsonb,                      -- { name, relation } when a family member booked
  chief_complaint  text,
  created_at       timestamptz not null default now()
);
create index on public.bookings (doctor_id, date);
create index on public.bookings (patient_id, date desc);
-- One active booking per patient, doctor and day.
create unique index bookings_one_per_day on public.bookings (patient_id, doctor_id, date) where status not in ('cancelled', 'rescheduled');

create table public.queue_entries (
  id            bigint generated always as identity primary key,
  doctor_id     text not null references public.doctors(id),
  date          date not null,
  seq           int  not null,
  number        text not null,                -- IM-018
  patient_id    text not null references public.patients(id),
  patient_name  text not null,
  type          text not null check (type in ('online', 'walkin')),
  priority      text check (priority in ('senior', 'pwd')),
  status        text not null default 'waiting' check (status in ('waiting', 'serving', 'skipped', 'done', 'no_show')),
  sort_key      numeric not null,             -- order inside "waiting"
  booking_id    text references public.bookings(id),
  arrived_at    timestamptz not null default now(),
  called_at     timestamptz,
  skipped_at    timestamptz,
  done_at       timestamptz,
  unique (doctor_id, date, seq),
  unique (date, number)
);
create index on public.queue_entries (doctor_id, date, status, sort_key);
create index on public.queue_entries (patient_id);
-- At most one patient is being served per doctor.
create unique index queue_one_serving on public.queue_entries (doctor_id, date) where status = 'serving';

/** Walk-in QR handed out before the scan window opens; scanning it later issues the number. */
create table public.walk_in_qrs (
  code        text primary key,               -- WK-YYMMDD-NNN
  doctor_id   text not null references public.doctors(id),
  patient_id  text not null references public.patients(id),
  date        date not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create table public.vitals (
  date          date not null,
  queue_number  text not null,
  doctor_id     text not null references public.doctors(id),
  patient_id    text not null references public.patients(id),
  data          jsonb not null,               -- Vitals (bp, hr, temp, rr, o2, wt, ht, chiefComplaint)
  recorded_at   timestamptz not null default now(),
  recorded_by   text not null,
  primary key (date, queue_number)
);

/* ------------------------------------------------------------------ */
/* Medical records                                                     */
/* ------------------------------------------------------------------ */

create table public.consultations (
  id              text primary key default ('rec-' || replace(gen_random_uuid()::text, '-', '')),
  patient_id      text not null references public.patients(id),
  doctor_id       text not null references public.doctors(id),
  date            date not null,
  type            text not null check (type in ('online', 'walkin')),
  title           jsonb,                       -- Localized
  diagnoses       jsonb not null default '[]', -- Localized[]
  findings        jsonb not null,              -- Localized
  findings_summary text,
  prescriptions   jsonb not null default '[]', -- Prescription[]
  labs            text[] not null default '{}',
  notes           jsonb not null,              -- Localized
  vitals          jsonb,
  queue_number    text,
  verified_with   text not null check (verified_with in ('pin', 'biometric')),
  source          text not null check (source in ('typed', 'photo', 'voice', 'secretary')),
  signed_at       timestamptz not null default now(),
  prev_hash       text,
  integrity_hash  text not null
);
create index on public.consultations (patient_id, date desc);
create index on public.consultations (doctor_id, date desc);

create table public.addenda (
  id                bigint generated always as identity primary key,
  consultation_id   text not null references public.consultations(id),
  author_doctor_id  text not null references public.doctors(id),
  text              text not null,
  created_at        timestamptz not null default now()
);

/** The doctor asked the secretary to write up a finished consultation. */
create table public.delegations (
  id            bigint generated always as identity primary key,
  doctor_id     text not null references public.doctors(id),
  patient_id    text not null references public.patients(id),
  date          date not null,
  queue_number  text,
  note          text,
  created_at    timestamptz not null default now()
);
create unique index on public.delegations (doctor_id, patient_id, date);

/** Findings draft from the secretary, waiting for the doctor's signature. */
create table public.drafts (
  id                bigint generated always as identity primary key,
  doctor_id         text not null references public.doctors(id),
  patient_id        text not null references public.patients(id),
  date              date not null,
  queue_number      text,
  prepared_by       text not null,            -- secretary id
  prepared_by_name  text not null,
  mode              text not null check (mode in ('text', 'photo')),
  content           jsonb not null,           -- title, findings, diagnoses, prescriptions, labs, notes
  follow_up         jsonb,                    -- { date, purpose }
  status            text not null default 'pending' check (status in ('pending', 'signed')),
  follow_up_done    boolean not null default false,
  created_at        timestamptz not null default now()
);
create unique index drafts_one_pending on public.drafts (doctor_id, patient_id) where status = 'pending';

create table public.record_qr_tokens (
  token       text primary key,
  patient_id  text not null references public.patients(id) on delete cascade,
  expires_at  timestamptz not null,
  used_at     timestamptz
);

/* ------------------------------------------------------------------ */
/* Communication                                                       */
/* ------------------------------------------------------------------ */

create table public.notifications (
  id           bigint generated always as identity primary key,
  app          text not null check (app in ('patient', 'doctor', 'secretary', 'admin')),
  target_id    text,                           -- patient / doctor / secretary / admin id; null = everyone in that app
  icon         text not null default 'bell',
  tone         text not null default 'blue',
  title        jsonb not null,                 -- Localized
  body         jsonb not null,                 -- Localized
  category     text,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index on public.notifications (app, target_id, created_at desc);

create table public.notices (
  id          bigint generated always as identity primary key,
  doctor_id   text not null references public.doctors(id),
  date        date,
  template    text not null,
  message     text not null,
  channels    text[] not null,
  sent_count  int not null default 0,
  sent_by     text not null,
  created_at  timestamptz not null default now()
);

/** SMS waiting to be sent. A Cloud Function (or Supabase Edge Function) drains it. */
create table public.sms_outbox (
  id          bigint generated always as identity primary key,
  mobile      text not null,
  message     text not null,
  purpose     text not null default 'notice',
  status      text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  error       text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index on public.sms_outbox (status, created_at);

create table public.announcements (
  id          text primary key default ('a' || replace(gen_random_uuid()::text, '-', '')),
  icon        text not null,
  colors      text[] not null,
  title       text not null,
  subtitle    text not null default '',
  summary     text not null default '',
  body        text not null default '',
  from_date   date not null,
  to_date     date not null,
  audience    jsonb not null default '"all"',  -- "all" or { "clinics": [...] }
  is_draft    boolean not null default false,
  created_by  text,
  created_at  timestamptz not null default now()
);

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

create table public.ratings (
  consultation_id  text primary key references public.consultations(id),
  patient_id       text not null references public.patients(id),
  doctor_id        text not null references public.doctors(id),
  stars            int not null check (stars between 1 and 5),
  comment          text,
  created_at       timestamptz not null default now()
);

create table public.surveys (
  id          bigint generated always as identity primary key,
  answers     jsonb not null,
  kiosk_id    text,
  created_at  timestamptz not null default now()
);

/* ------------------------------------------------------------------ */
/* Administration                                                      */
/* ------------------------------------------------------------------ */

create table public.password_requests (
  id            text primary key default ('pr' || replace(gen_random_uuid()::text, '-', '')),
  account_id    text,
  name          text not null,
  role          text not null check (role in ('doctor', 'secretary')),
  email         text not null,
  message       text not null default '',
  otp_verified  boolean not null default false,
  status        text not null default 'pending' check (status in ('pending', 'sent')),
  created_at    timestamptz not null default now()
);

create table public.generated_reports (
  id            text primary key default ('r' || replace(gen_random_uuid()::text, '-', '')),
  scope         text not null,
  title         jsonb not null,
  from_date     date not null,
  to_date       date not null,
  generated_on  date not null default (now() at time zone 'Asia/Manila')::date,
  created_by    text
);

/** Append-only. Each row's hash covers the previous row's hash, so edits are detectable. */
create table public.audit_logs (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  user_name  text not null,
  role       text not null check (role in ('Admin', 'Doctor', 'Secretary', 'Patient', 'Kiosk', 'System')),
  action     text not null,
  details    text not null default '',
  prev_hash  text,
  hash       text not null
);

/** One-time codes for patient sign-in and kiosk lookup. Only the service role touches this. */
create table app.otp_codes (
  id          bigint generated always as identity primary key,
  mobile      text not null,                  -- digits only
  code_hash   text not null,
  purpose     text not null check (purpose in ('login', 'kiosk', 'register')),
  attempts    int not null default 0,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index on app.otp_codes (mobile, created_at desc);
