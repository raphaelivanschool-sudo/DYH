-- Smoke test: plays each role (kiosk, secretary, doctor, patient, admin) against the seeded database.
-- Every "ok ..." notice is an access rule doing its job. Run with supabase/tests/run-local.sh.
\set ON_ERROR_STOP 1
\pset format unaligned
\pset tuples_only on
update app.config set value = 'dyh-test' where key = 'firebase_project_id';
set app.demo_now = '2026-10-30 10:30';
update doctors set uid = 'uid-d1' where id = 'd1';
update doctors set uid = 'uid-d2' where id = 'd2';
update secretaries set uid = 'uid-s1' where id = 's1';
update secretaries set uid = 'uid-s2' where id = 's2';
update admins set uid = 'uid-a1' where id = 'a1';
update admins set uid = 'uid-a3' where id = 'a3';
update kiosk_devices set uid = 'uid-k' where id = 'kiosk-1';
update patients set uid = 'uid-me' where id = 'DYH-2026-004812';
create function public.t_as(p_uid text, p_extra jsonb default '{}') returns text language sql as $$
  select set_config('request.jwt.claims', (jsonb_build_object('iss', 'https://securetoken.google.com/dyh-test', 'aud', 'dyh-test', 'sub', p_uid, 'role', 'authenticated') || p_extra)::text, false)
$$;
grant execute on function public.t_as(text, jsonb) to authenticated, anon;

\echo == anon catalog
set role anon;
select jsonb_array_length(get_doctors()), jsonb_array_length(get_specializations()), get_doctors()->0->>'email' = '' as email_hidden;
select (select count(*) from jsonb_array_elements(get_live_status()) x where (x->>'openToday')::boolean) as open_today;
reset role;

\echo == kiosk
select t_as('uid-k'); set role authenticated;
select whoami('kiosk');
select kiosk_join('d1', 'DYH-2026-004812')->'entry'->>'number' as me_number;
select kiosk_register('{"last":"Reyes","first":"Lola","birthday":"1950-01-02","sex":"F","mobile":"0917 000 1111","priority":"senior"}')->>'id' as new_id \gset
select kiosk_join('d1', :'new_id') as senior_join;
select kiosk_join('d1', 'DYH-2025-003310')->>'position' as pwd_pos;
select kiosk_join('d1', 'DYH-2026-002104')->>'position' as reg_pos;
select kiosk_scan('BK-261030-018')->>'status' as rescan;
select kiosk_scan('BK-261105-007') as wrong_day;
select kiosk_scan('nope')->>'status';
select get_queue('d1')->'waiting' as masked_waiting;
reset role;

\echo == too early: d2 (peds) hours
select id, hours_start, clinic_days from doctors where id in ('d2','d3','d4');
set app.demo_now = '2026-10-30 06:00';
select t_as('uid-k'); set role authenticated;
select kiosk_join('d2', 'DYH-2026-005120') as early;
reset role;
set app.demo_now = '2026-10-30 10:30';

\echo == secretary s1
select t_as('uid-s1'); set role authenticated;
select whoami('secretary');
select queue_action('d1', 'start')->'serving'->>'number' as serving;
select save_vitals((get_queue('d1')->'serving'->>'number'), '{"bp":"150/95","hr":88,"wt":60,"ht":155}');
select get_today_vitals();
select queue_action('d1', 'skip')->'skipped'->0->>'number' as skipped;
select queue_action('d1', 'callBack', 0)->'waiting'->0->>'number' as called_back_front;
select queue_action('d1', 'start')->'serving'->>'patientName';
select queue_action('d1', 'done')->>'doneCount' as done;
select get_delegated('d1');
reset role;

\echo == secretary s2 not assigned to d1 (expect error)
select t_as('uid-s2'); set role authenticated;
do $$ begin perform queue_action('d1', 'start'); raise exception 'SHOULD HAVE FAILED'; exception when insufficient_privilege then raise notice 'ok denied: %', sqlerrm; end $$;
reset role;

\echo == doctor d1
select t_as('uid-d1'); set role authenticated;
select whoami('doctor');
select jsonb_array_length(get_doctor_patients('d1')) as my_patients;
select sign_consultation(jsonb_build_object('patientId', :'new_id', 'doctorId', 'd1', 'title', 'Check-up', 'findings', 'BP high', 'diagnoses', jsonb_build_array('Hypertension'),
  'prescriptions', '[{"medicine":"Amlodipine 5 mg","intake":"1 tab daily"}]'::jsonb, 'labs', '["CBC"]'::jsonb, 'notes', 'Low salt', 'verifiedWith', 'pin', 'source', 'typed')) ->> 'id' as rec_id \gset
select jsonb_array_length(get_patient_history(:'new_id')) as history, get_patient_history(:'new_id')->0->'vitals' as vitals_snapshot;
select add_addendum(:'rec_id', 'Lab result ok');
select get_patient_history(:'new_id')->0->'addendum';
select book_follow_up(:'new_id', 'd1', '2026-11-04', 'BP recheck')->>'id' as fu;
select get_follow_ups('d1');
select delegate_to_secretary(:'new_id', 'd1', 'Please write up');
select block_date('d1', '2026-11-12', 'Seminar');
select get_schedule('d1')->'blocked';
select save_schedule(jsonb_build_object('doctorId','d1','week', get_schedule('d1')->'week','maxPatientsPerDay', 25, 'closeOnlineToday', false))->>'maxPatientsPerDay';
do $$ begin update consultations set notes = '{}' ; raise exception 'SHOULD HAVE FAILED'; exception when insufficient_privilege then raise notice 'ok denied: %', sqlerrm; end $$;
reset role;
do $$ begin update consultations set notes = '{}' ; raise exception 'SHOULD HAVE FAILED'; exception when insufficient_privilege then raise notice 'ok immutable even for owner: %', sqlerrm; end $$;

\echo == doctor d2 cannot read d1 patient
select t_as('uid-d2'); set role authenticated;
do $$ begin perform get_patient_history('DYH-2024-000233'); raise exception 'SHOULD HAVE FAILED'; exception when insufficient_privilege then raise notice 'ok denied: %', sqlerrm; end $$;
reset role;

\echo == secretary drafts + notice
select t_as('uid-s1'); set role authenticated;
select submit_findings_draft(jsonb_build_object('doctorId','d1','patientId', :'new_id','queueNumber','IM-001','patientName','Lola Reyes','mode','text','title','t','findings','f','diagnoses','[]'::jsonb,'prescriptions','[]'::jsonb,'labs','[]'::jsonb,'notes','n','followUp', '{"date":"2026-11-04","purpose":"recheck"}'::jsonb));
select send_patient_notice('{"doctorId":"d1","date":"2026-11-12","template":"blocked","message":"Clinic closed Nov 12","channels":["app","sms"]}');
select send_patient_notice('{"doctorId":"d1","template":"delay","message":"Running 20 min late","channels":["app"]}');
reset role; select count(*) as sms_queued from sms_outbox;
reset role;
select t_as('uid-d1'); set role authenticated;
select get_drafts('d1');
select get_notifications('doctor');
reset role;

\echo == patient
select t_as('uid-me'); set role authenticated;
select whoami('patient');
select get_me()->>'displayName', get_me()->>'visits';
select get_family();
select add_family_member('{"displayName":"Pedro Dela Cruz","relation":"father","age":75,"priority":"senior"}');
select jsonb_agg(x->>'date') from jsonb_array_elements(get_availability('d1')) x;
select create_booking('DYH-2026-005120', 'd1', '2026-11-02', 'Cough') ->> 'id' as bk \gset
select :'bk';
select get_my_bookings()->0;
select cancel_booking(:'bk');
select jsonb_array_length(get_my_records()) as records;
select rate_consultation('r-4812-3', 5, 'Great');
do $$ begin perform rate_consultation('r-4812-3', 1, 'changed'); raise exception 'SHOULD HAVE FAILED'; exception when insufficient_privilege then raise notice 'ok: %', sqlerrm; end $$;
select get_my_consultations()->0;
select get_notifications('patient');
select get_record_qr('DYH-2026-004812')->>'token' as qr \gset
do $$ begin perform get_patient_history('DYH-2024-000233'); raise exception 'SHOULD HAVE FAILED'; exception when insufficient_privilege then raise notice 'ok denied: %', sqlerrm; end $$;
select count(*) as direct_patient_rows_visible from patients;
reset role;
select t_as('uid-k'); set role authenticated;
select kiosk_identify_qr(:'qr')->'patient'->>'id';
reset role;

\echo == wrong issuer token sees nothing
select set_config('request.jwt.claims', '{"iss":"https://securetoken.google.com/other","aud":"other","sub":"uid-me","role":"authenticated"}', false); set role authenticated;
select get_me() is null as rejected, (select count(*) from patients) as rows;
reset role;

\echo == new patient registration via verified mobile
select t_as('uid-new', '{"mobile":"09171234567"}'); set role authenticated;
select whoami('patient');
select register_patient('{"last":"Lim","first":"Ana","birthday":"2000-05-05","sex":"F"}')->>'mobile';
select whoami('patient')->>'displayName';
reset role;

\echo == OTP (service role)
set role service_role;
select otp_issue('0917 123 4567', 'kiosk') as code \gset
select otp_check('09171234567', '000000', 'kiosk') as wrong, otp_check('09171234567', :'code', 'kiosk') as right_after_wrong;
do $$ begin perform otp_issue('09171234567', 'kiosk'); raise exception 'SHOULD HAVE FAILED'; exception when others then raise notice 'ok cooldown: %', sqlerrm; end $$;
select patient_for_mobile('09175550142');
reset role;

\echo == admin
select t_as('uid-a1'); set role authenticated;
select whoami('admin');
select jsonb_array_length(get_admins()), jsonb_array_length(get_secretaries()) , get_secretaries()->0->'doctorIds';
select admin_create_account('{"kind":"secretary","name":"New Sec","email":"New.Sec@dyh.ph","mobile":"0917","doctorIds":["d1"]}');
select admin_create_account('{"kind":"doctor","name":"Dr. New","email":"dr.new@dyh.ph","specializationId":"im","credentials":["MD"]}');
select set_account_status('s2', 'deactivated', 'Resigned');
select update_settings('{"scanWindowMinutes": 45}')->>'scanWindowMinutes';
select jsonb_array_length(get_master_patients()) as master;
select publish_announcement('{"title":"Test","from":"2026-11-01","to":"2026-11-30","icon":"megaphone","colors":["#000","#fff"]}', false)->>'status';
select get_audit_logs()->0;
select get_rating_comments();
select save_clinic('{"specializationId":"im","doctorIds":["d1"],"services":["Konsultasyon"],"visible":true}');
reset role;
select app.verify_audit_chain() is null as audit_chain_ok;

\echo == deactivated secretary loses access immediately
select t_as('uid-s2'); set role authenticated;
do $$ begin perform whoami('secretary'); raise exception 'SHOULD HAVE FAILED'; exception when insufficient_privilege then raise notice 'ok: %', sqlerrm; end $$;
reset role;

\echo == limited admin a3 cannot see master list or create accounts
select t_as('uid-a3'); set role authenticated;
do $$ begin perform get_master_patients(); raise exception 'SHOULD HAVE FAILED'; exception when insufficient_privilege then raise notice 'ok: %', sqlerrm; end $$;
do $$ begin perform admin_create_account('{"kind":"secretary","name":"x","email":"x@y"}'); raise exception 'SHOULD HAVE FAILED'; exception when insufficient_privilege then raise notice 'ok: %', sqlerrm; end $$;
reset role;
select topic, version from live_topics order by topic;
\echo ALL DONE
