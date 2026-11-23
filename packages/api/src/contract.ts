/**
 * The DYH API contract. Every app talks to the backend only through this interface.
 *
 * - `createMockApi()` implements it in memory with the prototype's sample data.
 * - `createHttpApi()` implements it over REST (endpoints documented next to each method).
 *
 * When the backend is ready, switch the adapter in each app's `api.ts` — screens don't change.
 */
import type {
  AdminAccount, Announcement, ClinicConfig, AppId, AppNotification, AuditLogEntry, BlockedDate, Booking, ConsultationDraft,
  ConsultationRecord, DayAvailability, Doctor, DoctorLiveStatus, DoctorQueue, DoctorSchedule, FamilyMember,
  FollowUp, GeneratedReport, ISODate, Localized, PasswordResetRequest, PastConsultation, Patient, Prescription,
  Priority, QueueEntry, RatingComment, RelationKey, Room, Secretary, Session, Specialization, SystemSettings, Vitals,
} from '@dyh/core';

export interface ClinicClock {
  today: ISODate;
  hour: number;
}

export interface NewBooking {
  patientId: string;
  doctorId: string;
  date: ISODate;
  chiefComplaint?: string;
}

export interface SignConsultationInput {
  patientId: string;
  doctorId: string;
  title: string;
  findings: string;
  findingsSummary?: string;
  diagnoses: string[];
  prescriptions: Prescription[];
  labs: string[];
  notes: string;
  /** How identity was confirmed for the e-signature. */
  verifiedWith: 'pin' | 'biometric';
  source: 'typed' | 'photo' | 'voice' | 'secretary';
}

export interface KioskRegistration {
  last: string;
  first: string;
  middle?: string;
  suffix?: string;
  birthday: ISODate;
  sex: 'M' | 'F';
  mobile: string;
  priority: Priority | null;
}

export interface KioskScanResult {
  status: 'issued' | 'too_early' | 'full' | 'not_found' | 'wrong_day';
  entry?: QueueEntry;
  doctorId?: string;
  opensAt?: string;
  position?: number;
}

export interface NewStaffAccount {
  kind: 'doctor' | 'secretary' | 'admin';
  name: string;
  email: string;
  mobile: string;
  specializationId?: string;
  room?: string;
  credentials?: string[];
  doctorIds?: string[];
  permissions?: AdminAccount['permissions'];
  linkedDoctorId?: string;
}

/** A patient whose consultation is done and who can get a findings draft (Secretary → Findings Draft). */
export interface DelegatedPatient {
  name: string;
  number: string;
  time: string;
  /** The doctor asked the secretary to fill this in. */
  delegated: boolean;
  note?: Localized;
  /** Set once the secretary has sent a draft. */
  drafted?: 'text' | 'photo';
}

export interface FindingsDraftInput extends Omit<SignConsultationInput, 'doctorId' | 'verifiedWith' | 'source'> {
  doctorId: string;
  queueNumber: string;
  patientName: string;
  mode: 'text' | 'photo';
  followUp?: { date: ISODate; purpose: string };
}

export interface DyhApi {
  clock(): ClinicClock;

  /* ---- auth ---- POST /auth/{app}/login */
  login(app: AppId, credentials: { id: string; secret: string } | { biometric: true }): Promise<Session>;
  logout(): Promise<void>;

  /* ---- catalog ---- GET /specializations, /doctors, /doctors/live, /rooms */
  getSpecializations(): Promise<Specialization[]>;
  getDoctors(): Promise<Doctor[]>;
  getLiveStatus(): Promise<DoctorLiveStatus[]>;
  getAvailability(doctorId: string, opts?: { noShowRestricted?: boolean }): Promise<DayAvailability[]>;
  getAnnouncements(): Promise<Announcement[]>;
  getSettings(): Promise<SystemSettings>;
  updateSettings(patch: Partial<SystemSettings>): Promise<SystemSettings>;
  getNotifications(app: AppId): Promise<AppNotification[]>;
  askGuide(question: string, key?: string): Promise<{ key: string; answer: Localized }>;

  /* ---- patient ---- GET /me, /me/family, /me/bookings, /me/records */
  getMe(): Promise<Patient>;
  getFamily(): Promise<FamilyMember[]>;
  addFamilyMember(m: Omit<FamilyMember, 'patientId'>): Promise<FamilyMember>;
  getMyBookings(): Promise<Booking[]>;
  getMyRecords(): Promise<ConsultationRecord[]>;
  getMyConsultations(): Promise<(PastConsultation & { rating?: number })[]>;
  createBooking(b: NewBooking): Promise<Booking>;
  cancelBooking(id: string): Promise<void>;
  confirmBooking(id: string): Promise<Booking>;
  rateConsultation(id: string, stars: number, comment?: string): Promise<void>;
  /** Rotating, PIN-gated Record QR payload (screenshots are blocked in-app). */
  getRecordQr(patientId: string): Promise<{ token: string; expiresInSec: number }>;

  /* ---- doctor ---- */
  getQueue(doctorId: string): Promise<DoctorQueue>;
  getDoctorPatients(doctorId: string): Promise<Patient[]>;
  getPatientHistory(patientId: string): Promise<ConsultationRecord[]>;
  getTodayVitals(): Promise<Record<string, Vitals>>;
  getDrafts(doctorId: string): Promise<(ConsultationDraft & { signed?: boolean; followUpDone?: boolean })[]>;
  getFollowUps(doctorId: string): Promise<FollowUp[]>;
  signConsultation(input: SignConsultationInput): Promise<ConsultationRecord>;
  addAddendum(recordId: string, text: string): Promise<void>;
  bookFollowUp(input: { patientId: string; doctorId: string; date: ISODate; purpose: string; note?: string }): Promise<Booking>;
  delegateToSecretary(input: { patientId: string; doctorId: string; note?: string }): Promise<void>;
  getSchedule(doctorId: string): Promise<DoctorSchedule>;
  saveSchedule(s: DoctorSchedule): Promise<DoctorSchedule>;
  blockDate(b: Omit<BlockedDate, 'status' | 'affected'>): Promise<BlockedDate>;
  removeBlockedDate(doctorId: string, date: ISODate): Promise<void>;

  /* ---- secretary ---- POST /queues/{doctorId}/{action} */
  queueAction(doctorId: string, action: 'start' | 'skip' | 'done' | 'callBack' | 'noShow', index?: number): Promise<DoctorQueue>;
  saveVitals(queueNumber: string, v: Vitals): Promise<void>;
  /** GET /doctors/{id}/delegated — patients done today, for findings drafts. */
  getDelegated(doctorId: string): Promise<DelegatedPatient[]>;
  /** POST /drafts — secretary's draft; the doctor reviews and signs it. */
  submitFindingsDraft(input: FindingsDraftInput): Promise<void>;
  sendPatientNotice(input: { doctorId: string; date?: ISODate; template: string; message: string; channels: ('app' | 'sms')[] }): Promise<{ sent: number }>;

  /* ---- kiosk ---- */
  kioskScan(code: string): Promise<KioskScanResult>;
  kioskJoin(doctorId: string, patient: { id: string; name: string; priority: Priority | null }): Promise<KioskScanResult>;
  kioskRegister(r: KioskRegistration): Promise<Patient>;
  submitSurvey(answers: Record<string, number>): Promise<void>;

  /* ---- admin ---- */
  getAdmins(): Promise<AdminAccount[]>;
  getSecretaries(): Promise<Secretary[]>;
  getRooms(): Promise<Room[]>;
  addRoom(r: Room & { note?: string }): Promise<Room>;
  assignRoom(doctorId: string, room: string): Promise<Doctor>;
  createAccount(a: NewStaffAccount): Promise<{ id: string }>;
  updateAccount(id: string, patch: Partial<Omit<NewStaffAccount, 'kind'>>): Promise<void>;
  setAccountStatus(id: string, status: 'active' | 'deactivated', reason: string): Promise<void>;
  /** Admin-initiated reset: emails a reset link and temporary password. */
  resetPassword(accountId: string): Promise<void>;
  getPasswordRequests(): Promise<PasswordResetRequest[]>;
  sendResetLink(requestId: string): Promise<void>;
  getAuditLogs(): Promise<AuditLogEntry[]>;
  getGeneratedReports(): Promise<GeneratedReport[]>;
  getRatingComments(): Promise<RatingComment[]>;
  getMasterPatients(): Promise<Patient[]>;
  getClinics(): Promise<ClinicConfig[]>;
  saveClinic(c: ClinicConfig & { name?: Localized; icon?: string }): Promise<ClinicConfig>;
  /** `draft: true` saves without publishing. */
  publishAnnouncement(a: Omit<Announcement, 'id' | 'status'>, opts?: { draft?: boolean }): Promise<Announcement>;
}

export type { RelationKey };
