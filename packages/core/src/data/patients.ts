import { bi } from '../format';
import type {
  Booking, ConsultationDraft, ConsultationRecord, DoctorQueue, FamilyMember, FollowUp, Patient,
  PastConsultation, QueueEntry, Vitals,
} from '../types';

/* ---------------- The signed-in demo patient and family ---------------- */

export const ME: Patient = {
  id: 'DYH-2026-004812',
  name: { last: 'Dela Cruz', first: 'Juan', middle: 'Santos' },
  displayName: 'Juan S. Dela Cruz',
  birthday: '1981-03-14',
  age: 45,
  sex: 'M',
  mobile: '0917 555 0142',
  city: 'Caloocan City',
  bloodType: 'O+',
  allergies: [],
  priority: null,
  emergencyContact: { name: 'Maria Dela Cruz', mobile: '0918 222 0193', relation: 'spouse' },
};

export const FAMILY: FamilyMember[] = [
  { patientId: 'DYH-2026-004812', displayName: 'Juan Dela Cruz', relation: 'self', age: 45, priority: null },
  { patientId: 'DYH-2026-005120', displayName: 'Sofia Dela Cruz', relation: 'child', age: 7, priority: null },
  { patientId: 'DYH-2025-001933', displayName: 'Rosario Dela Cruz', relation: 'mother', age: 72, priority: 'senior' },
];

export const MY_BOOKINGS: Booking[] = [
  { id: 'BK-261030-018', patientId: 'DYH-2026-004812', patientName: 'Juan Dela Cruz', doctorId: 'd1', date: '2026-10-30', type: 'walkin', status: 'arrived', queueNumber: 'IM-018' },
  { id: 'BK-261105-007', patientId: 'DYH-2026-005120', patientName: 'Sofia Dela Cruz', doctorId: 'd2', date: '2026-11-05', type: 'online', status: 'booked' },
  { id: 'BK-261112-004', patientId: 'DYH-2026-004812', patientName: 'Juan Dela Cruz', doctorId: 'd1', date: '2026-11-12', type: 'online', status: 'booked', isFollowUp: true },
  { id: 'BK-261119-009', patientId: 'DYH-2025-001933', patientName: 'Rosario Dela Cruz', doctorId: 'd4', date: '2026-11-19', type: 'online', status: 'confirmed' },
];

export const MY_CONSULTATIONS: PastConsultation[] = [
  { id: 'c0', doctorId: 'd1', type: 'online', date: '2026-10-12', status: 'done' },
  { id: 'c1', doctorId: 'd5', type: 'walkin', date: '2026-09-02', status: 'done' },
  { id: 'c2', doctorId: 'd1', type: 'online', date: '2026-06-18', status: 'done' },
  { id: 'c3', doctorId: 'd2', type: 'online', date: '2026-11-05', status: 'booked' },
];

/** Juan's own medical history (Patient App → My Records). */
export const MY_RECORDS: ConsultationRecord[] = [
  {
    id: 'r-4812-3', patientId: 'DYH-2026-004812', date: '2026-10-12', doctorId: 'd1', doctorName: 'Dr. Maria Santos', type: 'online',
    diagnoses: [bi('Altapresyon (Essential Hypertension), Stage 1', 'Essential Hypertension, Stage 1')],
    findings: bi('BP 146/92 mmHg, HR 84. Walang pananakit ng dibdib. Paminsan-minsang sakit ng ulo sa umaga.', 'BP 146/92 mmHg, HR 84. No chest pain. Occasional morning headaches.'),
    prescriptions: [{ medicine: 'Amlodipine 5 mg', intake: bi('1 tableta tuwing umaga (30 araw)', '1 tablet every morning (30 days)') }],
    labs: ['Complete Blood Count', 'Lipid Profile', 'Fasting Blood Sugar'],
    vitals: { bp: '146/92', hr: 84, temp: '36.7', rr: 16, o2: 98, wt: 78, ht: 170 },
    notes: bi('Bawasan ang alat sa pagkain. Bumalik pagkatapos ng 1 buwan dala ang resulta ng laboratoryo.', 'Reduce salt intake. Return after 1 month with laboratory results.'),
    addendum: { date: '2026-10-14', authorDoctorId: 'd1', text: bi('Nasuri ang Lipid Profile: LDL 148 mg/dL. Idinagdag ang payo sa pagbabago ng pamumuhay.', 'Lipid Profile reviewed: LDL 148 mg/dL. Lifestyle modification counseling added.') },
    signed: true, integrityHash: '0x9f3c…a71e',
  },
  {
    id: 'r-4812-2', patientId: 'DYH-2026-004812', date: '2026-09-02', doctorId: 'd5', doctorName: 'Dr. Liza Mendoza', type: 'walkin',
    diagnoses: [bi('Acute Pharyngitis (Pamamaga ng Lalamunan)', 'Acute Pharyngitis')],
    findings: bi('Namumulang lalamunan, walang nana. Temperatura 37.8°C.', 'Erythematous pharynx, no exudates. Temperature 37.8°C.'),
    prescriptions: [
      { medicine: 'Paracetamol 500 mg', intake: bi('1 tableta kada 6 oras kung may lagnat', '1 tablet every 6 hours if with fever') },
      { medicine: 'Lozenges', intake: bi('kung kailangan', 'as needed') },
    ],
    labs: [],
    notes: bi('Uminom ng maraming tubig. Bumalik kung lumala sa loob ng 5 araw.', 'Increase fluid intake. Return if symptoms worsen within 5 days.'),
    signed: true,
  },
  {
    id: 'r-4812-1', patientId: 'DYH-2026-004812', date: '2026-06-18', doctorId: 'd1', doctorName: 'Dr. Maria Santos', type: 'online',
    diagnoses: [bi('Taunang Pagsusuri — Normal', 'Annual Physical Examination — Normal')],
    findings: bi('Normal ang pisikal na pagsusuri. BP 132/86 mmHg.', 'Normal physical examination. BP 132/86 mmHg.'),
    prescriptions: [], labs: ['Urinalysis', 'Chest X-ray PA'],
    vitals: { bp: '132/86', hr: 78, temp: '36.5', rr: 16, o2: 99, wt: 77, ht: 170 },
    notes: bi('Taunang check-up. Bantayan ang BP sa bahay.', 'Annual check-up. Monitor BP at home.'),
    signed: true,
  },
];

/* ---------------- Doctor-side patients (Dr. Maria Santos) ---------------- */

export const DOCTOR_PATIENTS: Patient[] = [
  { id: 'DYH-2024-000233', name: { last: 'Bautista', first: 'Lourdes' }, displayName: 'Lourdes Bautista', birthday: '1958-05-02', age: 68, sex: 'F', priority: 'senior', lastVisit: '2026-10-30', bloodType: 'O+', allergies: ['Penicillin'], visits: 6, mobile: '0918 772 1290', city: 'Quezon City' },
  { id: 'DYH-2025-003310', name: { last: 'Navarro', first: 'Ernesto' }, displayName: 'Ernesto Navarro', birthday: '1966-11-23', age: 59, sex: 'M', priority: 'pwd', lastVisit: '2026-09-18', bloodType: 'A+', allergies: [], visits: 4, mobile: '0921 448 3302', city: 'Malabon City' },
  { id: 'DYH-2026-002104', name: { last: 'Tolentino', first: 'Grace' }, displayName: 'Grace Tolentino', birthday: '1990-02-09', age: 36, sex: 'F', priority: null, lastVisit: '2026-10-16', bloodType: 'B+', allergies: ['Sulfa'], visits: 3, mobile: '0905 117 8821', city: 'Caloocan City' },
  { id: 'DYH-2026-004812', name: { last: 'Dela Cruz', first: 'Juan', middle: 'Santos' }, displayName: 'Juan Dela Cruz', birthday: '1981-03-14', age: 45, sex: 'M', priority: null, lastVisit: '2026-10-12', bloodType: 'O+', allergies: [], visits: 3, mobile: '0917 555 0142', city: 'Caloocan City' },
  { id: 'DYH-2026-004901', name: { last: 'Salazar', first: 'Ricardo' }, displayName: 'Ricardo Salazar', birthday: '1974-01-08', age: 52, sex: 'M', priority: null, lastVisit: '2026-10-02', bloodType: 'AB+', allergies: [], visits: 2, mobile: '0919 330 1201', city: 'Caloocan City' },
  { id: 'DYH-2025-000877', name: { last: 'Aquino', first: 'Maricel' }, displayName: 'Maricel Aquino', birthday: '1985-09-17', age: 41, sex: 'F', priority: null, lastVisit: '2026-09-25', bloodType: 'A-', allergies: ['Aspirin'], visits: 5, mobile: '0919 204 5512', city: 'Caloocan City' },
  { id: 'DYH-2023-000412', name: { last: 'Manalo', first: 'Felipe' }, displayName: 'Felipe Manalo', birthday: '1950-06-30', age: 76, sex: 'M', priority: 'senior', lastVisit: '2026-08-30', bloodType: 'O-', allergies: [], visits: 9, mobile: '0927 330 1145', city: 'Valenzuela City' },
];

/** Master-list demographics (Admin → Master List → Patients). */
export const MASTER_PATIENTS = [
  ...DOCTOR_PATIENTS.filter((p) => p.id !== 'DYH-2026-004901'),
  { ...DOCTOR_PATIENTS[0], id: 'DYH-2026-005120', displayName: 'Sofia Dela Cruz', birthday: '2019-08-11', age: 7, sex: 'F' as const, bloodType: 'A+' as const, mobile: '0917 555 0142', city: 'Caloocan City', priority: null },
];

/** Medical history shown in the Doctor App (same timeline for every demo patient). */
export const DOCTOR_HISTORY: ConsultationRecord[] = [
  {
    id: 'h1', patientId: '*', date: '2026-09-22', doctorId: 'd1', doctorName: 'Dr. Maria Santos', type: 'online',
    title: bi('Balik-konsulta: Diabetes', 'Follow-up: Diabetes'),
    diagnoses: [bi('Type 2 Diabetes Mellitus — kontrolado', 'Type 2 Diabetes Mellitus — controlled')],
    findings: bi('FBS 118 mg/dL, BP 132/84, HR 78. Walang pamamaga sa paa. Maayos ang pag-inom ng gamot.', 'FBS 118 mg/dL, BP 132/84, HR 78. No pedal edema. Good medication compliance.'),
    prescriptions: [
      { medicine: 'Metformin 500 mg', intake: bi('2x/araw pagkatapos kumain (30 araw)', 'Twice a day after meals (30 days)') },
      { medicine: 'Atorvastatin 20 mg', intake: bi('1x/araw bago matulog (30 araw)', 'Once a day at bedtime (30 days)') },
    ],
    labs: ['HbA1c', 'Lipid Profile'], vitals: { bp: '132/84', hr: 78, temp: '36.7', rr: 16, o2: 98, wt: 63, ht: 155 },
    notes: bi('Ituloy ang diyeta at ehersisyo. Bumalik pagkatapos ng 3 buwan.', 'Continue diet and exercise. Return in 3 months.'),
    addendum: { date: '2026-09-24', authorDoctorId: 'd1', text: bi('HbA1c 6.8% — ituloy ang kasalukuyang gamot.', 'HbA1c 6.8% — continue current medication.') },
    signed: true,
  },
  {
    id: 'h2', patientId: '*', date: '2026-07-10', doctorId: 'd6', doctorName: 'Dr. Paolo Garcia', type: 'walkin',
    title: bi('Pananakit ng tuhod', 'Knee pain'),
    diagnoses: [bi('Osteoarthritis, magkabilang tuhod', 'Osteoarthritis, both knees')],
    findings: bi('Pananakit ng magkabilang tuhod lalo na sa pag-akyat ng hagdan. May crepitus. Walang pamamaga.', 'Bilateral knee pain, worse on climbing stairs. Crepitus present. No effusion.'),
    prescriptions: [
      { medicine: 'Celecoxib 200 mg', intake: bi('1x/araw pagkatapos kumain (14 araw)', 'Once a day after meals (14 days)') },
      { medicine: 'Glucosamine 1500 mg', intake: bi('1x/araw (30 araw)', 'Once a day (30 days)') },
    ],
    labs: ['Knee X-ray (AP/Lateral)'], vitals: { bp: '138/86', hr: 80, temp: '36.6', rr: 16, o2: 98, wt: 64, ht: 155 },
    notes: bi('Physical therapy 2x kada linggo. Iwasan ang matagal na pagtayo.', 'Physical therapy twice weekly. Avoid prolonged standing.'),
    signed: true,
  },
  {
    id: 'h3', patientId: '*', date: '2026-04-03', doctorId: 'd4', doctorName: 'Dr. Ramon Dela Paz', type: 'online',
    title: bi('Pagsusuri sa puso', 'Cardiac evaluation'),
    diagnoses: [bi('Altapresyon, Stage 2', 'Hypertension, Stage 2')],
    findings: bi('BP 162/98, HR 90. Normal ang tunog ng puso. ECG: Left ventricular hypertrophy.', 'BP 162/98, HR 90. Normal heart sounds. ECG: Left ventricular hypertrophy.'),
    prescriptions: [{ medicine: 'Losartan 50 mg', intake: bi('1x/araw sa umaga (30 araw)', 'Once a day in the morning (30 days)') }],
    labs: ['ECG', '2D Echo', 'Serum Creatinine'], vitals: { bp: '162/98', hr: 90, temp: '36.9', rr: 18, o2: 97, wt: 65, ht: 155 },
    notes: bi('Bantayan ang BP araw-araw. Bawasan ang alat.', 'Monitor BP daily. Reduce salt intake.'),
    signed: true,
  },
];

/* ---------------- Live queues (today) ---------------- */

const q = (number: string, patientName: string, type: 'online' | 'walkin', priority: 'senior' | 'pwd' | null, patientId: string, extra: Partial<QueueEntry> = {}): QueueEntry => ({ number, patientName, type, priority, patientId, ...extra });

export const QUEUES: Record<string, DoctorQueue> = {
  d1: {
    doctorId: 'd1',
    serving: q('IM-015', 'Lourdes Bautista', 'online', 'senior', 'DYH-2024-000233', { scheduledLabel: '9:00 AM', arrivedAt: '8:41 AM' }),
    waiting: [
      q('IM-016', 'Ernesto Navarro', 'walkin', 'pwd', 'DYH-2025-003310'),
      q('IM-017', 'Grace Tolentino', 'online', null, 'DYH-2026-002104', { scheduledLabel: '9:30 AM', arrivedAt: '9:02 AM' }),
      q('IM-018', 'Juan Dela Cruz', 'walkin', null, 'DYH-2026-004812', { arrivedAt: '7:42 AM' }),
      q('IM-019', 'Ricardo Salazar', 'walkin', null, 'DYH-2026-004901'),
      q('IM-020', 'Maricel Aquino', 'online', null, 'DYH-2025-000877', { scheduledLabel: '8:30 AM', arrivedAt: '9:48 AM' }),
    ],
    skipped: [q('IM-014', 'Benjie Ocampo', 'walkin', null, 'DYH-2026-004455')],
    doneCount: 12,
    expected: [
      { bookingId: 'BK-261030-021', patientId: 'DYH-2025-001190', patientName: 'Dante Pascual', priority: null, chiefComplaint: bi('Sakit ng ulo at pagkahilo', 'Headache and dizziness') },
      { bookingId: 'BK-261030-024', patientId: 'DYH-2026-004813', patientName: 'Miguel Dela Cruz', priority: null, bookedBy: { name: 'Juan Dela Cruz', relation: 'child' }, chiefComplaint: bi('Ubo at sipon', 'Cough and colds') },
      { bookingId: 'BK-261030-026', patientId: 'DYH-2024-000511', patientName: 'Imelda Ramos', priority: 'senior', chiefComplaint: bi('Balik-konsulta (in-book ng doktor)', 'Follow-up (booked by doctor)') },
    ],
  },
  d2: {
    doctorId: 'd2',
    serving: q('PD-008', 'Liam Soriano', 'online', null, 'DYH-2026-003870', { scheduledLabel: '2:00 PM' }),
    waiting: [
      q('PD-009', 'Althea Ramos', 'walkin', null, 'DYH-2026-004002'),
      q('PD-010', 'Sofia Dela Cruz', 'online', null, 'DYH-2026-005120', { scheduledLabel: '2:30 PM' }),
      q('PD-011', 'Miguel Castro', 'walkin', null, 'DYH-2026-004950'),
    ],
    skipped: [],
    doneCount: 7,
    expected: [{ bookingId: 'BK-261030-031', patientId: 'DYH-2026-003300', patientName: 'Andrea Lim', priority: null, bookedBy: { name: 'Rosa Lim', relation: 'child' }, chiefComplaint: bi('Lagnat', 'Fever') }],
  },
  d4: {
    doctorId: 'd4',
    serving: null,
    waiting: [
      q('CA-005', 'Felipe Manalo', 'online', 'senior', 'DYH-2023-000412', { scheduledLabel: '11:00 AM' }),
      q('CA-006', 'Teresita Gomez', 'walkin', 'senior', 'DYH-2024-001288'),
      q('CA-007', 'Arnel Valdez', 'walkin', null, 'DYH-2026-004970'),
    ],
    skipped: [],
    doneCount: 4,
    expected: [{ bookingId: 'BK-261030-040', patientId: 'DYH-2023-000777', patientName: 'Rodrigo Santos', priority: 'senior', chiefComplaint: bi('Pananakit ng dibdib', 'Chest pain') }],
  },
};

/** Vitals recorded today by the secretary, keyed by queue number. */
export const TODAY_VITALS: Record<string, Vitals> = {
  'IM-015': { bp: '150/94', hr: 88, temp: '36.8', rr: 18, o2: 97, wt: 62, ht: 155, chiefComplaint: bi('Pagkahilo tuwing umaga', 'Morning dizziness'), recordedAt: '9:05 AM', recordedBy: 'Carla Ramos' },
  'IM-016': { bp: '128/82', hr: 76, temp: '36.6', rr: 16, o2: 98, wt: 70, ht: 168, recordedAt: '9:12 AM', recordedBy: 'Carla Ramos' },
  'PD-008': { bp: '100/65', hr: 96, temp: '37.9', rr: 22, o2: 98, wt: 14, ht: 96, chiefComplaint: bi('Lagnat at ubo', 'Fever and cough'), recordedAt: '1:55 PM', recordedBy: 'Carla Ramos' },
};

export const DRAFTS: ConsultationDraft[] = [
  { patientId: 'DYH-2024-000233', preparedBy: 'Carla Ramos', preparedAt: '9:10 AM', source: 'delegated', mode: 'text' },
  { patientId: 'DYH-2025-003310', preparedBy: 'Carla Ramos', preparedAt: '10:02 AM', source: 'delegated', mode: 'photo', followUp: { date: '2026-11-13', purpose: bi('Suriin ang BP at resulta ng HbA1c', 'Review BP and HbA1c results') } },
];

export const UPCOMING_FOLLOW_UPS: FollowUp[] = [
  { patientId: 'DYH-2026-002104', due: '2026-11-02', queueNumber: 'IM-006' },
  { patientId: 'DYH-2025-003310', due: '2026-11-04', queueNumber: 'IM-003' },
  { patientId: 'DYH-2026-004901', due: '2026-11-06', queueNumber: 'IM-008' },
  { patientId: 'DYH-2025-000877', due: '2026-11-09', queueNumber: 'IM-002' },
  { patientId: 'DYH-2026-004812', due: '2026-11-12', queueNumber: 'IM-004' },
];

/** Patients the doctor delegated to the secretary (Findings Draft). */
export const DELEGATED_DONE: Record<string, { name: string; number: string; time: string; delegated: boolean; note?: { tl: string; en: string } }[]> = {
  d1: [
    { name: 'Teodoro Ramos', number: 'IM-013', time: '9:05 AM', delegated: true, note: bi('Nasa papel ang reseta. May balik-konsulta sa loob ng 2 linggo para sa resulta ng HbA1c.', 'Prescription is on paper. Follow-up in 2 weeks for HbA1c results.') },
    { name: 'Rodel Cruz', number: 'IM-012', time: '8:48 AM', delegated: true, note: bi('Text na lang, maikli ang tala ko. Walang balik-konsulta.', 'Just type it, my notes are short. No follow-up.') },
    { name: 'Ana Lim', number: 'IM-011', time: '8:30 AM', delegated: false },
  ],
  d2: [
    { name: 'Kyle Santos', number: 'PD-007', time: '1:52 PM', delegated: true, note: bi('Kunan ang form; may bakuna sa susunod na buwan.', 'Capture the form; vaccine due next month.') },
    { name: 'Bea Ramos', number: 'PD-006', time: '1:35 PM', delegated: false },
  ],
  d4: [],
};
