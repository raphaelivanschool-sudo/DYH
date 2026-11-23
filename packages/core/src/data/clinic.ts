import { bi, seededInt } from '../format';
import type { Doctor, Room, Secretary, Specialization, SpecializationId } from '../types';

/** Demo clock. The sample data is written around this moment (Friday, 10:30 AM). */
export const DEMO_TODAY = '2026-10-30';
export const DEMO_NOW_HOUR = 10.5;

export const SPECIALIZATIONS: Specialization[] = [
  { id: 'im', name: bi('Panloob na Medisina', 'Internal Medicine'), icon: 'stethoscope', services: ['Annual physical exam', 'Pre-employment medical'] },
  { id: 'ped', name: bi('Pediatriya (Pambata)', 'Pediatrics'), icon: 'baby', services: ['Immunization (Bakuna)', 'Newborn check-up'] },
  { id: 'ob', name: bi('OB-Gyne (Kalusugang Pambabae)', 'OB-Gynecology'), icon: 'heart', services: ['Prenatal check-up', 'Pap smear'] },
  { id: 'car', name: bi('Kardyolohiya (Puso)', 'Cardiology'), icon: 'heart-pulse', services: ['ECG reading', 'Cardiac clearance'] },
  { id: 'ent', name: bi('Tainga, Ilong at Lalamunan', 'ENT (Ear, Nose & Throat)'), icon: 'ear', services: ['Ear cleaning', 'Hearing screening'] },
  { id: 'ort', name: bi('Ortopediya (Buto)', 'Orthopedics'), icon: 'bone', services: ['Cast application', 'Joint injection'] },
  { id: 'der', name: bi('Dermatolohiya (Balat)', 'Dermatology'), icon: 'hand', services: ['Skin biopsy', 'Wart removal'] },
  { id: 'oph', name: bi('Optalmolohiya (Mata)', 'Ophthalmology'), icon: 'eye', services: ['Visual acuity test', 'Eye refraction'] },
  { id: 'neu', name: bi('Neurolohiya (Utak at Nerbiyos)', 'Neurology'), icon: 'brain', services: ['EEG reading', 'Neuro clearance'] },
  { id: 'pul', name: bi('Pulmonolohiya (Baga)', 'Pulmonology'), icon: 'wind', services: ['Spirometry', 'Nebulization'] },
  { id: 'gas', name: bi('Gastroenterolohiya (Sikmura at Bituka)', 'Gastroenterology'), icon: 'pill', services: ['Endoscopy referral', 'Liver profile review'] },
  { id: 'neph', name: bi('Nephrolohiya (Bato)', 'Nephrology'), icon: 'droplets', services: ['Dialysis consult', 'Renal diet counseling'] },
  { id: 'endo', name: bi('Endokrinolohiya (Diabetes at Thyroid)', 'Endocrinology'), icon: 'syringe', services: ['Diabetes counseling', 'Thyroid review'] },
  { id: 'uro', name: bi('Urolohiya (Daanan ng Ihi)', 'Urology'), icon: 'droplet', services: ['Prostate check', 'Uroflowmetry'] },
  { id: 'psy', name: bi('Saykayatriya (Kalusugang Pangkaisipan)', 'Psychiatry'), icon: 'brain-circuit', services: ['Psychiatric evaluation', 'Counseling'] },
  { id: 'sur', name: bi('Pangkalahatang Operasyon', 'General Surgery'), icon: 'scissors', services: ['Minor surgery', 'Wound care'] },
  { id: 'reh', name: bi('Rehabilitasyon', 'Rehabilitation Medicine'), icon: 'accessibility', services: ['Physical therapy plan', 'Mobility assessment'] },
  { id: 'den', name: bi('Dentistri (Ngipin)', 'Dentistry'), icon: 'smile', services: ['Tooth extraction', 'Oral prophylaxis'] },
];

export const specById = (id: SpecializationId) => SPECIALIZATIONS.find((s) => s.id === id)!;

type DoctorSeed = [id: string, name: string, sp: SpecializationId, room: string, floor: number, days: number[], start: number, end: number, prefix: string];

const SEEDS: DoctorSeed[] = [
  ['d1', 'Dr. Maria Santos', 'im', '204', 2, [1, 3, 5], 8, 12, 'IM'],
  ['d2', 'Dr. Jose Reyes', 'ped', '108', 1, [2, 4, 5], 13, 17, 'PD'],
  ['d3', 'Dr. Ana Villanueva', 'ob', '210', 2, [1, 5], 9, 15, 'OB'],
  ['d4', 'Dr. Ramon Dela Paz', 'car', '301', 3, [3, 5, 6], 10, 14, 'CA'],
  ['d5', 'Dr. Liza Mendoza', 'ent', '115', 1, [2, 4], 8, 12, 'EN'],
  ['d6', 'Dr. Paolo Garcia', 'ort', '120', 1, [1, 3, 5], 13, 18, 'OR'],
  ['d7', 'Dr. Teresa Ong', 'im', '206', 2, [2, 4, 6], 9, 13, 'IO'],
  ['d8', 'Dr. Victor Lim', 'im', '205', 2, [1, 5], 7, 10, 'IL'],
  ['d9', 'Dr. Carmela Diaz', 'ped', '109', 1, [1, 3, 5], 8, 11, 'PC'],
  ['d10', 'Dr. Noel Bautista', 'car', '302', 3, [1, 2, 4], 13, 17, 'CB'],
  ['d11', 'Dr. Grace Uy', 'der', '115', 1, [2, 5], 9, 12, 'DE'],
  ['d12', 'Dr. Albert Cruz', 'oph', '119', 1, [1, 4], 8, 12, 'OP'],
  ['d13', 'Dr. Hazel Santiago', 'neu', '303', 3, [3, 5], 14, 18, 'NE'],
  ['d14', 'Dr. Ricardo Tan', 'pul', '304', 3, [2, 4], 9, 13, 'PU'],
  ['d15', 'Dr. Joy Flores', 'gas', '207', 2, [1, 5], 13, 17, 'GA'],
  ['d16', 'Dr. Mark Villareal', 'neph', '208', 2, [3, 6], 9, 12, 'NP'],
  ['d17', 'Dr. Lorna Pascual', 'endo', '209', 2, [2, 5], 7, 9, 'EN'],
  ['d18', 'Dr. Felix Ramos', 'uro', '121', 1, [3, 6], 10, 14, 'UR'],
  ['d19', 'Dr. Bea Aquino', 'psy', '119', 1, [2, 4], 13, 17, 'PS'],
  ['d20', 'Dr. Edgar Morales', 'sur', '122', 1, [1, 3, 5], 9, 15, 'SU'],
  ['d21', 'Dr. Iris Navarro', 'reh', '123', 1, [2, 4], 8, 12, 'RH'],
  ['d22', 'Dr. Paula Gomez', 'den', '124', 1, [1, 3, 5, 6], 9, 16, 'DN'],
];

const CREDENTIALS: Record<string, string[]> = {
  d1: ['MD', 'FPCP'], d2: ['MD', 'FPPS'], d3: ['MD', 'FPOGS'], d4: ['MD', 'FPCC'], d20: ['MD', 'FPCS'],
  d21: ['MD', 'PTRP'], d22: ['DMD'], d12: ['MD', 'DPBO'], d19: ['MD', 'RPsy'],
};

export const CREDENTIAL_OPTIONS = ['MD', 'RN', 'RDN', 'RMT', 'RPh', 'DMD', 'OD', 'PTRP', 'RPsy', 'FPCP', 'FPPS', 'FPOGS', 'FPCC', 'FPCS', 'DPBO'];

const emailOf = (name: string) => {
  const p = name.replace('Dr. ', '').toLowerCase().split(' ');
  return `${p[0][0]}.${p.slice(1).join('')}@dyh.ph`;
};
const mobileOf = (id: string) =>
  `09${seededInt(id + 'm', 10, 99)} ${seededInt(id + 'm2', 100, 999)} ${seededInt(id + 'm3', 1000, 9999)}`;

export const DOCTORS: Doctor[] = SEEDS.map(([id, name, sp, room, floor, days, start, end, prefix]) => ({
  id,
  name,
  specializationId: sp,
  room,
  floor,
  clinicDays: days,
  hours: { start, end },
  queuePrefix: prefix,
  credentials: CREDENTIALS[id] ?? ['MD'],
  email: emailOf(name),
  mobile: mobileOf(id),
  maxPatientsPerDay: 30,
  status: 'active',
}));

export const doctorById = (id: string) => DOCTORS.find((d) => d.id === id);

/** Explicit live values from the prototype; others are derived deterministically. */
export const LIVE_OVERRIDES: Record<string, { serving: string | null; waiting: number }> = {
  d1: { serving: 'IM-015', waiting: 6 },
  d2: { serving: 'PD-008', waiting: 4 },
  d3: { serving: 'OB-011', waiting: 9 },
  d4: { serving: 'CA-004', waiting: 3 },
  d5: { serving: null, waiting: 0 },
  d6: { serving: 'OR-006', waiting: 5 },
};

const EXTRA_ROOMS = ['118', '125', '126', '305', '306', '307'];
const ROOM_CAPACITY: Record<string, number> = { '115': 2, '118': 3, '125': 2 };

export const ROOMS: Room[] = [...new Set([...DOCTORS.map((d) => d.room), ...EXTRA_ROOMS])]
  .sort()
  .map((r) => ({ number: r, floor: Number(r[0]), capacity: ROOM_CAPACITY[r] ?? 1 }));

export const SECRETARIES: Secretary[] = [
  { id: 's1', name: 'Carla Ramos', email: 'c.ramos@dyh.ph', mobile: '0917 284 3381', doctorIds: ['d1', 'd2', 'd4'], createdAt: '2025-03-03', createdBy: 'Admin Delos Reyes', status: 'active' },
  { id: 's2', name: 'Jenny Flores', email: 'j.flores@dyh.ph', mobile: '0918 552 1094', doctorIds: ['d3', 'd6'], createdAt: '2025-07-14', createdBy: 'Patricia Gonzales', status: 'active' },
  { id: 's3', name: 'Mylene Torres', email: 'm.torres@dyh.ph', mobile: '0921 330 7712', doctorIds: ['d5'], createdAt: '2024-11-02', createdBy: 'Admin Delos Reyes', status: 'deactivated' },
  { id: 's4', name: 'Rina Uy', email: 'r.uy@dyh.ph', mobile: '0905 118 2240', doctorIds: ['d7', 'd8', 'd9', 'd10'], createdAt: '2026-01-20', createdBy: 'Admin Delos Reyes', status: 'active' },
];
