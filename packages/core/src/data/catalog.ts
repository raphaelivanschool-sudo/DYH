import { bi } from '../format';
import type { BloodType, Localized, RelationKey } from '../types';

export type CatalogItem = { id: string; label: string };

export const DIAGNOSES: CatalogItem[] = [
  ['htn', 'Essential Hypertension'], ['dm', 'Type 2 Diabetes Mellitus'], ['urti', 'Upper Respiratory Tract Infection'],
  ['dys', 'Dyslipidemia'], ['gerd', 'GERD'], ['ast', 'Bronchial Asthma'], ['uti', 'Urinary Tract Infection'],
  ['oa', 'Osteoarthritis'], ['ckd', 'Chronic Kidney Disease'], ['anem', 'Iron Deficiency Anemia'], ['copd', 'COPD'],
  ['cap', 'Community-acquired Pneumonia'], ['ige', 'Acute Gastroenteritis'], ['mig', 'Migraine'], ['hypo', 'Hypothyroidism'],
].map(([id, label]) => ({ id, label }));

export const MEDICINES: CatalogItem[] = [
  ['aml', 'Amlodipine 5 mg'], ['met', 'Metformin 500 mg'], ['los', 'Losartan 50 mg'], ['ato', 'Atorvastatin 20 mg'],
  ['par', 'Paracetamol 500 mg'], ['amo', 'Amoxicillin 500 mg'], ['ome', 'Omeprazole 20 mg'], ['sal', 'Salbutamol inhaler'],
  ['cet', 'Cetirizine 10 mg'], ['fer', 'Ferrous sulfate 325 mg'], ['clo', 'Clopidogrel 75 mg'], ['asp', 'Aspirin 80 mg'],
  ['ibu', 'Ibuprofen 400 mg'], ['azi', 'Azithromycin 500 mg'], ['lev', 'Levothyroxine 50 mcg'],
].map(([id, label]) => ({ id, label }));

export const LABS: CatalogItem[] = [
  ['cbc', 'CBC'], ['lipid', 'Lipid Profile'], ['hba1c', 'HbA1c'], ['ua', 'Urinalysis'], ['ecg', 'ECG'], ['fbs', 'FBS'],
  ['crea', 'Serum Creatinine'], ['cxr', 'Chest X-ray'], ['sgpt', 'SGPT'], ['tsh', 'TSH'], ['bun', 'BUN'],
  ['k', 'Serum Potassium'], ['uric', 'Uric Acid'], ['fecal', 'Fecalysis'], ['echo', '2D Echo'],
].map(([id, label]) => ({ id, label }));

export const INTAKE_PRESETS: { id: string; label: Localized }[] = [
  { id: 'od', label: bi('1x/araw (OD)', '1x/day (OD)') },
  { id: 'bid', label: bi('2x/araw (BID)', '2x/day (BID)') },
  { id: 'tid', label: bi('3x/araw (TID)', '3x/day (TID)') },
  { id: 'qid', label: bi('4x/araw (QID)', '4x/day (QID)') },
  { id: 'hs', label: bi('Bago matulog (HS)', 'Bedtime (HS)') },
  { id: 'prn', label: bi('Kung kailangan (PRN)', 'As needed (PRN)') },
];

export const RELATIONS: { id: RelationKey; label: Localized }[] = [
  { id: 'spouse', label: bi('Asawa', 'Spouse') },
  { id: 'parent', label: bi('Magulang', 'Parent') },
  { id: 'child', label: bi('Anak', 'Child') },
  { id: 'sibling', label: bi('Kapatid', 'Sibling') },
  { id: 'guardian', label: bi('Tagapag-alaga (Guardian)', 'Guardian') },
  { id: 'friend', label: bi('Kaibigan', 'Friend') },
];
export const RELATION_LABEL: Record<RelationKey, Localized> = {
  self: bi('Ikaw (May-ari ng Account)', 'You (Account Owner)'),
  mother: bi('Ina', 'Mother'),
  father: bi('Ama', 'Father'),
  ...Object.fromEntries(RELATIONS.map((r) => [r.id, r.label])),
} as Record<RelationKey, Localized>;

export const BLOOD_TYPES: { id: BloodType; label: string }[] = [
  { id: 'A+', label: 'A+' }, { id: 'A-', label: 'A−' }, { id: 'B+', label: 'B+' }, { id: 'B-', label: 'B−' },
  { id: 'AB+', label: 'AB+' }, { id: 'AB-', label: 'AB−' }, { id: 'O+', label: 'O+' }, { id: 'O-', label: 'O−' },
  { id: 'unknown', label: 'Unknown' },
];

export const SUFFIXES = ['', 'Jr.', 'Sr.', 'II', 'III', 'IV'];

export const BLOCK_REASONS: { id: string; label: Localized }[] = [
  { id: 'leave', label: bi('Bakasyon / Leave', 'Leave') },
  { id: 'sick', label: bi('May sakit', 'Sick') },
  { id: 'seminar', label: bi('Seminar / Kumperensya', 'Seminar / Conference') },
  { id: 'emerg', label: bi('Emergency', 'Emergency') },
  { id: 'personal', label: bi('Personal', 'Personal') },
  { id: 'other', label: bi('Iba pa (tukuyin)', 'Others (specify)') },
];

/**
 * Philippine Standard Geographic Code (PSGC) cascade — sample subset.
 * In production this is served by the backend from the official PSA dataset.
 */
export interface PsgcRegion { code: string; psgc: string; name: string; provinces: PsgcProvince[] }
export interface PsgcProvince { code: string; psgc: string; name: string; cities: PsgcCity[] }
export interface PsgcCity { code: string; name: string; barangays: string[] }

export const PSGC: PsgcRegion[] = [
  {
    code: 'ncr', psgc: '1300000000', name: 'NCR — National Capital Region',
    provinces: [{
      code: 'mm', psgc: '1300000000 (NCR)', name: 'Metro Manila',
      cities: [
        { code: 'cal', name: 'Caloocan City', barangays: ['Brgy. 171 (Bagumbong)', 'Brgy. 174 (Camarin)', 'Brgy. 176 (Bagong Silang)', 'Brgy. 178 (Camarin)', 'Brgy. 186 (Tala)', 'Brgy. 188 (Tala)'] },
        { code: 'qc', name: 'Quezon City', barangays: ['Bagong Pag-asa', 'Batasan Hills', 'Commonwealth', 'Fairview', 'Novaliches Proper', 'Payatas'] },
        { code: 'mal', name: 'City of Malabon', barangays: ['Catmon', 'Longos', 'Potrero', 'Tinajeros', 'Tonsuya'] },
        { code: 'val', name: 'City of Valenzuela', barangays: ['Bignay', 'Karuhatan', 'Malinta', 'Marulas', 'Ugong'] },
        { code: 'nav', name: 'City of Navotas', barangays: ['Bangculasi', 'Daanghari', 'San Jose', 'Tangos North'] },
        { code: 'mnl', name: 'City of Manila', barangays: ['Barangay 1 (Tondo)', 'Barangay 105 (Tondo)', 'Barangay 395 (Sampaloc)', 'Barangay 649 (Port Area)'] },
      ],
    }],
  },
  {
    code: 'r3', psgc: '0300000000', name: 'Region III — Central Luzon',
    provinces: [
      { code: 'bul', psgc: '0301400000', name: 'Bulacan', cities: [
        { code: 'sjdm', name: 'City of San Jose del Monte', barangays: ['Graceville', 'Kaypian', 'Muzon', 'Tungkong Mangga'] },
        { code: 'mey', name: 'City of Meycauayan', barangays: ['Bahay Pare', 'Calvario', 'Malhacan', 'Saluysoy'] },
        { code: 'mar', name: 'Marilao', barangays: ['Abangan Norte', 'Lambakin', 'Loma de Gato', 'Patubig'] },
      ] },
      { code: 'pam', psgc: '0305400000', name: 'Pampanga', cities: [
        { code: 'csf', name: 'City of San Fernando', barangays: ['Dolores', 'Del Pilar', 'San Agustin', 'Sindalan'] },
        { code: 'ang', name: 'Angeles City', barangays: ['Balibago', 'Cutcut', 'Pampang', 'Sto. Rosario'] },
      ] },
    ],
  },
  {
    code: 'r4a', psgc: '0400000000', name: 'Region IV-A — CALABARZON',
    provinces: [
      { code: 'riz', psgc: '0405800000', name: 'Rizal', cities: [
        { code: 'ant', name: 'City of Antipolo', barangays: ['Dela Paz', 'Mambugan', 'San Isidro', 'San Roque'] },
        { code: 'rod', name: 'Rodriguez (Montalban)', barangays: ['Burgos', 'San Jose', 'San Rafael'] },
      ] },
      { code: 'cav', psgc: '0402100000', name: 'Cavite', cities: [
        { code: 'bac', name: 'City of Bacoor', barangays: ['Molino I', 'Molino III', 'Niog', 'Talaba'] },
        { code: 'dsm', name: 'City of Dasmariñas', barangays: ['Burol', 'Paliparan I', 'Salawag', 'Sampaloc I'] },
      ] },
    ],
  },
];
