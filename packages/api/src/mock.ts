/**
 * In-memory mock of the DYH backend. Uses the prototype's sample data and keeps
 * mutations for the life of the app session (refresh = reset). Simulates latency
 * so loading states are exercised. Subscribers get change events so the
 * "live" queue updates across screens like a websocket would.
 */
import {
  DELEGATED_DONE,
  ADMINS, AI_GUIDE, ANNOUNCEMENTS, AUDIT_LOGS, DEFAULT_SETTINGS, DEMO_NOW_HOUR, DEMO_TODAY, DOCTOR_HISTORY,
  DOCTOR_NOTIFICATIONS, DOCTOR_PATIENTS, DOCTORS, DRAFTS, FAMILY, GENERATED_REPORTS, MASTER_PATIENTS, ME,
  MY_BOOKINGS, MY_CONSULTATIONS, MY_RECORDS, PASSWORD_REQUESTS, PATIENT_NOTIFICATIONS, QUEUES, RATING_COMMENTS,
  ROOMS, SECRETARIES, SECRETARY_NOTIFICATIONS, SPECIALIZATIONS, TODAY_VITALS, UPCOMING_FOLLOW_UPS,
  availableDates, initials, insertIntoQueue, isTooEarlyToScan, liveStatusFor, makeBookingId, nextQueueNumber,
  routeAiQuestion, scanOpensAtLabel, seededInt, shortHash, weekFromDoctor,
  type BlockedDate, type Booking, type ClinicConfig, type DoctorQueue, type DoctorSchedule, type Patient, type QueueEntry,
} from '@dyh/core';
import type { DelegatedPatient, DyhApi } from './contract';

const clone = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

export interface MockOptions {
  /** Artificial latency in ms (default 250). */
  latency?: number;
  /** Force errors to test error states. */
  failRate?: number;
}

export type ChangeListener = (topic: string) => void;

export function createMockApi(opts: MockOptions = {}): DyhApi & { subscribe(fn: ChangeListener): () => void } {
  const latency = opts.latency ?? 250;
  const listeners = new Set<ChangeListener>();
  const emit = (topic: string) => listeners.forEach((l) => l(topic));

  const db = {
    doctors: clone(DOCTORS),
    queues: clone(QUEUES) as Record<string, DoctorQueue>,
    vitals: clone(TODAY_VITALS),
    bookings: clone(MY_BOOKINGS) as Booking[],
    family: clone(FAMILY),
    settings: clone(DEFAULT_SETTINGS),
    announcements: clone(ANNOUNCEMENTS),
    rooms: clone(ROOMS),
    admins: clone(ADMINS),
    secretaries: clone(SECRETARIES),
    pwRequests: clone(PASSWORD_REQUESTS),
    audit: clone(AUDIT_LOGS),
    ratings: { c1: 5 } as Record<string, number>,
    delegated: clone(DELEGATED_DONE) as Record<string, DelegatedPatient[]>,
    drafts: clone(DRAFTS).map((d) => ({ ...d, signed: false, followUpDone: false })),
    schedules: {} as Record<string, DoctorSchedule>,
    records: clone(DOCTOR_HISTORY),
    patients: clone(DOCTOR_PATIENTS) as Patient[],
    seq: 40,
    /** Walk-in QR → doctor and patient, for numbers issued later. */
    walkIns: { 'WK-261030-050': { doctorId: 'd15', id: ME.id, name: ME.displayName, priority: null } } as Record<string, { doctorId: string; id: string; name: string; priority: QueueEntry['priority'] }>,
    specs: clone(SPECIALIZATIONS),
    clinics: SPECIALIZATIONS.map((sp) => ({
      specializationId: sp.id,
      doctorIds: DOCTORS.filter((d) => d.specializationId === sp.id).map((d) => d.id),
      services: ['Konsultasyon', 'Balik-konsulta', 'Medical certificate', ...sp.services],
      visible: true,
    })) as ClinicConfig[],
  };
  db.schedules.d1 = {
    doctorId: 'd1',
    week: weekFromDoctor(db.doctors[0]),
    maxPatientsPerDay: 30,
    closeOnlineToday: false,
    blocked: [{ doctorId: 'd1', date: '2026-11-09', reason: 'Seminar — PCP Convention', affected: 4, status: 'sent', notifiedBy: 'Sek. Carla Ramos', notifiedAt: 'Okt 28 · 3:10 PM' }],
  };

  const wait = <T>(v: T): Promise<T> =>
    new Promise((res, rej) =>
      setTimeout(() => (opts.failRate && Math.random() < opts.failRate ? rej(new Error('Mock network error')) : res(clone(v))), latency),
    );
  const clock = () => ({ today: DEMO_TODAY, hour: DEMO_NOW_HOUR });
  const doctor = (id: string) => {
    const d = db.doctors.find((x) => x.id === id);
    if (!d) throw new Error(`Unknown doctor ${id}`);
    return d;
  };
  const schedule = (doctorId: string): DoctorSchedule =>
    (db.schedules[doctorId] ??= { doctorId, week: weekFromDoctor(doctor(doctorId)), maxPatientsPerDay: 30, closeOnlineToday: false, blocked: [] });
  /** Queues without seed data are filled in to match the live board, so numbers line up. */
  const SAMPLE_NAMES = ['Lorna Garcia', 'Ramon Torres', 'Nilda Castro', 'Arnel Flores', 'Divina Ramos', 'Jun Mendoza', 'Celia Navarro', 'Ben Aquino', 'Tess Villanueva', 'Rey Santos'];
  const queue = (doctorId: string): DoctorQueue => {
    if (db.queues[doctorId]) return db.queues[doctorId];
    const d = doctor(doctorId);
    const { today, hour } = clock();
    const live = liveStatusFor(d, today, hour);
    const servingNo = live.nowServing ? Number(live.nowServing.split('-')[1]) : 0;
    const num = (n: number) => `${d.queuePrefix}-${String(n).padStart(3, '0')}`;
    const entry = (n: number, i: number): QueueEntry => ({ number: num(n), patientId: `DYH-2026-00${4100 + n}`, patientName: SAMPLE_NAMES[i % SAMPLE_NAMES.length], type: 'walkin', priority: null });
    return (db.queues[doctorId] = {
      doctorId,
      serving: live.nowServing ? entry(servingNo, 9) : null,
      waiting: Array.from({ length: live.waiting }, (_, i) => entry(servingNo + 1 + i, i)),
      skipped: [],
      doneCount: Math.max(0, servingNo - 1),
      expected: [],
    });
  };
  const audit = (user: string, role: 'Admin' | 'Doctor' | 'Secretary', action: string, details: string) => {
    db.audit.unshift({ id: shortHash(action + Date.now()), time: '10:30 AM', user, role, action: { tl: action, en: action }, details, hash: shortHash(user + Date.now()) + '…' });
  };

  const issueNumber = (doctorId: string, p: { id: string; name: string; priority: QueueEntry['priority']; type: QueueEntry['type']; bookingId?: string }) => {
    const d = doctor(doctorId);
    const q = queue(doctorId);
    const { hour } = clock();
    if (isTooEarlyToScan(d, hour, db.settings.scanWindowMinutes) && !q.serving)
      return { status: 'too_early' as const, doctorId, opensAt: scanOpensAtLabel(d, db.settings.scanWindowMinutes) };
    const total = q.doneCount + q.waiting.length + (q.serving ? 1 : 0);
    if (total >= schedule(doctorId).maxPatientsPerDay) return { status: 'full' as const, doctorId };
    const entry: QueueEntry = { number: nextQueueNumber(d, q), patientId: p.id, patientName: p.name, type: p.type, priority: p.priority, arrivedAt: '10:30 AM', bookingId: p.bookingId };
    q.waiting = insertIntoQueue(q.waiting, entry);
    q.expected = q.expected.filter((e) => e.bookingId !== p.bookingId);
    emit(`queue:${doctorId}`);
    return { status: 'issued' as const, entry, doctorId, position: q.waiting.findIndex((x) => x.number === entry.number) + 1 };
  };

  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    clock,

    async login(app, cred) {
      const who = {
        patient: ['p-4812', 'Juan Dela Cruz'],
        doctor: ['d1', 'Dr. Maria Santos'],
        secretary: ['s1', 'Carla Ramos'],
        kiosk: ['kiosk-1', 'OPD Lobby Kiosk'],
        admin: ['a1', 'Admin Delos Reyes'],
      }[app];
      if ('secret' in cred && !cred.secret) throw new Error('Missing credentials');
      return wait({ app, userId: who[0], displayName: who[1], initials: initials(who[1]), role: app === 'admin' ? 'super' : undefined, token: `mock.${app}.${Date.now()}` });
    },
    async logout() {
      return wait(undefined);
    },

    getSpecializations: () => wait(db.specs),
    getDoctors: () => wait(db.doctors),
    getLiveStatus: async () => {
      const { today, hour } = clock();
      return wait(
        db.doctors.map((d) => {
          const base = liveStatusFor(d, today, hour);
          const q = base.openToday ? queue(d.id) : db.queues[d.id];
          return q ? { ...base, nowServing: q.serving?.number ?? null, waiting: q.waiting.length, servedToday: q.doneCount } : base;
        }),
      );
    },
    async getAvailability(doctorId, o) {
      const { today, hour } = clock();
      const s = schedule(doctorId);
      return wait(availableDates(doctor(doctorId), { today, hour, capacity: s.maxPatientsPerDay, blocked: s.blocked, noShowRestricted: !!o?.noShowRestricted }));
    },
    getAnnouncements: () => wait(db.announcements),
    getSettings: () => wait(db.settings),
    async updateSettings(patch) {
      Object.assign(db.settings, patch);
      emit('settings');
      return wait(db.settings);
    },
    getNotifications: (app) => wait(app === 'doctor' ? DOCTOR_NOTIFICATIONS : app === 'secretary' ? SECRETARY_NOTIFICATIONS : PATIENT_NOTIFICATIONS),
    async askGuide(question, key) {
      const k = (key as keyof typeof AI_GUIDE.answers) ?? routeAiQuestion(question);
      return wait({ key: k, answer: AI_GUIDE.answers[k] ?? AI_GUIDE.answers.def });
    },

    getMe: () => wait(ME),
    getFamily: () => wait(db.family),
    async addFamilyMember(m) {
      const member = { ...m, patientId: `DYH-2026-00${5200 + db.family.length}` };
      db.family.push(member);
      emit('family');
      return wait(member);
    },
    getMyBookings: () => wait(db.bookings),
    getMyRecords: () => wait(MY_RECORDS),
    getMyConsultations: () => wait(MY_CONSULTATIONS.map((c) => ({ ...c, rating: db.ratings[c.id] }))),
    async createBooking(b) {
      const fam = db.family.find((f) => f.patientId === b.patientId);
      const booking: Booking = {
        id: makeBookingId(b.date, seededInt(b.doctorId + b.date, 10, 99)),
        patientId: b.patientId,
        patientName: fam?.displayName ?? ME.displayName,
        doctorId: b.doctorId,
        date: b.date,
        type: b.date === clock().today ? 'walkin' : 'online',
        status: 'booked',
        chiefComplaint: b.chiefComplaint,
      };
      db.bookings.push(booking);
      emit('bookings');
      return wait(booking);
    },
    async cancelBooking(id) {
      const b = db.bookings.find((x) => x.id === id);
      if (b) b.status = 'cancelled';
      emit('bookings');
      return wait(undefined);
    },
    async confirmBooking(id) {
      const b = db.bookings.find((x) => x.id === id)!;
      b.status = 'confirmed';
      emit('bookings');
      return wait(b);
    },
    async rateConsultation(id, stars) {
      if (db.ratings[id]) throw new Error('Ratings cannot be edited once posted');
      db.ratings[id] = stars;
      emit('consultations');
      return wait(undefined);
    },
    getRecordQr: (patientId) => wait({ token: `DYH-REC:${patientId}:${Date.now().toString(36)}`, expiresInSec: 58 }),

    getQueue: (doctorId) => wait(queue(doctorId)),
    getDoctorPatients: () => wait(db.patients),
    getPatientHistory: () => wait(db.records),
    getTodayVitals: () => wait(db.vitals),
    getDrafts: () => wait(db.drafts),
    getFollowUps: () => wait(UPCOMING_FOLLOW_UPS),
    async signConsultation(input) {
      const d = doctor(input.doctorId);
      const rec = {
        id: `rec-${Date.now()}`, patientId: input.patientId, date: clock().today, doctorId: d.id, doctorName: d.name, type: 'online' as const,
        title: { tl: input.title, en: input.title },
        diagnoses: input.diagnoses.map((x) => ({ tl: x, en: x })),
        findings: { tl: input.findings, en: input.findings },
        prescriptions: input.prescriptions, labs: input.labs, notes: { tl: input.notes, en: input.notes },
        signed: true, integrityHash: shortHash(JSON.stringify(input)) + '…',
      };
      db.records.unshift(rec);
      const draft = db.drafts.find((x) => x.patientId === input.patientId);
      if (draft) draft.signed = true;
      audit(d.name, 'Doctor', 'Consultation Signed', `Verified with ${input.verifiedWith === 'pin' ? 'PIN' : 'Fingerprint'} · ${input.patientId}`);
      emit('records');
      return wait(rec);
    },
    async addAddendum() {
      emit('records');
      return wait(undefined);
    },
    async bookFollowUp(input) {
      const p = db.patients.find((x) => x.id === input.patientId);
      const booking: Booking = { id: makeBookingId(input.date, seededInt(input.patientId + input.date, 1, 30)), patientId: input.patientId, patientName: p?.displayName ?? '', doctorId: input.doctorId, date: input.date, type: 'online', status: 'booked', isFollowUp: true };
      const draft = db.drafts.find((x) => x.patientId === input.patientId);
      if (draft) draft.followUpDone = true;
      emit('followups');
      return wait(booking);
    },
    async delegateToSecretary() {
      emit('drafts');
      return wait(undefined);
    },
    getSchedule: (doctorId) => wait(schedule(doctorId)),
    async saveSchedule(s) {
      db.schedules[s.doctorId] = clone(s);
      emit(`schedule:${s.doctorId}`);
      return wait(s);
    },
    async blockDate(b) {
      const affected = seededInt(b.date, 3, 14);
      const row: BlockedDate = { ...b, affected, status: affected ? 'pending' : 'none' };
      schedule(b.doctorId).blocked.unshift(row);
      emit(`schedule:${b.doctorId}`);
      return wait(row);
    },
    async removeBlockedDate(doctorId, date) {
      const s = schedule(doctorId);
      s.blocked = s.blocked.filter((x) => x.date !== date);
      emit(`schedule:${doctorId}`);
      return wait(undefined);
    },

    async queueAction(doctorId, action, index = 0) {
      const q = queue(doctorId);
      if (action === 'start' && !q.serving && q.waiting.length) q.serving = q.waiting.shift()!;
      if (action === 'skip' && q.serving) {
        q.skipped.push(q.serving);
        q.serving = q.waiting.shift() ?? null;
      }
      if (action === 'done' && q.serving) {
        q.doneCount++;
        q.serving = q.waiting.shift() ?? null;
      }
      if (action === 'callBack') {
        const [p] = q.skipped.splice(index, 1);
        if (p) q.waiting.unshift(p);
      }
      if (action === 'noShow') {
        const [p] = q.skipped.splice(index, 1);
        if (p) audit('Carla Ramos', 'Secretary', 'Queue Update', `${p.number} marked as No-show`);
      }
      emit(`queue:${doctorId}`);
      return wait(q);
    },
    async saveVitals(number, v) {
      db.vitals[number] = { ...v, recordedAt: '10:30 AM', recordedBy: 'Carla Ramos' };
      emit('vitals');
      return wait(undefined);
    },
    getDelegated: (doctorId) => wait(db.delegated[doctorId] ?? []),
    async submitFindingsDraft(input) {
      const row = db.delegated[input.doctorId]?.find((x) => x.number === input.queueNumber);
      if (row) row.drafted = input.mode;
      const p = db.patients.find((x) => x.displayName === input.patientName);
      const patientId = p?.id ?? `DYH-2026-00${5000 + db.patients.length}`;
      db.drafts = db.drafts.filter((d) => d.patientId !== patientId);
      db.drafts.push({ patientId, preparedBy: 'Carla Ramos', preparedAt: '10:40 AM', source: 'delegated', mode: input.mode, followUp: input.followUp && { date: input.followUp.date, purpose: { tl: input.followUp.purpose, en: input.followUp.purpose } }, signed: false, followUpDone: false });
      emit('drafts');
      return wait(undefined);
    },
    async sendPatientNotice(input) {
      const s = schedule(input.doctorId);
      const b = input.date && s.blocked.find((x) => x.date === input.date);
      if (b) {
        b.status = 'sent';
        b.notifiedBy = 'Sek. Carla Ramos';
      }
      emit(`schedule:${input.doctorId}`);
      return wait({ sent: b ? b.affected : queue(input.doctorId).waiting.length + 1 });
    },

    async kioskScan(code) {
      const c = code.trim().toUpperCase();
      for (const q of Object.values(db.queues)) {
        const e = q.expected.find((x) => x.bookingId === c);
        if (e) return wait(issueNumber(q.doctorId, { id: e.patientId, name: e.patientName, priority: e.priority, type: 'online', bookingId: e.bookingId }));
      }
      const wk = db.walkIns[c];
      if (wk) {
        const r = issueNumber(wk.doctorId, { ...wk, type: 'walkin' });
        return wait(r.status === 'too_early' ? { ...r, walkInQr: c } : r);
      }
      const own = db.bookings.find((b) => b.id === c);
      if (own) {
        if (own.date !== clock().today) return wait({ status: 'wrong_day' as const, doctorId: own.doctorId });
        if (own.queueNumber) return wait({ status: 'issued' as const, doctorId: own.doctorId, entry: { number: own.queueNumber, patientId: own.patientId, patientName: own.patientName, type: own.type, priority: null } });
        return wait(issueNumber(own.doctorId, { id: own.patientId, name: own.patientName, priority: null, type: own.type, bookingId: own.id }));
      }
      return wait({ status: 'not_found' as const });
    },
    async kioskJoin(doctorId, p) {
      const r = issueNumber(doctorId, { ...p, type: 'walkin' });
      if (r.status !== 'too_early') return wait(r);
      const walkInQr = `WK-261030-0${50 + db.seq++}`;
      db.walkIns[walkInQr] = { doctorId, ...p };
      return wait({ ...r, walkInQr });
    },
    async kioskIdentify(by) {
      if ('recordQr' in by) return wait({ patient: ME });
      const digits = by.mobile.replace(/\D/g, '');
      if (digits.length !== 11) throw new Error('Invalid mobile number');
      if (!by.otp) return wait({ otpSent: true });
      if (by.otp.length !== 6) throw new Error('Invalid OTP');
      const p = [ME, ...db.patients].find((x) => x.mobile?.replace(/\D/g, '') === digits);
      return wait({ patient: p ?? ME });
    },
    async kioskRegister(r) {
      const id = `DYH-2026-00${5300 + db.seq++}`;
      const p: Patient = { id, name: { last: r.last, first: r.first, middle: r.middle, suffix: r.suffix }, displayName: `${r.first} ${r.last}`, birthday: r.birthday, age: 2026 - Number(r.birthday.slice(0, 4)), sex: r.sex, mobile: r.mobile, address: r.address, bloodType: r.bloodType ?? 'unknown', allergies: r.allergies ?? [], priority: r.priority, emergencyContact: r.emergencyContact };
      db.patients.push(p);
      return wait(p);
    },
    submitSurvey: () => wait(undefined),

    getAdmins: () => wait(db.admins),
    getSecretaries: () => wait(db.secretaries),
    getRooms: () => wait(db.rooms),
    async addRoom(r) {
      db.rooms.push({ number: r.number, floor: r.floor, capacity: r.capacity });
      db.rooms.sort((a, b) => a.number.localeCompare(b.number));
      emit('rooms');
      return wait(r);
    },
    async assignRoom(doctorId, room) {
      const d = doctor(doctorId);
      d.room = room;
      d.floor = Number(room[0]);
      audit('Admin Delos Reyes', 'Admin', 'Account Changes', `Assigned Room ${room} to ${d.name}`);
      emit('doctors');
      return wait(d);
    },
    async createAccount(a) {
      const id = `${a.kind[0]}${Date.now().toString(36)}`;
      if (a.kind === 'secretary') db.secretaries.push({ id, name: a.name, email: a.email, mobile: a.mobile, doctorIds: a.doctorIds ?? [], createdAt: clock().today, createdBy: 'Admin Delos Reyes', status: 'active' });
      if (a.kind === 'admin') db.admins.push({ id, name: a.name, email: a.email, mobile: a.mobile, role: 'admin', createdAt: clock().today, createdBy: 'Admin Delos Reyes', permissions: a.permissions ?? {}, doctorId: a.linkedDoctorId, credentials: a.credentials, status: 'active' });
      audit('Admin Delos Reyes', 'Admin', 'Account Changes', `Created ${a.kind}: ${a.name}`);
      emit('accounts');
      return wait({ id });
    },
    async updateAccount(id, p) {
      const d = db.doctors.find((x) => x.id === id);
      if (d) Object.assign(d, { name: p.name ?? d.name, email: p.email ?? d.email, mobile: p.mobile ?? d.mobile, credentials: p.credentials ?? d.credentials, specializationId: p.specializationId ?? d.specializationId, room: p.room ?? d.room });
      const s = db.secretaries.find((x) => x.id === id);
      if (s) Object.assign(s, { name: p.name ?? s.name, email: p.email ?? s.email, mobile: p.mobile ?? s.mobile, doctorIds: p.doctorIds ?? s.doctorIds });
      const a = db.admins.find((x) => x.id === id);
      if (a) Object.assign(a, { name: p.name ?? a.name, email: p.email ?? a.email, mobile: p.mobile ?? a.mobile, permissions: p.permissions ?? a.permissions });
      audit('Admin Delos Reyes', 'Admin', 'Account Changes', `Updated account ${p.name ?? id}`);
      emit('accounts');
      return wait(undefined);
    },
    async setAccountStatus(id, status, reason) {
      const rec = [...db.admins, ...db.secretaries, ...db.doctors].find((x) => x.id === id);
      if (rec) {
        rec.status = status;
        (rec.statusHistory ??= []).unshift({ status, reason, at: '10:30 AM', by: 'Admin Delos Reyes' });
        audit('Admin Delos Reyes', 'Admin', 'Account Changes', `${status === 'active' ? 'Activated' : 'Deactivated'} ${rec.name}: ${reason}`);
      }
      emit('accounts');
      return wait(undefined);
    },
    async resetPassword(id) {
      const rec = [...db.admins, ...db.secretaries, ...db.doctors].find((x) => x.id === id);
      audit('Admin Delos Reyes', 'Admin', 'Administrative Action', `Sent reset link to ${rec?.name ?? id}`);
      emit('accounts');
      return wait(undefined);
    },
    getClinics: () => wait(db.clinics),
    async saveClinic(c) {
      const i = db.clinics.findIndex((x) => x.specializationId === c.specializationId);
      const rec: ClinicConfig = { specializationId: c.specializationId, doctorIds: c.doctorIds, services: c.services, visible: c.visible };
      if (i >= 0) db.clinics[i] = rec;
      else db.clinics.push(rec);
      if (c.name && !db.specs.some((x) => x.id === c.specializationId))
        db.specs.push({ id: c.specializationId as (typeof db.specs)[number]['id'], name: c.name, icon: c.icon ?? 'stethoscope', services: [] });
      emit('clinics');
      return wait(rec);
    },
    getPasswordRequests: () => wait(db.pwRequests),
    async sendResetLink(id) {
      const r = db.pwRequests.find((x) => x.id === id);
      if (r) {
        r.status = 'sent';
        audit('Admin Delos Reyes', 'Admin', 'Administrative Action', `Sent reset link to ${r.name}`);
      }
      emit('accounts');
      return wait(undefined);
    },
    getAuditLogs: () => wait(db.audit),
    getGeneratedReports: () => wait(GENERATED_REPORTS),
    getRatingComments: () => wait(RATING_COMMENTS),
    getMasterPatients: () => wait(MASTER_PATIENTS),
    async publishAnnouncement(a, o) {
      const ann = { ...a, id: `a${db.announcements.length + 1}`, status: o?.draft ? ('draft' as const) : a.from > clock().today ? ('pending' as const) : ('active' as const) };
      db.announcements.unshift(ann);
      emit('announcements');
      return wait(ann);
    },
  };
}
