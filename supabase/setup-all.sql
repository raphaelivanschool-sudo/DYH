-- DYH: everything in one file for the Supabase SQL editor (migrations + sample data). Run once on an empty project.

-- ===== supabase/migrations/20261123000100_schema.sql =====
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

-- ===== supabase/migrations/20261123000200_access.sql =====
-- =====================================================================
-- Access rules
--
-- Who is calling: Firebase signs the token, Supabase verifies it, and
-- auth.jwt() exposes its claims. We only trust tokens issued for OUR
-- Firebase project (iss / aud), then look the uid up in the staff,
-- kiosk and patient tables. Deactivated accounts resolve to nothing,
-- so deactivating someone cuts their access immediately.
--
-- How data is reached: the apps call the functions in 0300_api.sql
-- (supabase.rpc). Tables have RLS on with no direct write access, so
-- every write goes through a function that checks the rules.
-- =====================================================================

/* ------------------------------------------------------------------ */
/* Who is calling                                                      */
/* ------------------------------------------------------------------ */

create or replace function app.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

/** True only for tokens Firebase issued for this project. */
create or replace function app.is_trusted_token() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select app.jwt()->>'iss' = 'https://securetoken.google.com/' || c.value
        and app.jwt()->>'aud' = c.value
       from app.config c where c.key = 'firebase_project_id'),
    false)
$$;

create or replace function app.uid() returns text
language sql stable security definer set search_path = '' as $$
  select case when app.is_trusted_token() then nullif(app.jwt()->>'sub', '') end
$$;

create or replace function app.patient_id() returns text
language sql stable security definer set search_path = '' as $$
  select p.id from public.patients p where p.uid = app.uid()
$$;

create or replace function app.doctor_id() returns text
language sql stable security definer set search_path = '' as $$
  select d.id from public.doctors d where d.uid = app.uid() and d.status = 'active'
$$;

create or replace function app.secretary_id() returns text
language sql stable security definer set search_path = '' as $$
  select s.id from public.secretaries s where s.uid = app.uid() and s.status = 'active'
$$;

create or replace function app.admin_id() returns text
language sql stable security definer set search_path = '' as $$
  select a.id from public.admins a where a.uid = app.uid() and a.status = 'active'
$$;

create or replace function app.is_super() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.uid = app.uid() and a.status = 'active' and a.role = 'super')
$$;

create or replace function app.kiosk_id() returns text
language sql stable security definer set search_path = '' as $$
  select k.id from public.kiosk_devices k where k.uid = app.uid() and k.active
$$;

/** The secretary is assigned to this doctor by the Admin. */
create or replace function app.secretary_has(p_doctor text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.secretary_doctors sd where sd.secretary_id = app.secretary_id() and sd.doctor_id = p_doctor)
$$;

/** Doctor themself, or one of their secretaries. */
create or replace function app.is_doctor_staff(p_doctor text) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.doctor_id() = p_doctor or app.secretary_has(p_doctor)
$$;

/** The patient's own record, or a family member they manage. */
create or replace function app.is_my_patient(p_patient text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_patient = app.patient_id()
      or exists (select 1 from public.family_links f where f.owner_patient_id = app.patient_id() and f.member_patient_id = p_patient)
$$;

/** The doctor has seen, booked or queued this patient. */
create or replace function app.doctor_treats(p_doctor text, p_patient text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.queue_entries q where q.doctor_id = p_doctor and q.patient_id = p_patient)
      or exists (select 1 from public.bookings b where b.doctor_id = p_doctor and b.patient_id = p_patient)
      or exists (select 1 from public.consultations c where c.doctor_id = p_doctor and c.patient_id = p_patient)
$$;

/** Medical records: the patient (or family manager) and doctors treating them. Not secretaries, not admins. */
create or replace function app.can_read_records(p_patient text) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_my_patient(p_patient)
      or (app.doctor_id() is not null and app.doctor_treats(app.doctor_id(), p_patient))
$$;

/** Admin RBAC, same as canDo() in @dyh/core. */
create or replace function app.admin_can(p_module text, p_op text default null) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admins a
     where a.uid = app.uid() and a.status = 'active'
       and (a.role = 'super'
            or (p_op is null and a.permissions ? p_module)
            or coalesce((a.permissions -> p_module ->> p_op)::boolean, false)))
$$;

create or replace function app.require(p_ok boolean, p_message text default 'Not allowed') returns void
language plpgsql as $$
begin
  if not coalesce(p_ok, false) then
    raise exception using errcode = '42501', message = p_message;
  end if;
end $$;

/** Display name and audit role of the caller. */
create or replace function app.actor() returns table (name text, role text)
language sql stable security definer set search_path = '' as $$
  select coalesce(
           (select d.name from public.doctors d where d.id = app.doctor_id()),
           (select s.name from public.secretaries s where s.id = app.secretary_id()),
           (select a.name from public.admins a where a.id = app.admin_id()),
           (select k.name from public.kiosk_devices k where k.id = app.kiosk_id()),
           (select p.display_name from public.patients p where p.id = app.patient_id()),
           'System'),
         case when app.doctor_id() is not null then 'Doctor'
              when app.secretary_id() is not null then 'Secretary'
              when app.admin_id() is not null then 'Admin'
              when app.kiosk_id() is not null then 'Kiosk'
              when app.patient_id() is not null then 'Patient'
              else 'System' end
$$;

/* ------------------------------------------------------------------ */
/* Audit log with a hash chain                                         */
/* ------------------------------------------------------------------ */

create or replace function app.audit(p_action text, p_details text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_prev text;
  v_at   timestamptz := now();
  v_name text;
  v_role text;
begin
  select a.name, a.role into v_name, v_role from app.actor() a;
  perform pg_advisory_xact_lock(hashtext('dyh.audit'));
  select l.hash into v_prev from public.audit_logs l order by l.id desc limit 1;
  insert into public.audit_logs (at, user_name, role, action, details, prev_hash, hash)
  values (v_at, v_name, v_role, p_action, coalesce(p_details, ''), v_prev,
          encode(extensions.digest(coalesce(v_prev, '') || '|' || v_at::text || '|' || v_name || '|' || p_action || '|' || coalesce(p_details, ''), 'sha256'), 'hex'));
end $$;

/** Recomputes the chain; returns the first broken row id, or null if intact. */
create or replace function app.verify_audit_chain() returns bigint
language plpgsql stable security definer set search_path = '' as $$
declare
  r record;
  v_prev text;
begin
  for r in select * from public.audit_logs order by id loop
    if r.prev_hash is distinct from v_prev
       or r.hash <> encode(extensions.digest(coalesce(v_prev, '') || '|' || r.at::text || '|' || r.user_name || '|' || r.action || '|' || r.details, 'sha256'), 'hex') then
      return r.id;
    end if;
    v_prev := r.hash;
  end loop;
  return null;
end $$;

create or replace function app.forbid_change() returns trigger
language plpgsql as $$
begin
  raise exception using errcode = '42501', message = TG_TABLE_NAME || ' rows cannot be changed or deleted';
end $$;

create trigger audit_logs_append_only before update or delete on public.audit_logs
  for each row execute function app.forbid_change();
-- Signed consultations are permanent; corrections are addenda.
create trigger consultations_immutable before update or delete on public.consultations
  for each row execute function app.forbid_change();
create trigger addenda_immutable before update or delete on public.addenda
  for each row execute function app.forbid_change();

/* ------------------------------------------------------------------ */
/* Live topics (Realtime)                                              */
/* ------------------------------------------------------------------ */
-- The apps subscribe to this small table instead of the data tables, so
-- Realtime never carries patient details. Each change bumps a topic with
-- the same names the mock adapter uses: queue:<doctorId>, schedule:<doctorId>, drafts, ...

create table public.live_topics (
  topic       text primary key,
  version     bigint not null default 0,
  updated_at  timestamptz not null default now()
);

create or replace function app.touch(p_topic text) returns void
language sql security definer set search_path = '' as $$
  insert into public.live_topics (topic, version, updated_at) values (p_topic, 1, now())
  on conflict (topic) do update set version = public.live_topics.version + 1, updated_at = now()
$$;

/** Trigger: TG_ARGV[0] = topic kind, TG_ARGV[1] = column holding the id (optional). */
create or replace function app.touch_topic() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_topic text := TG_ARGV[0];
begin
  if TG_NARGS > 1 then
    v_topic := v_topic || ':' || coalesce(v_row ->> TG_ARGV[1], '');
  end if;
  perform app.touch(v_topic);
  return null;
end $$;

create trigger t_queue after insert or update or delete on public.queue_entries for each row execute function app.touch_topic('queue', 'doctor_id');
create trigger t_sched after insert or update or delete on public.blocked_dates for each row execute function app.touch_topic('schedule', 'doctor_id');
create trigger t_sched2 after insert or update or delete on public.doctor_schedules for each row execute function app.touch_topic('schedule', 'doctor_id');
create trigger t_doctors after insert or update or delete on public.doctors for each statement execute function app.touch_topic('doctors');
create trigger t_drafts after insert or update or delete on public.drafts for each statement execute function app.touch_topic('drafts');
create trigger t_deleg after insert or update or delete on public.delegations for each statement execute function app.touch_topic('drafts');
create trigger t_vitals after insert or update or delete on public.vitals for each statement execute function app.touch_topic('vitals');
create trigger t_records after insert on public.consultations for each statement execute function app.touch_topic('records');
create trigger t_addenda after insert on public.addenda for each statement execute function app.touch_topic('records');
create trigger t_bookings after insert or update or delete on public.bookings for each statement execute function app.touch_topic('bookings');
create trigger t_ann after insert or update or delete on public.announcements for each statement execute function app.touch_topic('announcements');
create trigger t_settings after insert or update on public.system_settings for each statement execute function app.touch_topic('settings');
create trigger t_rooms after insert or update or delete on public.rooms for each statement execute function app.touch_topic('rooms');
create trigger t_clinics after insert or update or delete on public.specializations for each statement execute function app.touch_topic('clinics');
create trigger t_acc1 after insert or update or delete on public.secretaries for each statement execute function app.touch_topic('accounts');
create trigger t_acc2 after insert or update or delete on public.admins for each statement execute function app.touch_topic('accounts');
create trigger t_acc3 after insert or update or delete on public.password_requests for each statement execute function app.touch_topic('accounts');
create trigger t_notif after insert or update on public.notifications for each statement execute function app.touch_topic('notifications');

/* ------------------------------------------------------------------ */
/* Row level security                                                  */
/* ------------------------------------------------------------------ */

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
revoke all on all sequences in schema public from anon, authenticated;

-- Reject tokens from any other issuer before any other policy is considered.
create policy only_our_firebase on public.live_topics as restrictive for select to authenticated using (app.is_trusted_token());
create policy read_topics on public.live_topics for select to authenticated using (true);
grant select on public.live_topics to authenticated;

-- Defence in depth for anyone reading tables directly (e.g. from the dashboard's API key):
-- the same rules the functions use. Writes have no policy, so they are refused.
create policy only_our_firebase on public.patients as restrictive for select to authenticated using (app.is_trusted_token());
create policy patients_read on public.patients for select to authenticated
  using (app.is_my_patient(id) or app.is_super()
         or exists (select 1 from public.queue_entries q where q.patient_id = patients.id and app.is_doctor_staff(q.doctor_id))
         or exists (select 1 from public.bookings b where b.patient_id = patients.id and app.is_doctor_staff(b.doctor_id)));
grant select on public.patients to authenticated;

create policy only_our_firebase on public.consultations as restrictive for select to authenticated using (app.is_trusted_token());
create policy consultations_read on public.consultations for select to authenticated using (app.can_read_records(patient_id));
grant select on public.consultations to authenticated;

create policy only_our_firebase on public.queue_entries as restrictive for select to authenticated using (app.is_trusted_token());
create policy queue_read on public.queue_entries for select to authenticated
  using (app.is_doctor_staff(doctor_id) or app.is_my_patient(patient_id) or app.kiosk_id() is not null);
grant select on public.queue_entries to authenticated;

create policy only_our_firebase on public.bookings as restrictive for select to authenticated using (app.is_trusted_token());
create policy bookings_read on public.bookings for select to authenticated using (app.is_my_patient(patient_id) or app.is_doctor_staff(doctor_id));
grant select on public.bookings to authenticated;

-- Catalog is public.
create policy catalog_read on public.specializations for select to anon, authenticated using (visible or app.admin_id() is not null);
grant select on public.specializations to anon, authenticated;
create policy catalog_read on public.rooms for select to anon, authenticated using (true);
grant select on public.rooms to anon, authenticated;

-- Helpers used inside policies must be callable by the querying role; the rest of app.* is not.
grant usage on schema app to anon, authenticated;
revoke execute on all functions in schema app from public, anon, authenticated;
grant execute on function app.jwt(), app.is_trusted_token(), app.uid(), app.patient_id(), app.doctor_id(), app.secretary_id(),
  app.admin_id(), app.is_super(), app.kiosk_id(), app.secretary_has(text), app.is_doctor_staff(text), app.is_my_patient(text),
  app.doctor_treats(text, text), app.can_read_records(text) to anon, authenticated;

-- Realtime: broadcast changes to live_topics (the publication exists on Supabase projects).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.live_topics;
  end if;
end $$;

-- ===== supabase/migrations/20261123000300_helpers.sql =====
-- =====================================================================
-- JSON shapes and shared business rules
--
-- Every builder returns exactly the JSON the apps expect (types in
-- packages/core/src/types.ts), so the Supabase adapter passes results
-- straight through. Rules mirror packages/core/src/rules/index.ts.
-- =====================================================================

create or replace function app.loc(t text) returns jsonb language sql immutable as $$
  select case when t is null then null else jsonb_build_object('tl', t, 'en', t) end
$$;

create or replace function app.settings() returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce((select s.data from public.system_settings s), '{}'::jsonb)
$$;
create or replace function app.setting_int(p_key text, p_default int) returns int language sql stable as $$
  select coalesce((app.settings() ->> p_key)::int, p_default)
$$;

create or replace function app.initials(p_name text) returns text language sql immutable as $$
  select upper(string_agg(left(w, 1), '')) from (
    select w from regexp_split_to_table(regexp_replace(coalesce(p_name, ''), '^(Dr|Sek|Sec)\.\s*', ''), '\s+') with ordinality as t(w, i)
     where w <> '' and w !~ ',' order by i limit 2) s
$$;

/** "Juan Dela Cruz" → "J. D. C." for screens that show other people's queue slots. */
create or replace function app.mask_name(p_name text) returns text language sql immutable as $$
  select string_agg(left(w, 1) || '.', ' ') from regexp_split_to_table(coalesce(p_name, ''), '\s+') w where w <> ''
$$;

/** "7:00 AM" from a fractional hour. */
create or replace function app.hour_label(h numeric) returns text language sql immutable as $$
  select app.time_label(('2000-01-01'::date + make_interval(mins => round(h * 60)::int))::timestamp)
$$;

/** Localized relative time for notifications. */
create or replace function app.when_label(t timestamptz) returns jsonb language plpgsql stable as $$
declare
  v_local timestamp := t at time zone 'Asia/Manila';
  v_min   int := floor(extract(epoch from (app.now() - v_local)) / 60);
  v_tl    text[] := array['Ene','Peb','Mar','Abr','May','Hun','Hul','Ago','Set','Okt','Nob','Dis'];
begin
  if v_min < 1 then return jsonb_build_object('tl', 'Ngayon lang', 'en', 'Just now'); end if;
  if v_min < 60 then return jsonb_build_object('tl', v_min || ' min ang nakalipas', 'en', v_min || ' min ago'); end if;
  if v_local::date = app.today() then return app.loc(app.time_label(v_local)); end if;
  if v_local::date = app.today() - 1 then return jsonb_build_object('tl', 'Kahapon', 'en', 'Yesterday'); end if;
  return jsonb_build_object('tl', v_tl[extract(month from v_local)::int] || ' ' || extract(day from v_local),
                            'en', to_char(v_local, 'Mon FMDD'));
end $$;

/* ------------------------------------------------------------------ */
/* Shapes                                                              */
/* ------------------------------------------------------------------ */

create or replace function app.status_history(p_id text) returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('status', h.status, 'reason', h.reason,
           'at', to_char(h.at at time zone 'Asia/Manila', 'Mon FMDD, YYYY · ') || app.time_label(h.at), 'by', h.by_name) order by h.at desc), '[]')
    from public.account_status_history h where h.account_id = p_id
$$;

create or replace function app.doctor_json(d public.doctors, p_private boolean default true) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', d.id, 'name', d.name, 'specializationId', d.specialization_id, 'room', coalesce(d.room, ''), 'floor', coalesce(d.floor, 0),
    'clinicDays', to_jsonb(d.clinic_days), 'hours', jsonb_build_object('start', d.hours_start, 'end', d.hours_end),
    'queuePrefix', d.queue_prefix, 'credentials', to_jsonb(d.credentials),
    'email', case when p_private then d.email else '' end,
    'mobile', case when p_private then d.mobile else '' end,
    'maxPatientsPerDay', d.max_patients_per_day, 'status', d.status)
  || case when p_private then jsonb_build_object('statusHistory', app.status_history(d.id)) else '{}'::jsonb end
$$;

create or replace function app.age_of(p public.patients) returns int language sql stable as $$
  select coalesce(extract(year from age(app.today(), p.birthday))::int,
                  p.approx_age + extract(year from age(app.today(), (p.created_at at time zone 'Asia/Manila')::date))::int, 0)
$$;

create or replace function app.patient_json(p public.patients) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', p.id,
    'name', jsonb_strip_nulls(jsonb_build_object('last', p.last_name, 'first', p.first_name, 'middle', p.middle_name, 'suffix', p.suffix)),
    'displayName', p.display_name, 'birthday', p.birthday, 'age', app.age_of(p), 'sex', p.sex,
    'mobile', p.mobile, 'email', p.email, 'address', p.address, 'city', p.city, 'bloodType', p.blood_type,
    'allergies', to_jsonb(p.allergies), 'emergencyContact', p.emergency_contact,
    'lastVisit', (select max(c.date) from public.consultations c where c.patient_id = p.id),
    'visits', (select count(*) from public.consultations c where c.patient_id = p.id)))
  || jsonb_build_object('priority', p.priority)
$$;

create or replace function app.entry_json(q public.queue_entries, p_mask boolean default false) returns jsonb
language sql stable as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'number', q.number,
    'patientId', case when p_mask and not app.is_my_patient(q.patient_id) then '' else q.patient_id end,
    'patientName', case when p_mask and not app.is_my_patient(q.patient_id) then app.mask_name(q.patient_name) else q.patient_name end,
    'type', q.type, 'arrivedAt', app.time_label(q.arrived_at), 'bookingId', q.booking_id))
  || jsonb_build_object('priority', q.priority)
$$;

create or replace function app.booking_json(b public.bookings) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', b.id, 'patientId', b.patient_id,
    'patientName', (select p.display_name from public.patients p where p.id = b.patient_id),
    'doctorId', b.doctor_id, 'date', b.date, 'type', b.type, 'status', b.status, 'queueNumber', b.queue_number,
    'isFollowUp', nullif(b.is_follow_up, false), 'bookedBy', b.booked_by, 'chiefComplaint', b.chief_complaint))
$$;

create or replace function app.record_json(c public.consultations) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', c.id, 'patientId', c.patient_id, 'date', c.date, 'doctorId', c.doctor_id,
    'doctorName', (select d.name from public.doctors d where d.id = c.doctor_id),
    'type', c.type, 'title', c.title, 'diagnoses', c.diagnoses, 'findings', c.findings,
    'prescriptions', c.prescriptions, 'labs', to_jsonb(c.labs), 'notes', c.notes, 'vitals', c.vitals,
    'addendum', (select jsonb_build_object('date', (a.created_at at time zone 'Asia/Manila')::date, 'text', app.loc(a.text), 'authorDoctorId', a.author_doctor_id)
                   from public.addenda a where a.consultation_id = c.id order by a.created_at desc limit 1),
    'integrityHash', left(c.integrity_hash, 16) || '…'))
  || jsonb_build_object('signed', true)
$$;

create or replace function app.blocked_json(b public.blocked_dates) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'doctorId', b.doctor_id, 'date', b.date, 'reason', b.reason, 'note', b.note, 'status', b.status,
    'affected', (select count(*) from public.bookings k where k.doctor_id = b.doctor_id and k.date = b.date and k.status not in ('cancelled', 'rescheduled')),
    'notifiedBy', b.notified_by,
    'notifiedAt', case when b.notified_at is not null then to_char(b.notified_at at time zone 'Asia/Manila', 'Mon FMDD · ') || app.time_label(b.notified_at) end))
$$;

/* ------------------------------------------------------------------ */
/* Clinic days and the live queue                                     */
/* ------------------------------------------------------------------ */

create or replace function app.has_clinic_on(d public.doctors, p_date date) returns boolean language sql stable as $$
  select extract(dow from p_date)::int = any (d.clinic_days)
$$;

create or replace function app.is_blocked(p_doctor text, p_date date) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocked_dates b where b.doctor_id = p_doctor and b.date = p_date)
$$;

/** Clinic today, not blocked, and not past closing time. */
create or replace function app.open_today(d public.doctors) returns boolean language sql stable as $$
  select d.status = 'active' and app.has_clinic_on(d, app.today()) and not app.is_blocked(d.id, app.today()) and app.hour() < d.hours_end
$$;

create or replace function app.queue_json(p_doctor text, p_mask boolean default false) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'doctorId', p_doctor,
    'serving', (select app.entry_json(q, p_mask) from public.queue_entries q where q.doctor_id = p_doctor and q.date = app.today() and q.status = 'serving'),
    'waiting', coalesce((select jsonb_agg(app.entry_json(q, p_mask) order by q.sort_key) from public.queue_entries q
                          where q.doctor_id = p_doctor and q.date = app.today() and q.status = 'waiting'), '[]'),
    'skipped', coalesce((select jsonb_agg(app.entry_json(q, p_mask) order by q.skipped_at) from public.queue_entries q
                          where q.doctor_id = p_doctor and q.date = app.today() and q.status = 'skipped'), '[]'),
    'doneCount', (select count(*) from public.queue_entries q where q.doctor_id = p_doctor and q.date = app.today() and q.status = 'done'),
    'expected', case when p_mask then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'bookingId', b.id, 'patientId', b.patient_id, 'patientName', p.display_name,
               'bookedBy', b.booked_by, 'chiefComplaint', app.loc(b.chief_complaint)))
             || jsonb_build_object('priority', p.priority) order by b.created_at)
        from public.bookings b join public.patients p on p.id = b.patient_id
       where b.doctor_id = p_doctor and b.date = app.today() and b.queue_number is null
         and b.status in ('booked', 'confirmed', 'unconfirmed')), '[]') end)
$$;

/**
 * Issue a queue number at the Kiosk. Same rules as issueNumber() in the mock:
 * scan window, daily cap, priority lane, one active number per patient per doctor.
 * Returns a KioskScanResult.
 */
create or replace function app.issue_number(p_doctor text, p_patient text, p_type text, p_booking text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d        public.doctors;
  p        public.patients;
  e        public.queue_entries;
  v_today  date := app.today();
  v_win    int := app.setting_int('scanWindowMinutes', 60);
  v_seq    int;
  v_first  numeric;
  v_before numeric;
  v_key    numeric;
begin
  select * into d from public.doctors where id = p_doctor;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  select * into p from public.patients where id = p_patient;
  if not found then return jsonb_build_object('status', 'not_found'); end if;

  perform pg_advisory_xact_lock(hashtext('dyh.queue.' || p_doctor || '.' || v_today));

  -- Already holding a number today: hand the same one back.
  select * into e from public.queue_entries
   where doctor_id = p_doctor and date = v_today and patient_id = p_patient and status in ('waiting', 'serving', 'skipped');
  if found then
    return jsonb_build_object('status', 'issued', 'doctorId', p_doctor, 'entry', app.entry_json(e),
      'position', (select count(*) from public.queue_entries w where w.doctor_id = p_doctor and w.date = v_today and w.status = 'waiting' and w.sort_key <= e.sort_key));
  end if;

  if not app.open_today(d) then
    return jsonb_build_object('status', 'wrong_day', 'doctorId', p_doctor);
  end if;

  if app.hour() < d.hours_start - v_win / 60.0
     and not exists (select 1 from public.queue_entries s where s.doctor_id = p_doctor and s.date = v_today and s.status = 'serving') then
    return jsonb_build_object('status', 'too_early', 'doctorId', p_doctor, 'opensAt', app.hour_label(d.hours_start - v_win / 60.0));
  end if;

  if (select count(*) from public.queue_entries c where c.doctor_id = p_doctor and c.date = v_today) >= d.max_patients_per_day then
    return jsonb_build_object('status', 'full', 'doctorId', p_doctor);
  end if;

  select coalesce(max(seq), 0) + 1 into v_seq from public.queue_entries where doctor_id = p_doctor and date = v_today;

  -- Priority lane: insert before the first regular patient (insertIntoQueue in @dyh/core).
  if p.priority is not null then
    select min(sort_key) into v_first from public.queue_entries
     where doctor_id = p_doctor and date = v_today and status = 'waiting' and priority is null;
  end if;
  if v_first is not null then
    select max(sort_key) into v_before from public.queue_entries
     where doctor_id = p_doctor and date = v_today and status = 'waiting' and sort_key < v_first;
    v_key := (coalesce(v_before, v_first - 1) + v_first) / 2;
  else
    select coalesce(max(sort_key), 0) + 1 into v_key from public.queue_entries where doctor_id = p_doctor and date = v_today;
  end if;

  insert into public.queue_entries (doctor_id, date, seq, number, patient_id, patient_name, type, priority, sort_key, booking_id, arrived_at)
  values (p_doctor, v_today, v_seq, d.queue_prefix || '-' || lpad(v_seq::text, 3, '0'), p_patient, p.display_name, p_type, p.priority, v_key, p_booking, app.now_tz())
  returning * into e;

  if p_booking is not null then
    update public.bookings set queue_number = e.number, status = 'arrived' where id = p_booking;
  end if;

  return jsonb_build_object('status', 'issued', 'doctorId', p_doctor, 'entry', app.entry_json(e),
    'position', (select count(*) from public.queue_entries w where w.doctor_id = p_doctor and w.date = v_today and w.status = 'waiting' and w.sort_key <= e.sort_key));
end $$;

/* ------------------------------------------------------------------ */
/* Booking availability (dayAvailability in @dyh/core)                 */
/* ------------------------------------------------------------------ */

create or replace function app.day_availability(d public.doctors, p_date date, p_no_show boolean) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today  date := app.today();
  v_online int;
  v_walkin int;
  v_total  int;
  v_cap    int := d.max_patients_per_day;
  base     jsonb := jsonb_build_object('date', p_date, 'online', 0, 'walkin', 0, 'total', 0, 'capacity', d.max_patients_per_day, 'left', 0);
begin
  if extract(dow from p_date) = 0 or not app.has_clinic_on(d, p_date) then
    return base || '{"available": false, "reason": "no_clinic"}';
  end if;
  if p_date < v_today or (p_date = v_today and app.hour() >= d.hours_end) then
    return base || '{"available": false, "reason": "past"}';
  end if;
  if app.is_blocked(d.id, p_date) then
    return base || '{"available": false, "reason": "blocked"}';
  end if;

  select count(*) filter (where b.type = 'online'), count(*) filter (where b.type = 'walkin' and b.queue_number is null)
    into v_online, v_walkin
    from public.bookings b where b.doctor_id = d.id and b.date = p_date and b.status not in ('cancelled', 'rescheduled');
  v_walkin := v_walkin + (select count(*) from public.queue_entries q where q.doctor_id = d.id and q.date = p_date and q.booking_id is null);
  v_total := v_online + v_walkin;
  base := base || jsonb_build_object('online', v_online, 'walkin', v_walkin, 'total', v_total);

  if v_total >= v_cap or (p_date = v_today and (select s.close_online_date from public.doctor_schedules s where s.doctor_id = d.id) = v_today) then
    return base || '{"available": false, "reason": "full"}';
  end if;
  if p_date <> v_today and p_no_show then
    return base || '{"available": false, "reason": "no_show_restriction"}';
  end if;
  return base || jsonb_build_object('available', true, 'left', v_cap - v_total);
end $$;

/** After a no-show, the next visit must be a same-day walk-in. */
create or replace function app.no_show_restricted(p_patient text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select b.status = 'no_show' from public.bookings b
                    where b.patient_id = p_patient and b.date < app.today() and b.status not in ('cancelled', 'rescheduled')
                    order by b.date desc limit 1), false)
$$;

/** BK-YYMMDD-NNN / WK-YYMMDD-NNN, unique. */
create or replace function app.next_booking_id(p_date date, p_prefix text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_stem text := p_prefix || '-' || to_char(p_date, 'YYMMDD') || '-';
  v_n int;
begin
  perform pg_advisory_xact_lock(hashtext('dyh.bk.' || v_stem));
  select coalesce(max(split_part(x.id, '-', 3)::int), 0) + 1 into v_n from (
    select id from public.bookings where id like v_stem || '%'
    union all select code from public.walk_in_qrs where code like v_stem || '%') x;
  return v_stem || lpad(v_n::text, 3, '0');
end $$;

/* ------------------------------------------------------------------ */
/* Notifications and SMS                                               */
/* ------------------------------------------------------------------ */

create or replace function app.notify(p_app text, p_target text, p_icon text, p_tone text, p_title jsonb, p_body jsonb, p_category text default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (app, target_id, icon, tone, title, body, category)
  values (p_app, p_target, p_icon, p_tone, p_title, p_body, p_category)
$$;

create or replace function app.notify_secretaries(p_doctor text, p_icon text, p_tone text, p_title jsonb, p_body jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (app, target_id, icon, tone, title, body)
  select 'secretary', sd.secretary_id, p_icon, p_tone, p_title, p_body from public.secretary_doctors sd where sd.doctor_id = p_doctor
$$;

create or replace function app.queue_sms(p_mobile text, p_message text, p_purpose text default 'notice') returns void
language sql security definer set search_path = '' as $$
  insert into public.sms_outbox (mobile, message, purpose)
  select regexp_replace(p_mobile, '\D', '', 'g'), p_message, p_purpose where coalesce(p_mobile, '') <> ''
$$;

/* ------------------------------------------------------------------ */
/* One-time codes (service role only)                                  */
/* ------------------------------------------------------------------ */

/** Returns the 6-digit code to send by SMS. At most one per minute, five per hour per number. */
create or replace function app.issue_otp(p_mobile text, p_purpose text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_mobile text := regexp_replace(p_mobile, '\D', '', 'g');
  v_code   text := lpad((floor(random() * 1000000))::int::text, 6, '0');
begin
  if length(v_mobile) <> 11 or left(v_mobile, 2) <> '09' then
    raise exception using errcode = '22023', message = 'Invalid mobile number';
  end if;
  if exists (select 1 from app.otp_codes o where o.mobile = v_mobile and o.created_at > now() - interval '60 seconds') then
    raise exception using errcode = 'P0429', message = 'Please wait a minute before requesting another code';
  end if;
  if (select count(*) from app.otp_codes o where o.mobile = v_mobile and o.created_at > now() - interval '1 hour') >= 5 then
    raise exception using errcode = 'P0429', message = 'Too many codes requested. Try again later';
  end if;
  insert into app.otp_codes (mobile, code_hash, purpose, expires_at)
  values (v_mobile, extensions.crypt(v_code, extensions.gen_salt('bf')), p_purpose, now() + interval '5 minutes');
  return v_code;
end $$;

/** Checks and consumes the latest code. Five wrong tries locks it. */
create or replace function app.check_otp(p_mobile text, p_code text, p_purpose text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_mobile text := regexp_replace(p_mobile, '\D', '', 'g');
  o app.otp_codes;
begin
  select * into o from app.otp_codes
   where mobile = v_mobile and purpose = p_purpose and consumed_at is null and expires_at > now()
   order by created_at desc limit 1 for update;
  if not found or o.attempts >= 5 then return false; end if;
  if o.code_hash = extensions.crypt(coalesce(p_code, ''), o.code_hash) then
    update app.otp_codes set consumed_at = now() where id = o.id;
    return true;
  end if;
  update app.otp_codes set attempts = attempts + 1 where id = o.id;
  return false;
end $$;

-- ===== supabase/migrations/20261123000400_api.sql =====
-- =====================================================================
-- API functions (called from the apps with supabase.rpc)
--
-- One function per DyhApi method in packages/api/src/contract.ts, named
-- in snake_case. Each one checks who is calling before it reads or
-- writes anything. All run as SECURITY DEFINER with a fixed search_path.
-- =====================================================================

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

/** Who am I in this app? Raises when the signed-in account has no access to it. */
create or replace function public.whoami(p_app text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
declare
  v_id   text;
  v_name text;
  v_role text;
begin
  perform app.require(app.uid() is not null, 'Not signed in');
  case p_app
    when 'doctor' then select id, name into v_id, v_name from doctors where id = app.doctor_id();
    when 'secretary' then select id, name into v_id, v_name from secretaries where id = app.secretary_id();
    when 'admin' then select id, name, role into v_id, v_name, v_role from admins where id = app.admin_id();
    when 'kiosk' then select id, name into v_id, v_name from kiosk_devices where id = app.kiosk_id();
    when 'patient' then
      select id, display_name into v_id, v_name from patients where id = app.patient_id();
      if v_id is null then
        -- Signed in with a verified mobile number but no record yet: the app shows registration.
        return jsonb_build_object('app', 'patient', 'userId', '', 'displayName', '', 'initials', '', 'needsRegistration', true);
      end if;
    else perform app.require(false, 'Unknown app');
  end case;
  perform app.require(v_id is not null, 'This account cannot use the ' || p_app || ' app, or it is deactivated');
  return jsonb_strip_nulls(jsonb_build_object('app', p_app, 'userId', v_id, 'displayName', v_name, 'initials', app.initials(v_name), 'role', v_role));
end $$;

/* ------------------------------------------------------------------ */
/* Catalog                                                             */
/* ------------------------------------------------------------------ */

create or replace function public.get_specializations() returns jsonb
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', jsonb_build_object('tl', s.name_tl, 'en', s.name_en), 'icon', s.icon, 'services', to_jsonb(s.services)) order by s.sort, s.id), '[]')
    from specializations s where s.visible or app.admin_id() is not null
$$;

create or replace function public.get_doctors() returns jsonb
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  -- Staff see contact details and history; patients and the kiosk do not.
  select coalesce(jsonb_agg(app.doctor_json(d, app.admin_id() is not null or app.doctor_id() is not null or app.secretary_id() is not null) order by d.id ~ '^d[0-9]+$' desc, length(d.id), d.id), '[]')
    from doctors d
   where d.status = 'active' or app.admin_id() is not null
$$;

create or replace function public.get_live_status() returns jsonb
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'doctorId', d.id,
      'openToday', app.open_today(d),
      'nowServing', (select q.number from queue_entries q where q.doctor_id = d.id and q.date = app.today() and q.status = 'serving'),
      'waiting', (select count(*) from queue_entries q where q.doctor_id = d.id and q.date = app.today() and q.status = 'waiting'),
      'servedToday', (select count(*) from queue_entries q where q.doctor_id = d.id and q.date = app.today() and q.status = 'done'),
      'avgWaitMinutes', (select round(avg(extract(epoch from (q.called_at - q.arrived_at)) / 60))::int
                           from queue_entries q where q.doctor_id = d.id and q.date = app.today() and q.called_at is not null))), '[]')
    from doctors d where d.status = 'active'
$$;

create or replace function public.get_availability(p_doctor text, p_no_show boolean default false) returns jsonb
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select coalesce(jsonb_agg(a order by a->>'date'), '[]')
    from doctors d,
         lateral generate_series(0, app.setting_int('bookingWindowDays', 7) - 1) i,
         lateral app.day_availability(d, app.today() + i, p_no_show or app.no_show_restricted(coalesce(app.patient_id(), ''))) a
   where d.id = p_doctor and d.status = 'active' and (a->>'available')::boolean
$$;

create or replace function public.get_announcements() returns jsonb
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select coalesce(jsonb_agg(x.j order by x.from_date desc), '[]') from (
    select a.from_date, jsonb_build_object(
      'id', a.id, 'icon', a.icon, 'colors', to_jsonb(a.colors), 'title', a.title, 'subtitle', a.subtitle, 'summary', a.summary,
      'body', a.body, 'from', a.from_date, 'to', a.to_date, 'audience', a.audience,
      'status', case when a.is_draft then 'draft' when a.from_date > app.today() then 'pending' when a.to_date < app.today() then 'expired' else 'active' end) j
    from announcements a
   where app.admin_id() is not null or (not a.is_draft and a.from_date <= app.today() and a.to_date >= app.today())) x
$$;

create or replace function public.get_settings() returns jsonb
language sql stable security definer set search_path = public, extensions, pg_temp as $$ select app.settings() $$;

create or replace function public.update_settings(p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  perform app.require(app.admin_can('settings', 'u'), 'You do not have permission to change system settings');
  update system_settings set data = data || p_patch;
  perform app.audit('System Settings', 'Changed ' || (select string_agg(k, ', ') from jsonb_object_keys(p_patch) k));
  return app.settings();
end $$;

create or replace function public.get_notifications(p_app text) returns jsonb
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', n.id::text, 'icon', n.icon, 'tone', n.tone, 'title', n.title, 'body', n.body,
      'when', app.when_label(n.created_at), 'unread', n.read_at is null, 'category', n.category)) order by n.created_at desc), '[]')
    from (select * from notifications n
           where n.app = p_app
             and (n.target_id is null and app.uid() is not null
                  or n.target_id = case p_app when 'patient' then app.patient_id() when 'doctor' then app.doctor_id()
                                              when 'secretary' then app.secretary_id() when 'admin' then app.admin_id() end)
           order by n.created_at desc limit 100) n
$$;

create or replace function public.mark_notifications_read(p_app text) returns void
language sql security definer set search_path = public, extensions, pg_temp as $$
  update notifications set read_at = now()
   where app = p_app and read_at is null
     and target_id = case p_app when 'patient' then app.patient_id() when 'doctor' then app.doctor_id()
                                when 'secretary' then app.secretary_id() when 'admin' then app.admin_id() end
$$;

/* ------------------------------------------------------------------ */
/* Patient                                                             */
/* ------------------------------------------------------------------ */

/**
 * First sign-in with a mobile number that has no record yet. The mobile comes from the
 * verified token (the Cloud Function puts it there after the OTP check), never from the app.
 */
create or replace function public.register_patient(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_mobile text := app.jwt() ->> 'mobile';
  r patients;
begin
  perform app.require(app.uid() is not null and v_mobile is not null, 'Sign in with your mobile number first');
  perform app.require(app.patient_id() is null, 'This mobile number already has a record');
  insert into patients (uid, last_name, first_name, middle_name, suffix, display_name, birthday, sex, mobile, email, address, city,
                        blood_type, allergies, priority, emergency_contact, created_via)
  values (app.uid(), p->>'last', p->>'first', nullif(p->>'middle', ''), nullif(p->>'suffix', ''),
          coalesce(p->>'displayName', concat_ws(' ', p->>'first', nullif(left(p->>'middle', 1) || '.', '.'), p->>'last', nullif(p->>'suffix', ''))),
          (p->>'birthday')::date, p->>'sex', v_mobile, p->>'email', p->'address', p->>'city',
          coalesce(p->>'bloodType', 'unknown'), coalesce((select array_agg(x) from jsonb_array_elements_text(p->'allergies') x), '{}'),
          p->>'priority', p->'emergencyContact', 'app')
  returning * into r;
  insert into family_links (owner_patient_id, member_patient_id, relation) values (r.id, r.id, 'self');
  return app.patient_json(r);
end $$;

create or replace function public.get_me() returns jsonb
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select app.patient_json(p) from patients p where p.id = app.patient_id()
$$;

create or replace function public.get_family() returns jsonb
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('patientId', p.id, 'displayName', p.display_name, 'relation', x.relation, 'age', app.age_of(p), 'priority', p.priority)
                            order by x.relation <> 'self', x.created_at), '[]')
    from (select app.patient_id() as id, 'self' as relation, '-infinity'::timestamptz as created_at
          union all
          select f.member_patient_id, f.relation, f.created_at from family_links f
           where f.owner_patient_id = app.patient_id() and f.member_patient_id <> f.owner_patient_id) x
    join patients p on p.id = x.id
$$;

create or replace function public.add_family_member(m jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  me patients;
  r  patients;
  v_name text := trim(m->>'displayName');
begin
  select * into me from patients where id = app.patient_id();
  perform app.require(me.id is not null, 'Only patients can add family members');
  perform app.require(coalesce(v_name, '') <> '', 'Name is required');
  insert into patients (display_name, first_name, last_name, approx_age, priority, mobile, created_via)
  values (v_name, regexp_replace(v_name, '\s+\S+$', ''), substring(v_name from '(\S+)$'), (m->>'age')::int, m->>'priority', me.mobile, 'family')
  returning * into r;
  insert into family_links (owner_patient_id, member_patient_id, relation) values (me.id, r.id, coalesce(m->>'relation', 'other'));
  return jsonb_build_object('patientId', r.id, 'displayName', r.display_name, 'relation', m->>'relation', 'age', app.age_of(r), 'priority', r.priority);
end $$;

create or replace function public.get_my_bookings() returns jsonb
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select coalesce(jsonb_agg(app.booking_json(b) order by b.date desc, b.created_at desc), '[]')
    from bookings b where app.is_my_patient(b.patient_id)
$$;

create or replace function public.get_my_records() returns jsonb
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select coalesce(jsonb_agg(app.record_json(c) order by c.date desc, c.signed_at desc), '[]')
    from consultations c where app.is_my_patient(c.patient_id)
$$;

create or replace function public.get_my_consultations() returns jsonb
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', c.id, 'doctorId', c.doctor_id, 'type', c.type, 'date', c.date, 'status', 'done', 'rating', r.stars))
                            order by c.date desc), '[]')
    from consultations c left join ratings r on r.consultation_id = c.id
   where app.is_my_patient(c.patient_id)
$$;

create or replace function public.create_booking(p_patient text, p_doctor text, p_date date, p_complaint text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  d   doctors;
  a   jsonb;
  b   bookings;
  rel text;
begin
  perform app.require(app.is_my_patient(p_patient), 'You can only book for yourself or your family');
  select * into d from doctors where id = p_doctor and status = 'active';
  perform app.require(d.id is not null, 'Doctor not found');
  perform app.require(p_date < app.today() + app.setting_int('bookingWindowDays', 7), 'That date is outside the booking window');
  perform pg_advisory_xact_lock(hashtext('dyh.cap.' || p_doctor || '.' || p_date));
  a := app.day_availability(d, p_date, app.no_show_restricted(p_patient));
  perform app.require((a->>'available')::boolean, 'This date is not available (' || coalesce(a->>'reason', '?') || ')');
  perform app.require(not exists (select 1 from bookings x where x.patient_id = p_patient and x.doctor_id = p_doctor and x.date = p_date and x.status not in ('cancelled', 'rescheduled')),
                      'Already booked with this doctor on this date');

  select f.relation into rel from family_links f where f.owner_patient_id = app.patient_id() and f.member_patient_id = p_patient and p_patient <> app.patient_id();
  insert into bookings (id, patient_id, doctor_id, date, type, chief_complaint, booked_by)
  values (app.next_booking_id(p_date, 'BK'), p_patient, p_doctor, p_date, case when p_date = app.today() then 'walkin' else 'online' end, p_complaint,
          case when rel is not null then jsonb_build_object('name', (select display_name from patients where id = app.patient_id()), 'relation', rel) end)
  returning * into b;
  return app.booking_json(b);
end $$;

create or replace function public.cancel_booking(p_id text) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  b bookings;
  d doctors;
begin
  select * into b from bookings where id = p_id for update;
  perform app.require(b.id is not null and app.is_my_patient(b.patient_id), 'Booking not found');
  perform app.require(b.status in ('booked', 'confirmed', 'unconfirmed'), 'This booking can no longer be cancelled');
  select * into d from doctors where id = b.doctor_id;
  perform app.require(b.date + make_interval(hours => d.hours_start) - app.now() >= make_interval(hours => app.setting_int('cancellationCutoffHours', 2)),
                      'Too late to cancel online. Please call the clinic.');
  update bookings set status = 'cancelled' where id = p_id;
end $$;

create or replace function public.confirm_booking(p_id text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare b bookings;
begin
  select * into b from bookings where id = p_id;
  perform app.require(b.id is not null and app.is_my_patient(b.patient_id), 'Booking not found');
  perform app.require(b.status in ('booked', 'unconfirmed', 'confirmed'), 'This booking can no longer be confirmed');
  update bookings set status = 'confirmed' where id = p_id returning * into b;
  return app.booking_json(b);
end $$;

create or replace function public.rate_consultation(p_id text, p_stars int, p_comment text default null) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare c consultations;
begin
  select * into c from consultations where id = p_id;
  perform app.require(c.id is not null and app.is_my_patient(c.patient_id), 'You can only rate your own consultations');
  perform app.require(not exists (select 1 from ratings r where r.consultation_id = p_id), 'Ratings cannot be edited once posted');
  insert into ratings (consultation_id, patient_id, doctor_id, stars, comment) values (p_id, c.patient_id, c.doctor_id, p_stars, nullif(trim(p_comment), ''));
end $$;

/** Short-lived Record QR token. The Kiosk resolves it with kiosk_identify_qr. */
create or replace function public.get_record_qr(p_patient text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_token text := 'DYH-REC:' || encode(gen_random_bytes(18), 'hex');
begin
  perform app.require(app.is_my_patient(p_patient), 'Not your record');
  delete from record_qr_tokens where patient_id = p_patient and (expires_at < now() or used_at is not null);
  insert into record_qr_tokens (token, patient_id, expires_at) values (v_token, p_patient, now() + interval '60 seconds');
  return jsonb_build_object('token', v_token, 'expiresInSec', 60);
end $$;

/* ------------------------------------------------------------------ */
/* Doctor                                                              */
/* ------------------------------------------------------------------ */

create or replace function public.get_queue(p_doctor text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
begin
  if app.is_doctor_staff(p_doctor) then return app.queue_json(p_doctor, false); end if;
  -- Kiosk and patients see the board with other people's names masked.
  perform app.require(app.kiosk_id() is not null or app.patient_id() is not null or app.admin_id() is not null, 'Not allowed');
  return app.queue_json(p_doctor, true);
end $$;

create or replace function public.get_doctor_patients(p_doctor text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
begin
  perform app.require(app.is_doctor_staff(p_doctor), 'Not allowed');
  return coalesce((select jsonb_agg(app.patient_json(p) order by p.display_name) from patients p where app.doctor_treats(p_doctor, p.id)), '[]');
end $$;

create or replace function public.get_patient_history(p_patient text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
begin
  perform app.require(app.can_read_records(p_patient), 'You cannot open this medical record');
  return coalesce((select jsonb_agg(app.record_json(c) order by c.date desc, c.signed_at desc) from consultations c where c.patient_id = p_patient), '[]');
end $$;

create or replace function public.get_today_vitals() returns jsonb
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select coalesce(jsonb_object_agg(v.queue_number, v.data || jsonb_build_object('recordedAt', app.time_label(v.recorded_at), 'recordedBy', v.recorded_by)), '{}')
    from vitals v where v.date = app.today() and app.is_doctor_staff(v.doctor_id)
$$;

create or replace function public.get_drafts(p_doctor text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
begin
  perform app.require(app.doctor_id() = p_doctor, 'Not allowed');
  return coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'patientId', r.patient_id, 'preparedBy', r.prepared_by_name, 'preparedAt', app.time_label(r.created_at), 'source', 'delegated', 'mode', r.mode,
      'followUp', case when r.follow_up is not null then jsonb_build_object('date', r.follow_up->>'date', 'purpose', app.loc(r.follow_up->>'purpose')) end,
      'signed', r.status = 'signed', 'followUpDone', r.follow_up_done,
      'queueNumber', r.queue_number, 'content', r.content)) order by r.created_at desc)
    from drafts r where r.doctor_id = p_doctor and (r.status = 'pending' or r.date = app.today())), '[]');
end $$;

create or replace function public.get_follow_ups(p_doctor text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
begin
  perform app.require(app.is_doctor_staff(p_doctor), 'Not allowed');
  return coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('patientId', b.patient_id, 'due', b.date, 'queueNumber', b.queue_number)) order by b.date)
                     from bookings b where b.doctor_id = p_doctor and b.is_follow_up and b.date >= app.today() and b.status not in ('cancelled', 'rescheduled')), '[]');
end $$;

/**
 * E-signature. Only the authoring doctor, after PIN / biometric check on the device.
 * The record is hash-chained and can never be updated or deleted (trigger).
 */
create or replace function public.sign_consultation(i jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_doc   text := app.doctor_id();
  v_pid   text := i->>'patientId';
  q       queue_entries;
  c       consultations;
  v_prev  text;
  v_body  jsonb;
begin
  perform app.require(v_doc is not null and v_doc = i->>'doctorId', 'Only the attending doctor can sign');
  perform app.require(app.doctor_treats(v_doc, v_pid), 'This patient is not in your queue or bookings');
  perform app.require(i->>'verifiedWith' in ('pin', 'biometric'), 'Confirm your identity with PIN or fingerprint');

  select * into q from queue_entries where doctor_id = v_doc and patient_id = v_pid and date = app.today() order by id desc limit 1;

  v_body := jsonb_build_object(
    'patientId', v_pid, 'doctorId', v_doc, 'date', app.today(), 'title', app.loc(i->>'title'),
    'diagnoses', coalesce((select jsonb_agg(app.loc(x)) from jsonb_array_elements_text(i->'diagnoses') x), '[]'),
    'findings', app.loc(i->>'findings'), 'prescriptions', coalesce(i->'prescriptions', '[]'),
    'labs', coalesce(i->'labs', '[]'), 'notes', app.loc(coalesce(i->>'notes', '')));

  perform pg_advisory_xact_lock(hashtext('dyh.records'));
  select integrity_hash into v_prev from consultations order by signed_at desc, id desc limit 1;

  insert into consultations (patient_id, doctor_id, date, type, title, diagnoses, findings, findings_summary, prescriptions, labs, notes,
                             vitals, queue_number, verified_with, source, prev_hash, integrity_hash)
  values (v_pid, v_doc, app.today(), coalesce(q.type, 'online'), v_body->'title', v_body->'diagnoses', v_body->'findings', i->>'findingsSummary',
          v_body->'prescriptions', coalesce((select array_agg(x) from jsonb_array_elements_text(i->'labs') x), '{}'), v_body->'notes',
          (select v.data from vitals v where v.date = app.today() and v.queue_number = q.number), q.number,
          i->>'verifiedWith', coalesce(i->>'source', 'typed'), v_prev,
          encode(digest(coalesce(v_prev, '') || v_body::text, 'sha256'), 'hex'))
  returning * into c;

  update drafts set status = 'signed' where doctor_id = v_doc and patient_id = v_pid and status = 'pending';
  update bookings set status = 'done' where id = q.booking_id;

  perform app.audit('Consultation Signed', 'Verified with ' || case when i->>'verifiedWith' = 'pin' then 'PIN' else 'Fingerprint' end || ' · ' || v_pid);
  perform app.notify('patient', v_pid, 'file-check', 'green',
    jsonb_build_object('tl', 'May bagong medical record', 'en', 'New medical record'),
    jsonb_build_object('tl', 'Nilagdaan na ng doktor ang iyong konsultasyon.', 'en', 'Your doctor has signed your consultation record.'), 'record');
  return app.record_json(c);
end $$;

create or replace function public.add_addendum(p_record text, p_text text) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare c consultations;
begin
  select * into c from consultations where id = p_record;
  perform app.require(c.id is not null and c.doctor_id = app.doctor_id(), 'Only the doctor who signed this record can add an addendum');
  perform app.require(coalesce(trim(p_text), '') <> '', 'Addendum text is required');
  insert into addenda (consultation_id, author_doctor_id, text) values (p_record, c.doctor_id, trim(p_text));
  perform app.audit('Record Addendum', p_record || ' · ' || c.patient_id);
end $$;

create or replace function public.book_follow_up(p_patient text, p_doctor text, p_date date, p_purpose text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  d doctors;
  b bookings;
  v_week jsonb;
begin
  perform app.require(app.doctor_id() = p_doctor or app.secretary_has(p_doctor), 'Not allowed');
  select * into d from doctors where id = p_doctor;
  select week into v_week from doctor_schedules where doctor_id = p_doctor;
  -- isFollowUpDateOk(): after today, a clinic day, not blocked.
  perform app.require(p_date > app.today()
                      and coalesce((v_week -> extract(dow from p_date)::int ->> 'on')::boolean, app.has_clinic_on(d, p_date))
                      and not app.is_blocked(p_doctor, p_date), 'Pick a clinic day after today that is not blocked');
  insert into bookings (id, patient_id, doctor_id, date, type, status, is_follow_up, chief_complaint)
  values (app.next_booking_id(p_date, 'BK'), p_patient, p_doctor, p_date, 'online', 'confirmed', true, coalesce(nullif(p_purpose, ''), 'Follow-up'))
  on conflict (patient_id, doctor_id, date) where status not in ('cancelled', 'rescheduled') do update set is_follow_up = true
  returning * into b;
  update drafts set follow_up_done = true where doctor_id = p_doctor and patient_id = p_patient and date = app.today();
  perform app.notify('patient', p_patient, 'calendar-check', 'blue',
    jsonb_build_object('tl', 'Balik-konsulta', 'en', 'Follow-up booked'),
    jsonb_build_object('tl', 'Naka-book ka kay ' || d.name || ' sa ' || to_char(p_date, 'Mon FMDD') || '.', 'en', 'You are booked with ' || d.name || ' on ' || to_char(p_date, 'Mon FMDD') || '.'), 'queue');
  return app.booking_json(b);
end $$;

create or replace function public.delegate_to_secretary(p_patient text, p_doctor text, p_note text default null) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare q queue_entries;
begin
  perform app.require(app.doctor_id() = p_doctor, 'Not allowed');
  select * into q from queue_entries where doctor_id = p_doctor and patient_id = p_patient and date = app.today() order by id desc limit 1;
  insert into delegations (doctor_id, patient_id, date, queue_number, note) values (p_doctor, p_patient, app.today(), q.number, p_note)
  on conflict (doctor_id, patient_id, date) do update set note = excluded.note;
  perform app.notify_secretaries(p_doctor, 'file-pen', 'purple',
    jsonb_build_object('tl', 'Gumawa ng findings draft', 'en', 'Findings draft requested'),
    app.loc(coalesce(q.number || ' · ', '') || coalesce(q.patient_name, p_patient) || coalesce(' — ' || p_note, '')));
end $$;

create or replace function public.get_schedule(p_doctor text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
declare
  d doctors;
  s doctor_schedules;
begin
  perform app.require(app.is_doctor_staff(p_doctor) or app.admin_id() is not null, 'Not allowed');
  select * into d from doctors where id = p_doctor;
  select * into s from doctor_schedules where doctor_id = p_doctor;
  return jsonb_build_object(
    'doctorId', p_doctor,
    'week', coalesce(s.week, (select jsonb_agg(case when i = any (d.clinic_days)
                                   then jsonb_build_object('on', true, 'in', lpad(d.hours_start::text, 2, '0') || ':00', 'out', lpad(d.hours_end::text, 2, '0') || ':00')
                                   else '{"on": false}'::jsonb end order by i) from generate_series(0, 6) i)),
    'maxPatientsPerDay', d.max_patients_per_day,
    'closeOnlineToday', coalesce(s.close_online_date = app.today(), false),
    'blocked', coalesce((select jsonb_agg(app.blocked_json(b) order by b.date) from blocked_dates b where b.doctor_id = p_doctor and b.date >= app.today() - 30), '[]'));
end $$;

create or replace function public.save_schedule(s jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_doc  text := s->>'doctorId';
  v_week jsonb := s->'week';
begin
  perform app.require(app.doctor_id() = v_doc, 'Only the doctor can change their schedule');
  perform app.require(jsonb_array_length(v_week) = 7, 'Week must have 7 days');
  insert into doctor_schedules (doctor_id, week, close_online_date)
  values (v_doc, v_week, case when (s->>'closeOnlineToday')::boolean then app.today() end)
  on conflict (doctor_id) do update set week = excluded.week, close_online_date = excluded.close_online_date;
  update doctors set
    clinic_days = coalesce((select array_agg(i - 1 order by i) from jsonb_array_elements(v_week) with ordinality w(d, i) where (d->>'on')::boolean), '{}'),
    hours_start = coalesce((select min(split_part(d->>'in', ':', 1)::int) from jsonb_array_elements(v_week) d where (d->>'on')::boolean), hours_start),
    hours_end   = coalesce((select max(ceil(split_part(d->>'out', ':', 1)::int + split_part(d->>'out', ':', 2)::int / 60.0))::int from jsonb_array_elements(v_week) d where (d->>'on')::boolean), hours_end),
    max_patients_per_day = coalesce((s->>'maxPatientsPerDay')::int, max_patients_per_day)
  where id = v_doc;
  return public.get_schedule(v_doc);
end $$;

create or replace function public.block_date(p_doctor text, p_date date, p_reason text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  b blocked_dates;
  v_aff int;
begin
  perform app.require(app.doctor_id() = p_doctor, 'Only the doctor can block their dates');
  perform app.require(p_date >= app.today(), 'Pick today or a later date');
  select count(*) into v_aff from bookings where doctor_id = p_doctor and date = p_date and status not in ('cancelled', 'rescheduled');
  insert into blocked_dates (doctor_id, date, reason, note, status) values (p_doctor, p_date, p_reason, p_note, case when v_aff > 0 then 'pending' else 'none' end)
  on conflict (doctor_id, date) do update set reason = excluded.reason, note = excluded.note
  returning * into b;
  if v_aff > 0 then
    perform app.notify_secretaries(p_doctor, 'calendar-x', 'amber',
      jsonb_build_object('tl', 'Na-block na petsa', 'en', 'Date blocked'),
      jsonb_build_object('tl', to_char(p_date, 'Mon FMDD') || ' · ' || v_aff || ' pasyenteng apektado. Ipaalam sa kanila.',
                         'en', to_char(p_date, 'Mon FMDD') || ' · ' || v_aff || ' patients affected. Please notify them.'));
  end if;
  return app.blocked_json(b);
end $$;

create or replace function public.remove_blocked_date(p_doctor text, p_date date) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  perform app.require(app.doctor_id() = p_doctor, 'Not allowed');
  delete from blocked_dates where doctor_id = p_doctor and date = p_date;
end $$;

/* ------------------------------------------------------------------ */
/* Secretary                                                           */
/* ------------------------------------------------------------------ */

create or replace function public.queue_action(p_doctor text, p_action text, p_index int default 0) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_today date := app.today();
  e queue_entries;
  v_now timestamptz := app.now_tz();
begin
  perform app.require(app.is_doctor_staff(p_doctor), 'Not allowed');
  perform pg_advisory_xact_lock(hashtext('dyh.queue.' || p_doctor || '.' || v_today));

  if p_action in ('skip', 'done') then
    select * into e from queue_entries where doctor_id = p_doctor and date = v_today and status = 'serving';
    if found then
      if p_action = 'skip' then
        update queue_entries set status = 'skipped', skipped_at = v_now where id = e.id;
        update bookings set status = 'skipped' where id = e.booking_id;
      else
        update queue_entries set status = 'done', done_at = v_now where id = e.id;
        update bookings set status = 'done' where id = e.booking_id;
      end if;
    end if;
  end if;

  if p_action in ('start', 'skip', 'done')
     and not exists (select 1 from queue_entries where doctor_id = p_doctor and date = v_today and status = 'serving') then
    select * into e from queue_entries where doctor_id = p_doctor and date = v_today and status = 'waiting' order by sort_key limit 1;
    if found then
      update queue_entries set status = 'serving', called_at = v_now where id = e.id;
      update bookings set status = 'in_consultation' where id = e.booking_id;
      perform app.notify('patient', e.patient_id, 'megaphone', 'green',
        jsonb_build_object('tl', 'Ikaw na! ' || e.number, 'en', 'It''s your turn! ' || e.number),
        app.loc((select 'Room ' || coalesce(d.room, '') || ' · ' || d.name from doctors d where d.id = p_doctor)), 'queue');
    end if;
  end if;

  if p_action in ('callBack', 'noShow') then
    select * into e from queue_entries where doctor_id = p_doctor and date = v_today and status = 'skipped'
     order by skipped_at offset greatest(p_index, 0) limit 1;
    if found then
      if p_action = 'callBack' then
        update queue_entries set status = 'waiting', skipped_at = null,
          sort_key = coalesce((select min(sort_key) from queue_entries where doctor_id = p_doctor and date = v_today and status = 'waiting'), 1) - 1
         where id = e.id;
      else
        update queue_entries set status = 'no_show' where id = e.id;
        update bookings set status = 'no_show' where id = e.booking_id;
        perform app.audit('Queue Update', e.number || ' marked as No-show');
      end if;
    end if;
  end if;

  return app.queue_json(p_doctor, false);
end $$;

create or replace function public.save_vitals(p_number text, v jsonb) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare e queue_entries;
begin
  select * into e from queue_entries where date = app.today() and number = p_number;
  perform app.require(e.id is not null, 'Queue number not found today');
  perform app.require(app.is_doctor_staff(e.doctor_id), 'Not allowed');
  insert into vitals (date, queue_number, doctor_id, patient_id, data, recorded_by, recorded_at)
  values (app.today(), p_number, e.doctor_id, e.patient_id, v - 'recordedAt' - 'recordedBy', (select name from app.actor()), app.now_tz())
  on conflict (date, queue_number) do update set data = excluded.data, recorded_at = excluded.recorded_at, recorded_by = excluded.recorded_by;
end $$;

create or replace function public.get_delegated(p_doctor text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
begin
  perform app.require(app.is_doctor_staff(p_doctor), 'Not allowed');
  return coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'name', q.patient_name, 'number', q.number, 'time', app.time_label(q.done_at),
      'delegated', g.id is not null, 'note', app.loc(g.note),
      'drafted', (select r.mode from drafts r where r.doctor_id = p_doctor and r.patient_id = q.patient_id and r.date = app.today() order by r.id desc limit 1),
      'patientId', q.patient_id)) order by g.id is null, q.done_at desc)
    from queue_entries q
    left join delegations g on g.doctor_id = q.doctor_id and g.patient_id = q.patient_id and g.date = q.date
   where q.doctor_id = p_doctor and q.date = app.today() and q.status = 'done'), '[]');
end $$;

create or replace function public.submit_findings_draft(i jsonb) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_doc text := i->>'doctorId';
  v_pid text := i->>'patientId';
begin
  perform app.require(app.secretary_has(v_doc), 'You are not assigned to this doctor');
  if coalesce(v_pid, '') = '' then
    select patient_id into v_pid from queue_entries where doctor_id = v_doc and date = app.today() and number = i->>'queueNumber';
  end if;
  perform app.require(v_pid is not null and app.doctor_treats(v_doc, v_pid), 'Patient not found in this doctor''s queue');
  delete from drafts where doctor_id = v_doc and patient_id = v_pid and status = 'pending';
  insert into drafts (doctor_id, patient_id, date, queue_number, prepared_by, prepared_by_name, mode, content, follow_up)
  values (v_doc, v_pid, app.today(), i->>'queueNumber', app.secretary_id(), (select name from app.actor()), coalesce(i->>'mode', 'text'),
          i - 'doctorId' - 'patientId' - 'queueNumber' - 'mode' - 'followUp', i->'followUp');
  perform app.notify('doctor', v_doc, 'file-pen', 'purple',
    jsonb_build_object('tl', 'May draft na pipirmahan', 'en', 'Draft ready to sign'),
    app.loc(coalesce(i->>'queueNumber' || ' · ', '') || coalesce(i->>'patientName', v_pid)), 'record');
end $$;

/** In-app and/or SMS notice to a doctor's patients (today's queue, or everyone booked on a blocked date). */
create or replace function public.send_patient_notice(i jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_doc   text := i->>'doctorId';
  v_date  date := nullif(i->>'date', '')::date;
  v_msg   text := i->>'message';
  v_ch    text[] := coalesce((select array_agg(x) from jsonb_array_elements_text(i->'channels') x), '{app}');
  v_n     int;
begin
  perform app.require(app.is_doctor_staff(v_doc), 'You can only message this doctor''s patients');
  perform app.require(coalesce(trim(v_msg), '') <> '', 'Message is required');

  create temporary table _to on commit drop as
    select distinct p.id, p.mobile from patients p
     where p.id in (select b.patient_id from bookings b
                     where v_date is not null and b.doctor_id = v_doc and b.date = v_date and b.status not in ('cancelled', 'rescheduled')
                    union
                    select q.patient_id from queue_entries q
                     where v_date is null and q.doctor_id = v_doc and q.date = app.today() and q.status in ('waiting', 'serving', 'skipped'));
  select count(*) into v_n from _to;

  if 'app' = any (v_ch) then
    insert into notifications (app, target_id, icon, tone, title, body, category)
    select 'patient', t.id, 'message-square', 'amber', jsonb_build_object('tl', 'Paalala mula sa klinika', 'en', 'Notice from the clinic'), app.loc(v_msg), 'queue' from _to t;
  end if;
  if 'sms' = any (v_ch) then
    perform app.queue_sms(t.mobile, v_msg) from _to t;
  end if;

  if v_date is not null then
    update blocked_dates set status = 'sent', notified_by = (select name from app.actor()), notified_at = now() where doctor_id = v_doc and date = v_date;
  end if;
  insert into notices (doctor_id, date, template, message, channels, sent_count, sent_by)
  values (v_doc, v_date, coalesce(i->>'template', 'custom'), v_msg, v_ch, v_n, (select name from app.actor()));
  perform app.audit('Patient Notice', v_n || ' patients · ' || array_to_string(v_ch, '+'));
  return jsonb_build_object('sent', v_n);
end $$;

/* ------------------------------------------------------------------ */
/* Kiosk                                                               */
/* ------------------------------------------------------------------ */

create or replace function public.kiosk_scan(p_code text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_code text := upper(trim(p_code));
  w walk_in_qrs;
  b bookings;
  r jsonb;
begin
  perform app.require(app.kiosk_id() is not null, 'Kiosk only');
  select * into w from walk_in_qrs where code = v_code;
  if found then
    if w.date <> app.today() then return jsonb_build_object('status', 'wrong_day', 'doctorId', w.doctor_id); end if;
    r := app.issue_number(w.doctor_id, w.patient_id, 'walkin');
    if r->>'status' = 'too_early' then return r || jsonb_build_object('walkInQr', v_code); end if;
    if r->>'status' = 'issued' then update walk_in_qrs set used_at = now() where code = v_code; end if;
    return r;
  end if;

  select * into b from bookings where id = v_code;
  if not found or b.status in ('cancelled', 'rescheduled') then return jsonb_build_object('status', 'not_found'); end if;
  if b.date <> app.today() then return jsonb_build_object('status', 'wrong_day', 'doctorId', b.doctor_id); end if;
  return app.issue_number(b.doctor_id, b.patient_id, b.type, b.id);
end $$;

create or replace function public.kiosk_join(p_doctor text, p_patient text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  r jsonb;
  v_code text;
begin
  perform app.require(app.kiosk_id() is not null, 'Kiosk only');
  r := app.issue_number(p_doctor, p_patient, 'walkin');
  if r->>'status' <> 'too_early' then return r; end if;
  select code into v_code from walk_in_qrs where doctor_id = p_doctor and patient_id = p_patient and date = app.today() and used_at is null;
  if v_code is null then
    v_code := app.next_booking_id(app.today(), 'WK');
    insert into walk_in_qrs (code, doctor_id, patient_id, date) values (v_code, p_doctor, p_patient, app.today());
  end if;
  return r || jsonb_build_object('walkInQr', v_code);
end $$;

create or replace function public.kiosk_register(r jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare p patients;
begin
  perform app.require(app.kiosk_id() is not null, 'Kiosk only');
  -- Same person registering twice at the kiosk gets their existing record back.
  select * into p from patients
   where lower(first_name) = lower(r->>'first') and lower(last_name) = lower(r->>'last') and birthday = (r->>'birthday')::date
     and mobile_digits = regexp_replace(r->>'mobile', '\D', '', 'g');
  if found then return app.patient_json(p); end if;
  insert into patients (last_name, first_name, middle_name, suffix, display_name, birthday, sex, mobile, address, blood_type, allergies, priority, emergency_contact, created_via)
  values (r->>'last', r->>'first', nullif(r->>'middle', ''), nullif(r->>'suffix', ''),
          concat_ws(' ', r->>'first', nullif(left(coalesce(r->>'middle', ''), 1) || '.', '.'), r->>'last', nullif(r->>'suffix', '')),
          (r->>'birthday')::date, r->>'sex', r->>'mobile', r->'address', coalesce(r->>'bloodType', 'unknown'),
          coalesce((select array_agg(x) from jsonb_array_elements_text(r->'allergies') x), '{}'), r->>'priority', r->'emergencyContact', 'kiosk')
  returning * into p;
  return app.patient_json(p);
end $$;

create or replace function public.kiosk_identify_qr(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare t record_qr_tokens;
begin
  perform app.require(app.kiosk_id() is not null, 'Kiosk only');
  update record_qr_tokens set used_at = now() where token = p_token and used_at is null and expires_at > now() returning * into t;
  perform app.require(t.token is not null, 'This Record QR has expired. Open it again in the Patient App.');
  return jsonb_build_object('patient', (select app.patient_json(p) from patients p where p.id = t.patient_id));
end $$;

/** Mobile + OTP lookup at the kiosk (the code was sent by the requestOtp Cloud Function). */
create or replace function public.kiosk_verify_otp(p_mobile text, p_otp text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare p patients;
begin
  perform app.require(app.kiosk_id() is not null, 'Kiosk only');
  perform app.require(app.check_otp(p_mobile, p_otp, 'kiosk'), 'Wrong or expired code');
  select * into p from patients where mobile_digits = regexp_replace(p_mobile, '\D', '', 'g')
   order by (uid is not null) desc, created_at limit 1;
  perform app.require(p.id is not null, 'No record with this mobile number. Please register.');
  return jsonb_build_object('patient', app.patient_json(p));
end $$;

create or replace function public.submit_survey(p_answers jsonb) returns void
language sql security definer set search_path = public, extensions, pg_temp as $$
  insert into surveys (answers, kiosk_id) select p_answers, app.kiosk_id() where app.uid() is not null
$$;

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

create or replace function public.get_admins() returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
begin
  perform app.require(app.admin_can('accounts'), 'Not allowed');
  return coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', a.id, 'name', a.name, 'email', a.email, 'mobile', a.mobile, 'role', a.role, 'createdBy', a.created_by, 'createdAt', a.created_at,
      'permissions', a.permissions, 'doctorId', a.doctor_id, 'credentials', to_jsonb(a.credentials), 'status', a.status,
      'statusHistory', app.status_history(a.id))) order by a.role desc, a.created_at) from admins a), '[]');
end $$;

create or replace function public.get_secretaries() returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
begin
  perform app.require(app.admin_can('accounts'), 'Not allowed');
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name, 'email', s.email, 'mobile', s.mobile,
      'doctorIds', coalesce((select jsonb_agg(sd.doctor_id order by sd.doctor_id) from secretary_doctors sd where sd.secretary_id = s.id), '[]'),
      'createdAt', s.created_at, 'createdBy', s.created_by, 'status', s.status, 'statusHistory', app.status_history(s.id)) order by s.created_at, s.id) from secretaries s), '[]');
end $$;

create or replace function public.get_rooms() returns jsonb
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('number', r.number, 'floor', r.floor, 'capacity', r.capacity) order by r.number), '[]') from rooms r
$$;

create or replace function public.add_room(r jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  perform app.require(app.admin_can('rooms', 'c'), 'Not allowed');
  insert into rooms (number, floor, capacity, note) values (r->>'number', (r->>'floor')::int, coalesce((r->>'capacity')::int, 1), r->>'note');
  perform app.audit('Room Added', 'Room ' || (r->>'number'));
  return jsonb_build_object('number', r->>'number', 'floor', (r->>'floor')::int, 'capacity', coalesce((r->>'capacity')::int, 1));
end $$;

create or replace function public.assign_room(p_doctor text, p_room text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare d doctors;
begin
  perform app.require(app.admin_can('rooms', 'u'), 'Not allowed');
  update doctors set room = p_room, floor = (select floor from rooms where number = p_room) where id = p_doctor returning * into d;
  perform app.require(d.id is not null, 'Doctor not found');
  perform app.audit('Account Changes', 'Assigned Room ' || p_room || ' to ' || d.name);
  return app.doctor_json(d);
end $$;

/** Creates the database row. The createStaffAccount Cloud Function then creates the Firebase login and links it. */
create or replace function public.admin_create_account(a jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_kind text := a->>'kind';
  v_id   text;
  v_by   text := (select name from app.actor());
  v_prefix text;
begin
  perform app.require(app.admin_can('accounts', 'c'), 'You do not have permission to create accounts');
  perform app.require(v_kind <> 'admin' or app.is_super(), 'Only the Super Admin can create admin accounts');
  if v_kind = 'doctor' then
    v_id := 'd' || (select coalesce(max(substring(id from 2)::int), 0) + 1 from doctors where id ~ '^d[0-9]+$');
    v_prefix := upper(coalesce(a->>'specializationId', 'DR'));
    if exists (select 1 from doctors where queue_prefix = v_prefix) then
      v_prefix := v_prefix || (select count(*) + 1 from doctors where queue_prefix like v_prefix || '%');
    end if;
    insert into doctors (id, name, specialization_id, room, floor, queue_prefix, credentials, email, mobile, clinic_days, hours_start, hours_end)
    values (v_id, a->>'name', a->>'specializationId', nullif(a->>'room', ''), (select floor from rooms where number = a->>'room'), v_prefix,
            coalesce((select array_agg(x) from jsonb_array_elements_text(a->'credentials') x), '{}'), lower(a->>'email'), coalesce(a->>'mobile', ''), '{1,2,3,4,5}', 8, 12);
  elsif v_kind = 'secretary' then
    v_id := 's' || (select coalesce(max(substring(id from 2)::int), 0) + 1 from secretaries where id ~ '^s[0-9]+$');
    insert into secretaries (id, name, email, mobile, created_by) values (v_id, a->>'name', lower(a->>'email'), coalesce(a->>'mobile', ''), v_by);
    insert into secretary_doctors (secretary_id, doctor_id) select v_id, x from jsonb_array_elements_text(coalesce(a->'doctorIds', '[]')) x;
  elsif v_kind = 'admin' then
    v_id := 'a' || (select coalesce(max(substring(id from 2)::int), 0) + 1 from admins where id ~ '^a[0-9]+$');
    insert into admins (id, name, email, mobile, permissions, doctor_id, credentials, created_by)
    values (v_id, a->>'name', lower(a->>'email'), coalesce(a->>'mobile', ''), coalesce(a->'permissions', '{}'), nullif(a->>'linkedDoctorId', ''),
            coalesce((select array_agg(x) from jsonb_array_elements_text(a->'credentials') x), '{}'), v_by);
  else
    perform app.require(false, 'Unknown account kind');
  end if;
  perform app.audit('Account Changes', 'Created ' || v_kind || ': ' || (a->>'name'));
  return jsonb_build_object('id', v_id, 'email', lower(a->>'email'));
end $$;

/** Service role only: link the Firebase uid after the login is created. */
create or replace function public.link_staff_uid(p_id text, p_uid text) returns void
language sql security definer set search_path = public, extensions, pg_temp as $$
  update doctors set uid = p_uid where id = p_id;
  update secretaries set uid = p_uid where id = p_id;
  update admins set uid = p_uid where id = p_id;
$$;

/** Service role only: staff rows that have no Firebase login yet, for first-time setup. */
create or replace function public.staff_missing_logins() returns jsonb
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select jsonb_build_object(
    'linkedAdmins', (select count(*) from admins where uid is not null),
    'rows', coalesce((select jsonb_agg(x order by x.ord, x.id) from (
        select 1 ord, 'doctor' kind, id, name, email, status from doctors where uid is null
        union all select 2, 'secretary', id, name, email, status from secretaries where uid is null
        union all select 3, 'admin', id, name, email, status from admins where uid is null) x), '[]'::jsonb))
$$;

/** Service role only: the account's Firebase uid and email, for the Edge Function. */
create or replace function public.staff_login_info(p_id text) returns jsonb
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select jsonb_build_object('uid', uid, 'email', email, 'name', name, 'status', status) from (
    select uid, email, name, status from doctors where id = p_id
    union all select uid, email, name, status from secretaries where id = p_id
    union all select uid, email, name, status from admins where id = p_id) x limit 1
$$;

create or replace function public.admin_update_account(p_id text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  perform app.require(app.admin_can('accounts', 'u'), 'You do not have permission to edit accounts');
  perform app.require(not exists (select 1 from admins where id = p_id) or app.is_super(), 'Only the Super Admin can edit admin accounts');
  update doctors set name = coalesce(p->>'name', name), email = coalesce(lower(p->>'email'), email), mobile = coalesce(p->>'mobile', mobile),
         specialization_id = coalesce(p->>'specializationId', specialization_id), room = coalesce(p->>'room', room),
         credentials = coalesce((select array_agg(x) from jsonb_array_elements_text(p->'credentials') x), credentials)
   where id = p_id;
  update secretaries set name = coalesce(p->>'name', name), email = coalesce(lower(p->>'email'), email), mobile = coalesce(p->>'mobile', mobile) where id = p_id;
  if p ? 'doctorIds' and exists (select 1 from secretaries where id = p_id) then
    delete from secretary_doctors where secretary_id = p_id;
    insert into secretary_doctors (secretary_id, doctor_id) select p_id, x from jsonb_array_elements_text(p->'doctorIds') x;
  end if;
  update admins set name = coalesce(p->>'name', name), email = coalesce(lower(p->>'email'), email), mobile = coalesce(p->>'mobile', mobile),
         permissions = coalesce(p->'permissions', permissions) where id = p_id;
  perform app.audit('Account Changes', 'Updated account ' || coalesce(p->>'name', p_id));
  return public.staff_login_info(p_id);
end $$;

create or replace function public.set_account_status(p_id text, p_status text, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_name text;
begin
  perform app.require(app.admin_can('accounts', 'd'), 'You do not have permission to change account status');
  perform app.require(coalesce(trim(p_reason), '') <> '', 'A reason is required');
  perform app.require(p_id <> coalesce(app.admin_id(), ''), 'You cannot deactivate your own account');
  update doctors set status = p_status where id = p_id returning name into v_name;
  if v_name is null then update secretaries set status = p_status where id = p_id returning name into v_name; end if;
  if v_name is null then
    perform app.require(app.is_super(), 'Only the Super Admin can change admin accounts');
    update admins set status = p_status where id = p_id returning name into v_name;
  end if;
  perform app.require(v_name is not null, 'Account not found');
  insert into account_status_history (account_id, status, reason, by_name) values (p_id, p_status, p_reason, (select name from app.actor()));
  perform app.audit('Account Changes', case when p_status = 'active' then 'Activated ' else 'Deactivated ' end || v_name || ': ' || p_reason);
  return public.staff_login_info(p_id);
end $$;

/** Returns the email to send the reset link to (the adapter sends it through Firebase). */
create or replace function public.admin_reset_password(p_id text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v jsonb := public.staff_login_info(p_id);
begin
  perform app.require(app.admin_can('accounts', 'u'), 'Not allowed');
  perform app.require(v is not null, 'Account not found');
  perform app.audit('Administrative Action', 'Sent reset link to ' || (v->>'name'));
  return jsonb_build_object('email', v->>'email');
end $$;

/** Staff "Forgot password" from the login screen (anyone can ask; the Admin decides). */
create or replace function public.request_password_reset(p_email text, p_message text default '') returns void
language sql security definer set search_path = public, extensions, pg_temp as $$
  insert into password_requests (account_id, name, role, email, message)
  select x.id, x.name, x.role, x.email, coalesce(p_message, '') from (
    select id, name, 'doctor' as role, email from doctors where email = lower(trim(p_email))
    union all select id, name, 'secretary', email from secretaries where email = lower(trim(p_email))) x
  where not exists (select 1 from password_requests r where r.email = x.email and r.status = 'pending')
  limit 1
$$;

create or replace function public.get_password_requests() returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
begin
  perform app.require(app.admin_can('accounts'), 'Not allowed');
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'role', r.role, 'email', r.email,
      'requestedOn', (r.created_at at time zone 'Asia/Manila')::date, 'time', app.time_label(r.created_at), 'message', r.message,
      'otpVerified', r.otp_verified, 'status', r.status) order by r.status, r.created_at desc) from password_requests r), '[]');
end $$;

create or replace function public.send_reset_link(p_id text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare r password_requests;
begin
  perform app.require(app.admin_can('accounts', 'u'), 'Not allowed');
  update password_requests set status = 'sent' where id = p_id returning * into r;
  perform app.require(r.id is not null, 'Request not found');
  perform app.audit('Administrative Action', 'Sent reset link to ' || r.name);
  return jsonb_build_object('email', r.email);
end $$;

create or replace function public.get_audit_logs() returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
begin
  perform app.require(app.admin_can('audit'), 'Not allowed');
  return coalesce((select jsonb_agg(jsonb_build_object('id', l.id::text,
      'time', to_char(l.at at time zone 'Asia/Manila', 'Mon FMDD, YYYY · ') || app.time_label(l.at),
      'user', l.user_name, 'role', l.role, 'action', app.loc(l.action), 'details', l.details, 'hash', left(l.hash, 12) || '…') order by l.id desc)
    from (select * from audit_logs order by id desc limit 500) l), '[]');
end $$;

create or replace function public.get_generated_reports() returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
begin
  perform app.require(app.admin_can('reports'), 'Not allowed');
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'scope', r.scope, 'title', r.title, 'from', r.from_date, 'to', r.to_date, 'generatedOn', r.generated_on)
                     order by r.generated_on desc) from generated_reports r), '[]');
end $$;

create or replace function public.get_rating_comments() returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
begin
  perform app.require(app.admin_can('ratings'), 'Not allowed');
  return coalesce((select jsonb_agg(jsonb_build_object('stars', r.stars, 'text', app.loc(r.comment), 'doctorName', d.name, 'date', (r.created_at at time zone 'Asia/Manila')::date)
                     order by r.created_at desc)
                     from ratings r join doctors d on d.id = r.doctor_id where r.comment is not null), '[]');
end $$;

/** Patient Master List: Super Admin only, cannot be granted (canSeePatientMasterList). */
create or replace function public.get_master_patients() returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
begin
  perform app.require(app.is_super(), 'The Patient Master List is for the Super Admin only');
  perform app.audit('Master List Viewed', 'Patient Master List opened');
  return coalesce((select jsonb_agg(app.patient_json(p) order by p.created_at desc) from patients p where p.created_via <> 'family' or p.birthday is not null), '[]');
end $$;

create or replace function public.get_clinics() returns jsonb
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'specializationId', s.id,
      'doctorIds', coalesce((select jsonb_agg(d.id order by d.id) from doctors d where d.specialization_id = s.id), '[]'),
      'services', to_jsonb(s.clinic_services), 'visible', s.visible) order by s.sort, s.id), '[]')
    from specializations s
$$;

create or replace function public.save_clinic(c jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_id text := c->>'specializationId';
begin
  perform app.require(app.admin_can('clinics', case when exists (select 1 from specializations where id = v_id) then 'u' else 'c' end), 'Not allowed');
  insert into specializations (id, name_tl, name_en, icon, clinic_services, visible, sort)
  values (v_id, coalesce(c->'name'->>'tl', v_id), coalesce(c->'name'->>'en', v_id), coalesce(c->>'icon', 'stethoscope'),
          coalesce((select array_agg(x) from jsonb_array_elements_text(c->'services') x), '{}'), coalesce((c->>'visible')::boolean, true),
          (select coalesce(max(sort), 0) + 1 from specializations))
  on conflict (id) do update set clinic_services = excluded.clinic_services, visible = excluded.visible;
  update doctors set specialization_id = v_id where id in (select jsonb_array_elements_text(coalesce(c->'doctorIds', '[]')));
  perform app.audit('Clinics & Services', 'Saved clinic ' || v_id);
  return (select x from jsonb_array_elements(public.get_clinics()) x where x->>'specializationId' = v_id);
end $$;

create or replace function public.publish_announcement(a jsonb, p_draft boolean default false) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare r announcements;
begin
  perform app.require(app.admin_can('announce', 'c'), 'Not allowed');
  insert into announcements (icon, colors, title, subtitle, summary, body, from_date, to_date, audience, is_draft, created_by)
  values (coalesce(a->>'icon', 'megaphone'), coalesce((select array_agg(x) from jsonb_array_elements_text(a->'colors') x), '{#1d4ed8,#0ea5e9}'),
          a->>'title', coalesce(a->>'subtitle', ''), coalesce(a->>'summary', ''), coalesce(a->>'body', ''),
          (a->>'from')::date, (a->>'to')::date, coalesce(a->'audience', '"all"'), p_draft, (select name from app.actor()))
  returning * into r;
  perform app.audit('Announcement', case when p_draft then 'Saved draft: ' else 'Published: ' end || r.title);
  return (select x from jsonb_array_elements(public.get_announcements()) x where x->>'id' = r.id);
end $$;

/* ------------------------------------------------------------------ */
/* Service-role helpers for the Cloud Functions                         */
/* ------------------------------------------------------------------ */

create or replace function public.otp_issue(p_mobile text, p_purpose text) returns text
language sql security definer set search_path = public, extensions, pg_temp as $$ select app.issue_otp(p_mobile, p_purpose) $$;

create or replace function public.otp_check(p_mobile text, p_code text, p_purpose text) returns boolean
language sql security definer set search_path = public, extensions, pg_temp as $$ select app.check_otp(p_mobile, p_code, p_purpose) $$;

/** The patient account to sign in for a verified mobile number (or null for a new patient). */
create or replace function public.patient_for_mobile(p_mobile text) returns jsonb
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select jsonb_build_object('id', p.id, 'uid', p.uid, 'displayName', p.display_name)
    from patients p where p.mobile_digits = regexp_replace(p_mobile, '\D', '', 'g') and p.created_via <> 'family'
   order by (p.uid is not null) desc, p.created_at limit 1
$$;

create or replace function public.link_patient_uid(p_patient text, p_uid text) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  update patients set uid = p_uid where id = p_patient and (uid is null or uid = p_uid);
  insert into family_links (owner_patient_id, member_patient_id, relation) values (p_patient, p_patient, 'self') on conflict do nothing;
end $$;

create or replace function public.kiosk_for_key(p_key text) returns jsonb
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select jsonb_build_object('id', k.id, 'uid', k.uid, 'name', k.name)
    from kiosk_devices k where k.active and k.key_hash = encode(digest(p_key, 'sha256'), 'hex')
$$;

create or replace function public.link_kiosk_uid(p_kiosk text, p_uid text) returns void
language sql security definer set search_path = public, extensions, pg_temp as $$
  update kiosk_devices set uid = p_uid where id = p_kiosk
$$;

/** SMS outbox, drained by the sendSms Cloud Function. */
create or replace function public.sms_claim(p_limit int default 50) returns setof sms_outbox
language sql security definer set search_path = public, extensions, pg_temp as $$
  update sms_outbox set status = 'sent', sent_at = now()
   where id in (select id from sms_outbox where status = 'queued' order by id limit p_limit for update skip locked)
  returning *
$$;
create or replace function public.sms_failed(p_id bigint, p_error text) returns void
language sql security definer set search_path = public, extensions, pg_temp as $$
  update sms_outbox set status = 'failed', error = p_error where id = p_id
$$;

/* ------------------------------------------------------------------ */
/* Grants                                                              */
/* ------------------------------------------------------------------ */

revoke execute on all functions in schema public from public, anon, authenticated;

-- Signed-in users (every function checks the caller's role itself).
grant execute on function
  public.whoami(text), public.get_specializations(), public.get_doctors(), public.get_live_status(), public.get_availability(text, boolean),
  public.get_announcements(), public.get_settings(), public.update_settings(jsonb), public.get_notifications(text), public.mark_notifications_read(text),
  public.register_patient(jsonb), public.get_me(), public.get_family(), public.add_family_member(jsonb), public.get_my_bookings(),
  public.get_my_records(), public.get_my_consultations(), public.create_booking(text, text, date, text), public.cancel_booking(text),
  public.confirm_booking(text), public.rate_consultation(text, int, text), public.get_record_qr(text),
  public.get_queue(text), public.get_doctor_patients(text), public.get_patient_history(text), public.get_today_vitals(), public.get_drafts(text),
  public.get_follow_ups(text), public.sign_consultation(jsonb), public.add_addendum(text, text), public.book_follow_up(text, text, date, text, text),
  public.delegate_to_secretary(text, text, text), public.get_schedule(text), public.save_schedule(jsonb), public.block_date(text, date, text, text),
  public.remove_blocked_date(text, date),
  public.queue_action(text, text, int), public.save_vitals(text, jsonb), public.get_delegated(text), public.submit_findings_draft(jsonb),
  public.send_patient_notice(jsonb),
  public.kiosk_scan(text), public.kiosk_join(text, text), public.kiosk_register(jsonb), public.kiosk_identify_qr(text), public.kiosk_verify_otp(text, text),
  public.submit_survey(jsonb),
  public.get_admins(), public.get_secretaries(), public.get_rooms(), public.add_room(jsonb), public.assign_room(text, text),
  public.admin_create_account(jsonb), public.admin_update_account(text, jsonb), public.set_account_status(text, text, text),
  public.admin_reset_password(text), public.get_password_requests(), public.send_reset_link(text), public.get_audit_logs(),
  public.get_generated_reports(), public.get_rating_comments(), public.get_master_patients(), public.get_clinics(), public.save_clinic(jsonb),
  public.publish_announcement(jsonb, boolean)
to authenticated;

-- Browsing before sign-in (Patient App guest mode) and the staff "Forgot password" form.
grant execute on function public.get_specializations(), public.get_doctors(), public.get_live_status(), public.get_availability(text, boolean),
  public.get_announcements(), public.get_settings(), public.get_rooms(), public.get_clinics(), public.request_password_reset(text, text)
to anon;

-- Cloud Functions only (they use the service role key, which is never shipped in an app).
grant execute on function public.otp_issue(text, text), public.otp_check(text, text, text), public.patient_for_mobile(text),
  public.link_patient_uid(text, text), public.link_staff_uid(text, text), public.staff_login_info(text), public.kiosk_for_key(text),
  public.link_kiosk_uid(text, text), public.sms_claim(int), public.sms_failed(bigint, text), public.staff_missing_logins()
to service_role;

-- ===== supabase/seed.sql =====
-- Generated by scripts/gen-seed.ts from @dyh/core sample data. Do not edit by hand.
-- Demo data only: replace with real records before going live.

-- Your Firebase project id (Project settings → General). Tokens from any other project are rejected.
insert into app.config (key, value) values ('firebase_project_id', 'YOUR-FIREBASE-PROJECT-ID') on conflict (key) do nothing;

insert into public.system_settings (id, data) values
  (true, '{"scanWindowMinutes":60,"kioskSlipSeconds":20,"autoLogoutMinutes":{"patient":5,"doctor":10,"secretary":10,"admin":15},"bookingWindowDays":7,"cancellationCutoffHours":2,"reminderDaysBefore":1}'::jsonb)
on conflict (id) do nothing;

insert into public.specializations (id, name_tl, name_en, icon, services, clinic_services, sort) values
  ('im', 'Panloob na Medisina', 'Internal Medicine', 'stethoscope', array['Annual physical exam', 'Pre-employment medical'], array['Konsultasyon', 'Balik-konsulta', 'Medical certificate', 'Annual physical exam', 'Pre-employment medical'], 0),
  ('ped', 'Pediatriya (Pambata)', 'Pediatrics', 'baby', array['Immunization (Bakuna)', 'Newborn check-up'], array['Konsultasyon', 'Balik-konsulta', 'Medical certificate', 'Immunization (Bakuna)', 'Newborn check-up'], 1),
  ('ob', 'OB-Gyne (Kalusugang Pambabae)', 'OB-Gynecology', 'heart', array['Prenatal check-up', 'Pap smear'], array['Konsultasyon', 'Balik-konsulta', 'Medical certificate', 'Prenatal check-up', 'Pap smear'], 2),
  ('car', 'Kardyolohiya (Puso)', 'Cardiology', 'heart-pulse', array['ECG reading', 'Cardiac clearance'], array['Konsultasyon', 'Balik-konsulta', 'Medical certificate', 'ECG reading', 'Cardiac clearance'], 3),
  ('ent', 'Tainga, Ilong at Lalamunan', 'ENT (Ear, Nose & Throat)', 'ear', array['Ear cleaning', 'Hearing screening'], array['Konsultasyon', 'Balik-konsulta', 'Medical certificate', 'Ear cleaning', 'Hearing screening'], 4),
  ('ort', 'Ortopediya (Buto)', 'Orthopedics', 'bone', array['Cast application', 'Joint injection'], array['Konsultasyon', 'Balik-konsulta', 'Medical certificate', 'Cast application', 'Joint injection'], 5),
  ('der', 'Dermatolohiya (Balat)', 'Dermatology', 'hand', array['Skin biopsy', 'Wart removal'], array['Konsultasyon', 'Balik-konsulta', 'Medical certificate', 'Skin biopsy', 'Wart removal'], 6),
  ('oph', 'Optalmolohiya (Mata)', 'Ophthalmology', 'eye', array['Visual acuity test', 'Eye refraction'], array['Konsultasyon', 'Balik-konsulta', 'Medical certificate', 'Visual acuity test', 'Eye refraction'], 7),
  ('neu', 'Neurolohiya (Utak at Nerbiyos)', 'Neurology', 'brain', array['EEG reading', 'Neuro clearance'], array['Konsultasyon', 'Balik-konsulta', 'Medical certificate', 'EEG reading', 'Neuro clearance'], 8),
  ('pul', 'Pulmonolohiya (Baga)', 'Pulmonology', 'wind', array['Spirometry', 'Nebulization'], array['Konsultasyon', 'Balik-konsulta', 'Medical certificate', 'Spirometry', 'Nebulization'], 9),
  ('gas', 'Gastroenterolohiya (Sikmura at Bituka)', 'Gastroenterology', 'pill', array['Endoscopy referral', 'Liver profile review'], array['Konsultasyon', 'Balik-konsulta', 'Medical certificate', 'Endoscopy referral', 'Liver profile review'], 10),
  ('neph', 'Nephrolohiya (Bato)', 'Nephrology', 'droplets', array['Dialysis consult', 'Renal diet counseling'], array['Konsultasyon', 'Balik-konsulta', 'Medical certificate', 'Dialysis consult', 'Renal diet counseling'], 11),
  ('endo', 'Endokrinolohiya (Diabetes at Thyroid)', 'Endocrinology', 'syringe', array['Diabetes counseling', 'Thyroid review'], array['Konsultasyon', 'Balik-konsulta', 'Medical certificate', 'Diabetes counseling', 'Thyroid review'], 12),
  ('uro', 'Urolohiya (Daanan ng Ihi)', 'Urology', 'droplet', array['Prostate check', 'Uroflowmetry'], array['Konsultasyon', 'Balik-konsulta', 'Medical certificate', 'Prostate check', 'Uroflowmetry'], 13),
  ('psy', 'Saykayatriya (Kalusugang Pangkaisipan)', 'Psychiatry', 'brain-circuit', array['Psychiatric evaluation', 'Counseling'], array['Konsultasyon', 'Balik-konsulta', 'Medical certificate', 'Psychiatric evaluation', 'Counseling'], 14),
  ('sur', 'Pangkalahatang Operasyon', 'General Surgery', 'scissors', array['Minor surgery', 'Wound care'], array['Konsultasyon', 'Balik-konsulta', 'Medical certificate', 'Minor surgery', 'Wound care'], 15),
  ('reh', 'Rehabilitasyon', 'Rehabilitation Medicine', 'accessibility', array['Physical therapy plan', 'Mobility assessment'], array['Konsultasyon', 'Balik-konsulta', 'Medical certificate', 'Physical therapy plan', 'Mobility assessment'], 16),
  ('den', 'Dentistri (Ngipin)', 'Dentistry', 'smile', array['Tooth extraction', 'Oral prophylaxis'], array['Konsultasyon', 'Balik-konsulta', 'Medical certificate', 'Tooth extraction', 'Oral prophylaxis'], 17)
on conflict do nothing;

insert into public.rooms (number, floor, capacity) values
  ('108', 1, 1),
  ('109', 1, 1),
  ('115', 1, 2),
  ('118', 1, 3),
  ('119', 1, 1),
  ('120', 1, 1),
  ('121', 1, 1),
  ('122', 1, 1),
  ('123', 1, 1),
  ('124', 1, 1),
  ('125', 1, 2),
  ('126', 1, 1),
  ('204', 2, 1),
  ('205', 2, 1),
  ('206', 2, 1),
  ('207', 2, 1),
  ('208', 2, 1),
  ('209', 2, 1),
  ('210', 2, 1),
  ('301', 3, 1),
  ('302', 3, 1),
  ('303', 3, 1),
  ('304', 3, 1),
  ('305', 3, 1),
  ('306', 3, 1),
  ('307', 3, 1)
on conflict do nothing;

insert into public.doctors (id, name, specialization_id, room, floor, clinic_days, hours_start, hours_end, queue_prefix, credentials, email, mobile, max_patients_per_day, status) values
  ('d1', 'Dr. Maria Santos', 'im', '204', 2, array[1, 3, 5], 8, 12, 'IM', array['MD', 'FPCP'], 'm.santos@dyh.ph', '0956 483 4984', 30, 'active'),
  ('d2', 'Dr. Jose Reyes', 'ped', '108', 1, array[2, 4, 5], 13, 17, 'PD', array['MD', 'FPPS'], 'j.reyes@dyh.ph', '0987 544 5945', 30, 'active'),
  ('d3', 'Dr. Ana Villanueva', 'ob', '210', 2, array[1, 5], 9, 15, 'OB', array['MD', 'FPOGS'], 'a.villanueva@dyh.ph', '0928 605 6906', 30, 'active'),
  ('d4', 'Dr. Ramon Dela Paz', 'car', '301', 3, array[3, 5, 6], 10, 14, 'CA', array['MD', 'FPCC'], 'r.delapaz@dyh.ph', '0959 666 7867', 30, 'active'),
  ('d5', 'Dr. Liza Mendoza', 'ent', '115', 1, array[2, 4], 8, 12, 'EN', array['MD'], 'l.mendoza@dyh.ph', '0990 727 8828', 30, 'active'),
  ('d6', 'Dr. Paolo Garcia', 'ort', '120', 1, array[1, 3, 5], 13, 18, 'OR', array['MD'], 'p.garcia@dyh.ph', '0931 788 9789', 30, 'active'),
  ('d7', 'Dr. Teresa Ong', 'im', '206', 2, array[2, 4, 6], 9, 13, 'IO', array['MD'], 't.ong@dyh.ph', '0962 849 1750', 30, 'active'),
  ('d8', 'Dr. Victor Lim', 'im', '205', 2, array[1, 5], 7, 10, 'IL', array['MD'], 'v.lim@dyh.ph', '0993 807 1708', 30, 'active'),
  ('d9', 'Dr. Carmela Diaz', 'ped', '109', 1, array[1, 3, 5], 8, 11, 'PC', array['MD'], 'c.diaz@dyh.ph', '0934 868 2669', 30, 'active'),
  ('d10', 'Dr. Noel Bautista', 'car', '302', 3, array[1, 2, 4], 13, 17, 'CB', array['MD'], 'n.bautista@dyh.ph', '0991 947 3648', 30, 'active'),
  ('d11', 'Dr. Grace Uy', 'der', '115', 1, array[2, 5], 9, 12, 'DE', array['MD'], 'g.uy@dyh.ph', '0932 108 4609', 30, 'active'),
  ('d12', 'Dr. Albert Cruz', 'oph', '119', 1, array[1, 4], 8, 12, 'OP', array['MD', 'DPBO'], 'a.cruz@dyh.ph', '0963 169 5570', 30, 'active'),
  ('d13', 'Dr. Hazel Santiago', 'neu', '303', 3, array[3, 5], 14, 18, 'NE', array['MD'], 'h.santiago@dyh.ph', '0994 230 6531', 30, 'active'),
  ('d14', 'Dr. Ricardo Tan', 'pul', '304', 3, array[2, 4], 9, 13, 'PU', array['MD'], 'r.tan@dyh.ph', '0935 291 7492', 30, 'active'),
  ('d15', 'Dr. Joy Flores', 'gas', '207', 2, array[1, 5], 13, 17, 'GA', array['MD'], 'j.flores@dyh.ph', '0966 352 8453', 30, 'active'),
  ('d16', 'Dr. Mark Villareal', 'neph', '208', 2, array[3, 6], 9, 12, 'NP', array['MD'], 'm.villareal@dyh.ph', '0997 413 9414', 30, 'active'),
  ('d17', 'Dr. Lorna Pascual', 'endo', '209', 2, array[2, 5], 7, 9, 'EN', array['MD'], 'l.pascual@dyh.ph', '0938 474 1375', 30, 'active'),
  ('d18', 'Dr. Felix Ramos', 'uro', '121', 1, array[3, 6], 10, 14, 'UR', array['MD'], 'f.ramos@dyh.ph', '0969 535 2336', 30, 'active'),
  ('d19', 'Dr. Bea Aquino', 'psy', '119', 1, array[2, 4], 13, 17, 'PS', array['MD', 'RPsy'], 'b.aquino@dyh.ph', '0910 596 3297', 30, 'active'),
  ('d20', 'Dr. Edgar Morales', 'sur', '122', 1, array[1, 3, 5], 9, 15, 'SU', array['MD', 'FPCS'], 'e.morales@dyh.ph', '0962 138 6439', 30, 'active'),
  ('d21', 'Dr. Iris Navarro', 'reh', '123', 1, array[2, 4], 8, 12, 'RH', array['MD', 'PTRP'], 'i.navarro@dyh.ph', '0993 199 7400', 30, 'active'),
  ('d22', 'Dr. Paula Gomez', 'den', '124', 1, array[1, 3, 5, 6], 9, 16, 'DN', array['DMD'], 'p.gomez@dyh.ph', '0934 260 8361', 30, 'active')
on conflict do nothing;

insert into public.secretaries (id, name, email, mobile, status, created_at, created_by) values
  ('s1', 'Carla Ramos', 'c.ramos@dyh.ph', '0917 284 3381', 'active', '2025-03-03', 'Admin Delos Reyes'),
  ('s2', 'Jenny Flores', 'j.flores@dyh.ph', '0918 552 1094', 'active', '2025-07-14', 'Patricia Gonzales'),
  ('s3', 'Mylene Torres', 'm.torres@dyh.ph', '0921 330 7712', 'deactivated', '2024-11-02', 'Admin Delos Reyes'),
  ('s4', 'Rina Uy', 'r.uy@dyh.ph', '0905 118 2240', 'active', '2026-01-20', 'Admin Delos Reyes')
on conflict do nothing;

insert into public.secretary_doctors (secretary_id, doctor_id) values
  ('s1', 'd1'),
  ('s1', 'd2'),
  ('s1', 'd4'),
  ('s2', 'd3'),
  ('s2', 'd6'),
  ('s3', 'd5'),
  ('s4', 'd7'),
  ('s4', 'd8'),
  ('s4', 'd9'),
  ('s4', 'd10')
on conflict do nothing;

insert into public.admins (id, name, email, mobile, role, permissions, doctor_id, credentials, status, created_at, created_by) values
  ('a1', 'Admin Delos Reyes', 'admin@dyh.ph', '0917 100 2001', 'super', '{}'::jsonb, null, '{}', 'active', '2024-01-08', 'System (initial setup)'),
  ('a2', 'Patricia Gonzales', 'p.gonzales@dyh.ph', '0918 220 4410', 'admin', '{"dashboard":{},"analytics":{},"accounts":{"c":true,"u":true},"clinics":{"c":true,"u":true,"d":true},"rooms":{"c":true,"u":true,"d":true},"announce":{"c":true,"u":true,"d":true},"reports":{"c":true},"ratings":{}}'::jsonb, null, '{}', 'active', '2025-04-02', 'Admin Delos Reyes'),
  ('a3', 'Kevin Mercado', 'k.mercado@dyh.ph', '0921 554 7123', 'admin', '{"dashboard":{},"announce":{"c":true,"u":true},"reports":{},"ratings":{}}'::jsonb, null, '{}', 'active', '2026-06-15', 'Admin Delos Reyes'),
  ('a4', 'Dr. Maria Santos', 'm.santos@dyh.ph', '0956 482 7735', 'admin', '{"dashboard":{},"analytics":{},"reports":{"c":true},"ratings":{}}'::jsonb, 'd1', array['MD', 'FPCP'], 'active', '2026-09-01', 'Admin Delos Reyes')
on conflict do nothing;

insert into public.announcements (id, icon, colors, title, subtitle, summary, body, from_date, to_date, audience, is_draft) values
  ('a1', 'syringe', array['#1f56b0', '#17325f'], 'Libreng Flu Vaccine', 'Para sa Senior Citizens · Nob 3–14', 'Pumunta sa OPD Lobby, 8:00 AM – 3:00 PM. Magdala ng Senior Citizen ID.', 'Ang Dr. Yanga''s Hospital ay magbibigay ng libreng flu vaccine para sa lahat ng Senior Citizens bilang bahagi ng ating flu season program.

**Saan:** OPD Lobby, Ground Floor
**Oras:** 8:00 AM – 3:00 PM, Lunes hanggang Sabado
**Dalhin:** Senior Citizen ID at isang valid ID

Limitado ang supply bawat araw (150 doses). Unahan ang serbisyo. Hindi kailangang magpa-book sa app.

Para sa may lagnat o may sakit sa araw ng bakuna, kumonsulta muna sa doktor.', '2026-11-03', '2026-11-14', '"all"'::jsonb, false),
  ('a2', 'calendar-days', array['#0d7a86', '#0f4c5c'], 'Holiday Schedule Advisory', 'Nob 1–2 · Undas', 'Sarado ang OPD clinics sa Nob 1 at 2. Bukas ang Emergency Room 24/7.', 'Dahil sa Undas, **sarado ang lahat ng OPD clinics** sa Nobyembre 1 (Linggo) at Nobyembre 2 (Lunes).

Ang mga online appointment sa mga petsang ito ay awtomatikong ililipat. Makakatanggap kayo ng abiso para pumili ng bagong petsa.

**Bukas pa rin ang Emergency Room 24/7.**

Babalik sa normal na operasyon ang OPD sa Nobyembre 3 (Martes).', '2026-10-28', '2026-11-02', '"all"'::jsonb, false),
  ('a3', 'heart-pulse', array['#6a3db5', '#3b1f73'], 'Bagong Cardiology Clinic Hours', 'Simula Okt 20', 'Bukas na rin ang Cardiology tuwing Sabado, 10:00 AM – 2:00 PM.', 'Bukas na rin ang Cardiology clinic tuwing **Sabado, 10:00 AM – 2:00 PM** sa Kuwarto 301.', '2026-10-20', '2026-11-30', '"all"'::jsonb, false),
  ('a4', 'baby', array['#12805a', '#0b4f38'], 'Pedia Vaccination Week', 'Nob 16–20', 'Libreng bakuna para sa mga batang 0–5 taon.', 'Libreng bakuna para sa mga batang **0–5 taong gulang**. Dalhin ang baby book.', '2026-11-16', '2026-11-20', '{"clinics":["ped","ob"]}'::jsonb, false)
on conflict do nothing;

insert into public.patients (id, last_name, first_name, middle_name, display_name, birthday, approx_age, sex, mobile, city, blood_type, allergies, priority, emergency_contact, created_via) values
  ('DYH-2026-004812', 'Dela Cruz', 'Juan', 'Santos', 'Juan S. Dela Cruz', '1981-03-14', null, 'M', '0917 555 0142', 'Caloocan City', 'O+', '{}', null, '{"name":"Maria Dela Cruz","mobile":"0918 222 0193","relation":"spouse"}'::jsonb, 'import'),
  ('DYH-2024-000233', 'Bautista', 'Lourdes', null, 'Lourdes Bautista', '1958-05-02', null, 'F', '0918 772 1290', 'Quezon City', 'O+', array['Penicillin'], 'senior', null, 'import'),
  ('DYH-2025-003310', 'Navarro', 'Ernesto', null, 'Ernesto Navarro', '1966-11-23', null, 'M', '0921 448 3302', 'Malabon City', 'A+', '{}', 'pwd', null, 'import'),
  ('DYH-2026-002104', 'Tolentino', 'Grace', null, 'Grace Tolentino', '1990-02-09', null, 'F', '0905 117 8821', 'Caloocan City', 'B+', array['Sulfa'], null, null, 'import'),
  ('DYH-2026-004901', 'Salazar', 'Ricardo', null, 'Ricardo Salazar', '1974-01-08', null, 'M', '0919 330 1201', 'Caloocan City', 'AB+', '{}', null, null, 'import'),
  ('DYH-2025-000877', 'Aquino', 'Maricel', null, 'Maricel Aquino', '1985-09-17', null, 'F', '0919 204 5512', 'Caloocan City', 'A-', array['Aspirin'], null, null, 'import'),
  ('DYH-2023-000412', 'Manalo', 'Felipe', null, 'Felipe Manalo', '1950-06-30', null, 'M', '0927 330 1145', 'Valenzuela City', 'O-', '{}', 'senior', null, 'import'),
  ('DYH-2026-005120', 'Dela Cruz', 'Sofia', null, 'Sofia Dela Cruz', '2019-08-11', null, 'F', '0917 555 0142', 'Caloocan City', 'A+', '{}', null, null, 'import'),
  ('DYH-2025-001933', 'Dela Cruz', 'Rosario', null, 'Rosario Dela Cruz', null, 72, null, '0917 555 0142', null, 'unknown', '{}', 'senior', null, 'family')
on conflict do nothing;

insert into public.family_links (owner_patient_id, member_patient_id, relation) values
  ('DYH-2026-004812', 'DYH-2026-004812', 'self'),
  ('DYH-2026-004812', 'DYH-2026-005120', 'child'),
  ('DYH-2026-004812', 'DYH-2025-001933', 'mother')
on conflict do nothing;

insert into public.bookings (id, patient_id, doctor_id, date, type, status, queue_number, is_follow_up) values
  ('BK-261030-018', 'DYH-2026-004812', 'd1', '2026-10-30', 'walkin', 'arrived', 'IM-018', false),
  ('BK-261105-007', 'DYH-2026-005120', 'd2', '2026-11-05', 'online', 'booked', null, false),
  ('BK-261112-004', 'DYH-2026-004812', 'd1', '2026-11-12', 'online', 'booked', null, true),
  ('BK-261119-009', 'DYH-2025-001933', 'd4', '2026-11-19', 'online', 'confirmed', null, false)
on conflict do nothing;

-- Demo medical records. Consultations are append-only; the hash chain starts here.
do $$
declare v_prev text; v_body jsonb;
begin
  v_body := '{"id":"r-4812-1","patientId":"DYH-2026-004812","date":"2026-06-18","doctorId":"d1","doctorName":"Dr. Maria Santos","type":"online","diagnoses":[{"tl":"Taunang Pagsusuri — Normal","en":"Annual Physical Examination — Normal"}],"findings":{"tl":"Normal ang pisikal na pagsusuri. BP 132/86 mmHg.","en":"Normal physical examination. BP 132/86 mmHg."},"prescriptions":[],"labs":["Urinalysis","Chest X-ray PA"],"vitals":{"bp":"132/86","hr":78,"temp":"36.5","rr":16,"o2":99,"wt":77,"ht":170},"notes":{"tl":"Taunang check-up. Bantayan ang BP sa bahay.","en":"Annual check-up. Monitor BP at home."},"signed":true}'::jsonb;
  insert into public.consultations (id, patient_id, doctor_id, date, type, title, diagnoses, findings, prescriptions, labs, notes, vitals, verified_with, source, signed_at, prev_hash, integrity_hash)
  values ('r-4812-1', 'DYH-2026-004812', 'd1', '2026-06-18', 'online', null, '[{"tl":"Taunang Pagsusuri — Normal","en":"Annual Physical Examination — Normal"}]'::jsonb, '{"tl":"Normal ang pisikal na pagsusuri. BP 132/86 mmHg.","en":"Normal physical examination. BP 132/86 mmHg."}'::jsonb, '[]'::jsonb,
          array['Urinalysis', 'Chest X-ray PA'], '{"tl":"Taunang check-up. Bantayan ang BP sa bahay.","en":"Annual check-up. Monitor BP at home."}'::jsonb, '{"bp":"132/86","hr":78,"temp":"36.5","rr":16,"o2":99,"wt":77,"ht":170}'::jsonb, 'pin', 'typed', '2026-06-18'::date + time '11:00', v_prev,
          encode(extensions.digest(coalesce(v_prev, '') || v_body::text, 'sha256'), 'hex'))
  on conflict do nothing
  returning integrity_hash into v_prev;
  v_body := '{"id":"r-4812-2","patientId":"DYH-2026-004812","date":"2026-09-02","doctorId":"d5","doctorName":"Dr. Liza Mendoza","type":"walkin","diagnoses":[{"tl":"Acute Pharyngitis (Pamamaga ng Lalamunan)","en":"Acute Pharyngitis"}],"findings":{"tl":"Namumulang lalamunan, walang nana. Temperatura 37.8°C.","en":"Erythematous pharynx, no exudates. Temperature 37.8°C."},"prescriptions":[{"medicine":"Paracetamol 500 mg","intake":{"tl":"1 tableta kada 6 oras kung may lagnat","en":"1 tablet every 6 hours if with fever"}},{"medicine":"Lozenges","intake":{"tl":"kung kailangan","en":"as needed"}}],"labs":[],"notes":{"tl":"Uminom ng maraming tubig. Bumalik kung lumala sa loob ng 5 araw.","en":"Increase fluid intake. Return if symptoms worsen within 5 days."},"signed":true}'::jsonb;
  insert into public.consultations (id, patient_id, doctor_id, date, type, title, diagnoses, findings, prescriptions, labs, notes, vitals, verified_with, source, signed_at, prev_hash, integrity_hash)
  values ('r-4812-2', 'DYH-2026-004812', 'd5', '2026-09-02', 'walkin', null, '[{"tl":"Acute Pharyngitis (Pamamaga ng Lalamunan)","en":"Acute Pharyngitis"}]'::jsonb, '{"tl":"Namumulang lalamunan, walang nana. Temperatura 37.8°C.","en":"Erythematous pharynx, no exudates. Temperature 37.8°C."}'::jsonb, '[{"medicine":"Paracetamol 500 mg","intake":{"tl":"1 tableta kada 6 oras kung may lagnat","en":"1 tablet every 6 hours if with fever"}},{"medicine":"Lozenges","intake":{"tl":"kung kailangan","en":"as needed"}}]'::jsonb,
          '{}', '{"tl":"Uminom ng maraming tubig. Bumalik kung lumala sa loob ng 5 araw.","en":"Increase fluid intake. Return if symptoms worsen within 5 days."}'::jsonb, null, 'pin', 'typed', '2026-09-02'::date + time '11:00', v_prev,
          encode(extensions.digest(coalesce(v_prev, '') || v_body::text, 'sha256'), 'hex'))
  on conflict do nothing
  returning integrity_hash into v_prev;
  v_body := '{"id":"r-4812-3","patientId":"DYH-2026-004812","date":"2026-10-12","doctorId":"d1","doctorName":"Dr. Maria Santos","type":"online","diagnoses":[{"tl":"Altapresyon (Essential Hypertension), Stage 1","en":"Essential Hypertension, Stage 1"}],"findings":{"tl":"BP 146/92 mmHg, HR 84. Walang pananakit ng dibdib. Paminsan-minsang sakit ng ulo sa umaga.","en":"BP 146/92 mmHg, HR 84. No chest pain. Occasional morning headaches."},"prescriptions":[{"medicine":"Amlodipine 5 mg","intake":{"tl":"1 tableta tuwing umaga (30 araw)","en":"1 tablet every morning (30 days)"}}],"labs":["Complete Blood Count","Lipid Profile","Fasting Blood Sugar"],"vitals":{"bp":"146/92","hr":84,"temp":"36.7","rr":16,"o2":98,"wt":78,"ht":170},"notes":{"tl":"Bawasan ang alat sa pagkain. Bumalik pagkatapos ng 1 buwan dala ang resulta ng laboratoryo.","en":"Reduce salt intake. Return after 1 month with laboratory results."},"signed":true}'::jsonb;
  insert into public.consultations (id, patient_id, doctor_id, date, type, title, diagnoses, findings, prescriptions, labs, notes, vitals, verified_with, source, signed_at, prev_hash, integrity_hash)
  values ('r-4812-3', 'DYH-2026-004812', 'd1', '2026-10-12', 'online', null, '[{"tl":"Altapresyon (Essential Hypertension), Stage 1","en":"Essential Hypertension, Stage 1"}]'::jsonb, '{"tl":"BP 146/92 mmHg, HR 84. Walang pananakit ng dibdib. Paminsan-minsang sakit ng ulo sa umaga.","en":"BP 146/92 mmHg, HR 84. No chest pain. Occasional morning headaches."}'::jsonb, '[{"medicine":"Amlodipine 5 mg","intake":{"tl":"1 tableta tuwing umaga (30 araw)","en":"1 tablet every morning (30 days)"}}]'::jsonb,
          array['Complete Blood Count', 'Lipid Profile', 'Fasting Blood Sugar'], '{"tl":"Bawasan ang alat sa pagkain. Bumalik pagkatapos ng 1 buwan dala ang resulta ng laboratoryo.","en":"Reduce salt intake. Return after 1 month with laboratory results."}'::jsonb, '{"bp":"146/92","hr":84,"temp":"36.7","rr":16,"o2":98,"wt":78,"ht":170}'::jsonb, 'pin', 'typed', '2026-10-12'::date + time '11:00', v_prev,
          encode(extensions.digest(coalesce(v_prev, '') || v_body::text, 'sha256'), 'hex'))
  on conflict do nothing
  returning integrity_hash into v_prev;
  insert into public.addenda (consultation_id, author_doctor_id, text, created_at) values ('r-4812-3', 'd1', 'Lipid Profile reviewed: LDL 148 mg/dL. Lifestyle modification counseling added.', '2026-10-14');
end $$;

insert into public.generated_reports (id, scope, title, from_date, to_date, generated_on) values
  ('r1', 'Dr. Maria Santos', '{"tl":"Trend ng diyagnosis at bilang ng pasyente kada buwan","en":"Monthly diagnosis trend and patient count"}'::jsonb, '2026-05-01', '2026-10-31', '2026-10-30'),
  ('r2', 'Dr. Jose Reyes', '{"tl":"Bilang ng nabakunahan at follow-up ng mga bata (Q3)","en":"Vaccination count and child follow-ups (Q3)"}'::jsonb, '2026-07-01', '2026-09-30', '2026-10-27'),
  ('r3', 'Dr. Ramon Dela Paz', '{"tl":"Buod ng diyagnosis sa Q3.","en":"Q3 diagnosis summary."}'::jsonb, '2026-07-01', '2026-09-30', '2026-10-21')
on conflict do nothing;

insert into public.password_requests (id, name, role, email, message, otp_verified, status, created_at) values
  ('w1', 'Dr. Victor Lim', 'doctor', 'v.lim@dyh.ph', 'Nakalimutan ko ang password.', true, 'pending', ('2026-10-30'::date + '9:42 AM'::time) at time zone 'Asia/Manila'),
  ('w2', 'Rina Uy', 'secretary', 'r.uy@dyh.ph', '', true, 'pending', ('2026-10-30'::date + '8:15 AM'::time) at time zone 'Asia/Manila'),
  ('w3', 'Dr. Grace Uy', 'doctor', 'g.uy@dyh.ph', 'Na-lock ang account ko.', true, 'pending', ('2026-10-29'::date + '4:50 PM'::time) at time zone 'Asia/Manila')
on conflict do nothing;

-- Demo kiosk. Device key: demo-kiosk-key  (create real ones with a long random key; see docs/BACKEND.md)
insert into public.kiosk_devices (id, name, key_hash) values ('kiosk-1', 'OPD Lobby Kiosk', encode(extensions.digest('demo-kiosk-key', 'sha256'), 'hex')) on conflict do nothing;

-- Start new patient ids after the demo ones.
select setval('public.patient_seq', 5300);



update app.config set value = 'dyh-opd' where key = 'firebase_project_id';
