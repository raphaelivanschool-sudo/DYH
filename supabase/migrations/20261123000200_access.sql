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
