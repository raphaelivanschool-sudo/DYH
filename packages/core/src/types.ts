/**
 * DYH domain model.
 *
 * These types are the contract between the front ends and the (future) backend.
 * Every API response in @dyh/api resolves to one of these shapes, so the backend
 * team can implement the same JSON and the screens keep working unchanged.
 *
 * Conventions
 * - Dates are ISO calendar dates: "YYYY-MM-DD". Times are "HH:mm" (24h).
 * - Weekdays follow JavaScript: 0 = Sunday … 6 = Saturday.
 * - Text that is authored in both languages (medical notes, labels from the DB)
 *   is a `Localized` object. UI chrome is translated by @dyh/i18n instead.
 */

export type Lang = 'tl' | 'en';
export type Localized = { tl: string; en: string };

export type AppId = 'patient' | 'doctor' | 'secretary' | 'kiosk' | 'admin';
export type ISODate = string; // YYYY-MM-DD
export type HHmm = string; // 24h "08:30"

/* ------------------------------------------------------------------ */
/* Clinics & doctors                                                   */
/* ------------------------------------------------------------------ */

export type SpecializationId =
  | 'im' | 'ped' | 'ob' | 'car' | 'ent' | 'ort' | 'der' | 'oph' | 'neu'
  | 'pul' | 'gas' | 'neph' | 'endo' | 'uro' | 'psy' | 'sur' | 'reh' | 'den';

export interface Specialization {
  id: SpecializationId;
  name: Localized;
  /** Lucide icon name (kebab-case), e.g. "heart-pulse". */
  icon: string;
  /** Extra services shown under Clinics & Services. */
  services: string[];
}

export interface Doctor {
  id: string;
  name: string; // "Dr. Maria Santos"
  specializationId: SpecializationId;
  room: string;
  floor: number;
  /** Weekdays with clinic, 0 = Sunday. */
  clinicDays: number[];
  /** Clinic hours as whole hours in 24h, [start, end). */
  hours: { start: number; end: number };
  /** Queue number prefix, e.g. "IM" → IM-015. */
  queuePrefix: string;
  credentials: string[];
  email: string;
  mobile: string;
  /** Max patients per day (online + walk-in), set by the doctor. */
  maxPatientsPerDay: number;
  status: AccountStatus;
  statusHistory?: StatusChange[];
}

/** Live status of a doctor's clinic today. */
export interface DoctorLiveStatus {
  doctorId: string;
  openToday: boolean;
  /** Queue number being served, or null when not serving. */
  nowServing: string | null;
  waiting: number;
  servedToday: number;
  avgWaitMinutes: number | null;
}

/* ------------------------------------------------------------------ */
/* Patients & family                                                   */
/* ------------------------------------------------------------------ */

export type Priority = 'senior' | 'pwd';
export type Sex = 'M' | 'F';
export type RelationKey = 'self' | 'spouse' | 'parent' | 'mother' | 'father' | 'child' | 'sibling' | 'guardian' | 'friend';
export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown';

export interface PersonName {
  last: string;
  first: string;
  middle?: string;
  suffix?: string;
}

export interface Address {
  regionCode: string;
  provinceCode: string;
  cityCode: string;
  barangay: string;
  houseNo?: string;
  street?: string;
}

export interface Patient {
  /** Patient ID, e.g. DYH-2026-004812. One ID = one medical record. */
  id: string;
  name: PersonName;
  displayName: string;
  birthday: ISODate;
  age: number;
  sex: Sex;
  /** Registered mobile, always shown masked in the apps. Locked in-app. */
  mobile: string;
  email?: string;
  address?: Address;
  city?: string;
  bloodType: BloodType;
  allergies: string[];
  priority: Priority | null;
  emergencyContact?: { name: string; mobile: string; relation: RelationKey };
  lastVisit?: ISODate;
  visits?: number;
}

export interface FamilyMember {
  patientId: string;
  displayName: string;
  relation: RelationKey;
  age: number;
  priority: Priority | null;
}

/* ------------------------------------------------------------------ */
/* Bookings & queue                                                    */
/* ------------------------------------------------------------------ */

export type VisitType = 'online' | 'walkin';

export type AppointmentStatus =
  | 'booked' | 'confirmed' | 'unconfirmed' | 'arrived' | 'in_consultation'
  | 'done' | 'cancelled' | 'rescheduled' | 'skipped' | 'no_show';

/**
 * A Booking reserves a DATE with a doctor. It is NOT a queue number.
 * The queue number is issued only when the Booking QR is scanned at the Kiosk.
 */
export interface Booking {
  id: string; // BK-261112-004 (online) or WK-… (walk-in)
  patientId: string;
  patientName: string;
  doctorId: string;
  date: ISODate;
  type: VisitType;
  status: AppointmentStatus;
  /** Set once scanned at the Kiosk. */
  queueNumber?: string;
  isFollowUp?: boolean;
  bookedBy?: { name: string; relation: RelationKey };
  chiefComplaint?: Localized | string;
}

export interface QueueEntry {
  number: string; // IM-018
  patientId: string;
  patientName: string;
  type: VisitType;
  priority: Priority | null;
  /** Time scanned at the Kiosk ("arrived"), display string. */
  arrivedAt?: string;
  bookingId?: string;
  scheduledLabel?: string;
}

/** Online booking for today that has not been scanned at the Kiosk yet. */
export interface ExpectedArrival {
  bookingId: string;
  patientId: string;
  patientName: string;
  priority: Priority | null;
  bookedBy?: { name: string; relation: RelationKey };
  chiefComplaint?: Localized;
}

export interface DoctorQueue {
  doctorId: string;
  serving: QueueEntry | null;
  waiting: QueueEntry[];
  skipped: QueueEntry[];
  doneCount: number;
  expected: ExpectedArrival[];
}

export interface DayAvailability {
  date: ISODate;
  available: boolean;
  reason?: 'no_clinic' | 'past' | 'blocked' | 'full' | 'no_show_restriction';
  online: number;
  walkin: number;
  total: number;
  capacity: number;
  left: number;
}

/* ------------------------------------------------------------------ */
/* Medical records                                                     */
/* ------------------------------------------------------------------ */

export interface Vitals {
  bp?: string; // "146/92"
  hr?: number;
  temp?: string;
  rr?: number;
  o2?: number;
  wt?: number;
  ht?: number;
  chiefComplaint?: Localized | string;
  recordedAt?: string;
  recordedBy?: string;
}

export interface Prescription {
  medicine: string;
  intake: Localized | string;
}

export interface Addendum {
  date: ISODate;
  text: Localized;
  authorDoctorId: string;
}

export interface ConsultationRecord {
  id: string;
  patientId: string;
  date: ISODate;
  doctorId: string;
  doctorName: string;
  type: VisitType;
  title?: Localized;
  diagnoses: Localized[];
  findings: Localized;
  prescriptions: Prescription[];
  labs: string[];
  notes: Localized;
  vitals?: Vitals;
  addendum?: Addendum;
  /** Records become permanent only when signed by the authoring doctor. */
  signed: boolean;
  integrityHash?: string;
}

/** Draft prepared by a secretary (or AI) for the doctor to verify and sign. */
export interface ConsultationDraft {
  patientId: string;
  preparedBy: string;
  preparedAt: string;
  source: 'delegated';
  mode: 'text' | 'photo';
  followUp?: { date: ISODate; purpose: Localized };
}

export interface FollowUp {
  patientId: string;
  due: ISODate;
  queueNumber?: string;
}

export interface BlockedDate {
  doctorId: string;
  date: ISODate;
  reason: string;
  affected: number;
  status: 'pending' | 'sent' | 'none';
  notifiedBy?: string;
  notifiedAt?: string;
  note?: string;
}

export interface WeeklyScheduleDay {
  on: boolean;
  in?: HHmm;
  out?: HHmm;
}

export interface DoctorSchedule {
  doctorId: string;
  /** Index 0 = Sunday. */
  week: WeeklyScheduleDay[];
  maxPatientsPerDay: number;
  closeOnlineToday: boolean;
  blocked: BlockedDate[];
}

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

export interface Announcement {
  id: string;
  icon: string;
  /** CSS gradient on web; first/second colour used on native. */
  colors: [string, string];
  title: string;
  subtitle: string;
  summary: string;
  /** Body in light Markdown (**bold**, line breaks). Not translated by design. */
  body: string;
  from: ISODate;
  to: ISODate;
  audience: 'all' | { clinics: SpecializationId[] };
  status: 'active' | 'pending' | 'draft' | 'expired';
}

export interface AppNotification {
  id: string;
  icon: string;
  tone: Tone;
  title: Localized;
  body: Localized;
  when: Localized;
  unread?: boolean;
  category?: 'queue' | 'record' | 'report' | 'announcement' | 'all';
}

export type Tone = 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'teal' | 'gray' | 'prio';

/* ------------------------------------------------------------------ */
/* Staff & administration                                              */
/* ------------------------------------------------------------------ */

export type AccountStatus = 'active' | 'deactivated';

/** One activate/deactivate event, kept for the account's history. */
export interface StatusChange {
  status: AccountStatus;
  reason: string;
  at: string;
  by: string;
}

/** A clinic as configured by the Admin (Clinics & Services). */
export interface ClinicConfig {
  specializationId: string;
  doctorIds: string[];
  services: string[];
  visible: boolean;
}

export interface Secretary {
  id: string;
  name: string;
  email: string;
  mobile: string;
  doctorIds: string[];
  createdAt: ISODate;
  createdBy: string;
  status: AccountStatus;
  statusHistory?: StatusChange[];
}

export type AdminModule =
  | 'dashboard' | 'analytics' | 'accounts' | 'clinics' | 'rooms' | 'announce'
  | 'master' | 'reports' | 'ratings' | 'audit' | 'settings';

export type Crud = 'c' | 'u' | 'd';
export type PermissionSet = Partial<Record<AdminModule, Partial<Record<Crud, boolean>>>>;

export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: 'super' | 'admin';
  createdBy: string;
  createdAt: ISODate;
  permissions: PermissionSet;
  /** Linked doctor account (separate login). */
  doctorId?: string;
  credentials?: string[];
  status: AccountStatus;
  statusHistory?: StatusChange[];
}

export interface Room {
  number: string;
  floor: number;
  /** How many doctors can use the room at the same time. */
  capacity: number;
}

export interface PasswordResetRequest {
  id: string;
  name: string;
  role: 'doctor' | 'secretary';
  email: string;
  requestedOn: ISODate;
  time: string;
  message: string;
  otpVerified: boolean;
  status: 'pending' | 'sent';
}

export interface GeneratedReport {
  id: string;
  scope: string;
  title: Localized;
  from: ISODate;
  to: ISODate;
  generatedOn: ISODate;
}

export interface AuditLogEntry {
  id: string;
  time: string;
  user: string;
  role: 'Admin' | 'Doctor' | 'Secretary';
  action: Localized;
  details: Localized | string;
  hash: string;
}

export interface RatingComment {
  stars: number;
  text: Localized;
  doctorName: string;
  date: ISODate;
}

export interface SystemSettings {
  /** Minutes before clinic hours when Booking/Walk-in QR scanning opens. */
  scanWindowMinutes: number;
  /** Seconds before the Kiosk queue slip returns to Home. */
  kioskSlipSeconds: number;
  /** Inactivity auto-logout per app, in minutes. */
  autoLogoutMinutes: Record<Exclude<AppId, 'kiosk'>, number>;
  bookingWindowDays: number;
  cancellationCutoffHours: number;
  reminderDaysBefore: number;
}

/** Patient-facing consultation summary (for ratings). */
export interface PastConsultation {
  id: string;
  doctorId: string;
  type: VisitType;
  date: ISODate;
  status: AppointmentStatus;
}

/** Signed-in user, as returned by the auth endpoints. */
export interface Session {
  app: AppId;
  userId: string;
  displayName: string;
  initials: string;
  role?: AdminAccount['role'];
  token: string;
  /** Patient signed in with a verified mobile number that has no record yet. */
  needsRegistration?: boolean;
}
