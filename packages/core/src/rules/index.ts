/**
 * Business rules from the DYH project summary, as pure functions.
 * The backend must enforce the same rules; the apps use these to render state
 * and to validate before calling the API. Covered by rules.test.ts.
 */
import { DOCTORS, DEMO_NOW_HOUR, LIVE_OVERRIDES } from '../data/clinic';
import { addDays, formatHour, padNum, parseISO, seededInt, weekdayOf } from '../format';
import type {
  AdminAccount, AdminModule, BlockedDate, Crud, DayAvailability, Doctor, DoctorLiveStatus, DoctorQueue,
  ISODate, PersonName, QueueEntry, Room, Vitals, WeeklyScheduleDay,
} from '../types';

/* ------------------------------------------------------------------ */
/* Clinic hours & today                                                */
/* ------------------------------------------------------------------ */

export const hasClinicOn = (d: Doctor, date: ISODate) => d.clinicDays.includes(weekdayOf(date));

export type TodayState = 'no_clinic' | 'open' | 'done';
export const todayState = (d: Doctor, today: ISODate, hour: number): TodayState =>
  !hasClinicOn(d, today) ? 'no_clinic' : hour < d.hours.end ? 'open' : 'done';

/** Open-today doctors first, then those with clinic today, then A–Z. */
export const sortDoctorsForToday = (list: Doctor[], today: ISODate, hour: number) =>
  [...list].sort(
    (a, b) =>
      Number(todayState(b, today, hour) === 'open') - Number(todayState(a, today, hour) === 'open') ||
      Number(hasClinicOn(b, today)) - Number(hasClinicOn(a, today)) ||
      a.name.localeCompare(b.name),
  );

/** Live status for every doctor (explicit sample values, else deterministic). */
export const liveStatusFor = (d: Doctor, today: ISODate, hour = DEMO_NOW_HOUR): DoctorLiveStatus => {
  const open = hasClinicOn(d, today) && hour < d.hours.end;
  const o = LIVE_OVERRIDES[d.id];
  const started = hour >= d.hours.start - 1;
  const nowServing = o ? o.serving : open && started ? `${d.queuePrefix}-${padNum(seededInt(d.id + 's', 2, 9))}` : null;
  const waiting = o ? o.waiting : open && started ? seededInt(d.id + 'w', 1, 8) : 0;
  return {
    doctorId: d.id,
    openToday: open,
    nowServing,
    waiting,
    servedToday: open ? seededInt(d.id + 'sv', 8, 42) : 0,
    avgWaitMinutes: open ? seededInt(d.id + 'aw', 12, 32) : null,
  };
};

/* ------------------------------------------------------------------ */
/* Scan window — numbers are issued only near clinic hours             */
/* ------------------------------------------------------------------ */

/** Hour (fractional) when Booking/Walk-in QR scanning opens. */
export const scanOpensAtHour = (d: Doctor, windowMinutes: number) => d.hours.start - windowMinutes / 60;
export const scanOpensAtLabel = (d: Doctor, windowMinutes: number) => formatHour(scanOpensAtHour(d, windowMinutes));
export const isTooEarlyToScan = (d: Doctor, hour: number, windowMinutes: number) => hour < scanOpensAtHour(d, windowMinutes);

/* ------------------------------------------------------------------ */
/* Queue ordering: scan time + priority (Senior / PWD), never booking  */
/* ------------------------------------------------------------------ */

/** Insert a newly scanned patient: priority goes ahead of the first non-priority patient. */
export const insertIntoQueue = (waiting: QueueEntry[], entry: QueueEntry): QueueEntry[] => {
  const next = [...waiting];
  if (entry.priority) {
    const i = next.findIndex((p) => !p.priority);
    next.splice(i < 0 ? next.length : i, 0, entry);
  } else next.push(entry);
  return next;
};

/** Next number for a doctor's queue, e.g. IM-021. */
export const nextQueueNumber = (d: Doctor, q: DoctorQueue) => {
  const all = [q.serving, ...q.waiting, ...q.skipped].filter(Boolean) as QueueEntry[];
  const max = all.reduce((m, p) => Math.max(m, Number(p.number.split('-')[1]) || 0), 0);
  return `${d.queuePrefix}-${padNum(max + 1)}`;
};

export const onlineStats = (q: DoctorQueue) => {
  const arrived = [q.serving, ...q.waiting].filter((p) => p && p.type === 'online').length + Math.round(q.doneCount * 0.4);
  return { arrived, expected: q.expected.length, total: arrived + q.expected.length };
};

/** Booking QR id: BK-YYMMDD-NNN (online) or WK-… (walk-in). */
export const makeBookingId = (date: ISODate, seq: number, type: 'online' | 'walkin' = 'online') => {
  const [y, m, d] = parseISO(date);
  return `${type === 'online' ? 'BK' : 'WK'}-${String(y).slice(2)}${padNum(m + 1, 2)}${padNum(d, 2)}-${padNum(seq)}`;
};

/* ------------------------------------------------------------------ */
/* Booking availability — no time slots, only per-day capacity         */
/* ------------------------------------------------------------------ */

export interface AvailabilityContext {
  today: ISODate;
  hour: number;
  capacity: number;
  blocked: BlockedDate[];
  /** After a no-show the next visit must be walk-in (same day only). */
  noShowRestricted: boolean;
}

export const dayAvailability = (d: Doctor, date: ISODate, ctx: AvailabilityContext): DayAvailability => {
  const base = { date, online: 0, walkin: 0, total: 0, capacity: ctx.capacity, left: 0 };
  const isToday = date === ctx.today;
  if (weekdayOf(date) === 0 || !hasClinicOn(d, date)) return { ...base, available: false, reason: 'no_clinic' };
  if (date < ctx.today || (isToday && ctx.hour >= d.hours.end)) return { ...base, available: false, reason: 'past' };
  if (ctx.blocked.some((b) => b.doctorId === d.id && b.date === date)) return { ...base, available: false, reason: 'blocked' };
  const dayIndex = Math.round((Date.parse(date) - Date.parse(ctx.today)) / 86_400_000);
  const walkin = isToday ? seededInt(d.id + 'tw', 4, 13) : 0;
  let online = seededInt(d.id + 'o' + dayIndex, 3, 16);
  if (d.id === 'd1' && dayIndex === 3) online = ctx.capacity; // sample: a full day
  const total = walkin + online;
  if (total >= ctx.capacity) return { ...base, online, walkin, total, available: false, reason: 'full' };
  if (!isToday && ctx.noShowRestricted) return { ...base, online, walkin, total, available: false, reason: 'no_show_restriction' };
  return { ...base, online, walkin, total, available: true, left: ctx.capacity - total };
};

/** Only available dates are shown in booking (full / no-clinic dates are hidden). */
export const availableDates = (d: Doctor, ctx: AvailabilityContext, days = 7) =>
  Array.from({ length: days }, (_, i) => dayAvailability(d, addDays(ctx.today, i), ctx)).filter((x) => x.available);

/* ------------------------------------------------------------------ */
/* Follow-up calendar                                                  */
/* ------------------------------------------------------------------ */

export const isFollowUpDateOk = (date: ISODate, today: ISODate, week: WeeklyScheduleDay[], blocked: BlockedDate[]) =>
  date > today && !!week[weekdayOf(date)]?.on && !blocked.some((b) => b.date === date);

/** Quick picks (1 wk, 2 wks, 1 mo, 3 mos) land on the next clinic day on/after the offset. */
export const nextClinicDayAfter = (today: ISODate, offsetDays: number, week: WeeklyScheduleDay[], blocked: BlockedDate[]) => {
  for (let k = offsetDays; k < offsetDays + 60; k++) {
    const d = addDays(today, k);
    if (isFollowUpDateOk(d, today, week, blocked)) return d;
  }
  return null;
};

export const weekFromDoctor = (d: Doctor): WeeklyScheduleDay[] =>
  Array.from({ length: 7 }, (_, i) =>
    d.clinicDays.includes(i)
      ? { on: true, in: `${padNum(d.hours.start, 2)}:00`, out: `${padNum(d.hours.end, 2)}:00` }
      : { on: false },
  );

/* ------------------------------------------------------------------ */
/* Medical                                                             */
/* ------------------------------------------------------------------ */

export const bmi = (v?: Vitals) => (v?.wt && v?.ht ? (v.wt / Math.pow(v.ht / 100, 2)).toFixed(1) : '—');
export const vitalFlags = (v?: Vitals) => ({
  bp: !!v?.bp && Number(v.bp.split('/')[0]) >= 140,
  temp: !!v?.temp && Number(v.temp) >= 37.8,
  o2: !!v?.o2 && v.o2 < 95,
});

/** Only the authoring doctor may add an addendum to a signed record. */
export const canAddAddendum = (recordDoctorId: string, viewerDoctorId: string) => recordDoctorId === viewerDoctorId;

/** Patients rate only doctors they consulted, only after the consultation, once. */
export const canRate = (status: string, alreadyRated: boolean) => status === 'done' && !alreadyRated;

/* ------------------------------------------------------------------ */
/* Rooms: capacity = doctors allowed at the same time                  */
/* ------------------------------------------------------------------ */

export const schedulesOverlap = (a: Doctor, b: Doctor) =>
  a.clinicDays.some((x) => b.clinicDays.includes(x)) && a.hours.start < b.hours.end && b.hours.start < a.hours.end;

export const roomUsers = (room: string, doctors = DOCTORS) => doctors.filter((d) => d.room === room);
export const roomOverlaps = (room: string, d: Doctor, doctors = DOCTORS) => roomUsers(room, doctors).filter((x) => x.id !== d.id && schedulesOverlap(x, d));
export const roomFreeSlots = (r: Room, d: Doctor, doctors = DOCTORS) => r.capacity - roomOverlaps(r.number, d, doctors).length;
export const roomConflicts = (r: Room, doctors = DOCTORS) => roomUsers(r.number, doctors).filter((x) => roomOverlaps(r.number, x, doctors).length >= r.capacity);
export const roomPeak = (r: Room, doctors = DOCTORS) => {
  const u = roomUsers(r.number, doctors);
  return u.length ? Math.max(...u.map((x) => roomOverlaps(r.number, x, doctors).length + 1)) : 0;
};
export type RoomStatus = 'over' | 'in_use' | 'vacant';
export const roomStatus = (r: Room, doctors = DOCTORS): RoomStatus =>
  roomConflicts(r, doctors).length ? 'over' : roomUsers(r.number, doctors).length ? 'in_use' : 'vacant';

/* ------------------------------------------------------------------ */
/* Admin RBAC                                                          */
/* ------------------------------------------------------------------ */

export const canAccess = (a: AdminAccount, m: AdminModule) => a.role === 'super' || !!a.permissions[m];
export const canDo = (a: AdminAccount, m: AdminModule, op: Crud) => a.role === 'super' || !!a.permissions[m]?.[op];
/** The patient master list is Super Admin only and cannot be granted. */
export const canSeePatientMasterList = (a: AdminAccount) => a.role === 'super';

/* ------------------------------------------------------------------ */
/* Names                                                               */
/* ------------------------------------------------------------------ */

const PARTICLES = ['Dela', 'De', 'Del', 'Delos', 'Los', 'San', 'Santa', 'Van', 'Von'];
const SFX = ['Jr.', 'Sr.', 'II', 'III', 'IV'];

export const splitName = (full: string): PersonName => {
  const w = full.replace(/^Dr\.\s/, '').trim().split(/\s+/);
  let suffix = '';
  if (w.length > 2 && SFX.includes(w[w.length - 1])) suffix = w.pop()!;
  let last = w.pop() ?? '';
  while (w.length > 1 && PARTICLES.includes(w[w.length - 1])) last = `${w.pop()} ${last}`;
  return { first: w.join(' '), middle: '', last, suffix };
};

/** "Dr. Juan P. Dela Cruz Jr., MD, FPCP" — Dr. prefix only for MD / DMD / OD. */
export const displayName = (n: PersonName, credentials: string[] = [], isDoctor = false) => {
  const core = [n.first, n.middle ? `${n.middle.trim()[0].toUpperCase()}.` : '', n.last].filter(Boolean).join(' ') + (n.suffix ? ` ${n.suffix}` : '');
  if (!core.trim()) return '';
  const dr = isDoctor && credentials.some((c) => ['MD', 'DMD', 'OD'].includes(c)) ? 'Dr. ' : '';
  return dr + core + (isDoctor && credentials.length ? `, ${credentials.join(', ')}` : '');
};
