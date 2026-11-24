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
