import { bi } from '../format';
import type { Announcement, AppNotification, SystemSettings } from '../types';

/** Announcement content is intentionally NOT translated (business rule). */
export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'a1', icon: 'syringe', colors: ['#1f56b0', '#17325f'],
    title: 'Libreng Flu Vaccine', subtitle: 'Para sa Senior Citizens · Nob 3–14',
    summary: 'Pumunta sa OPD Lobby, 8:00 AM – 3:00 PM. Magdala ng Senior Citizen ID.',
    body:
      "Ang Dr. Yanga's Hospital ay magbibigay ng libreng flu vaccine para sa lahat ng Senior Citizens bilang bahagi ng ating flu season program.\n\n" +
      '**Saan:** OPD Lobby, Ground Floor\n**Oras:** 8:00 AM – 3:00 PM, Lunes hanggang Sabado\n**Dalhin:** Senior Citizen ID at isang valid ID\n\n' +
      'Limitado ang supply bawat araw (150 doses). Unahan ang serbisyo. Hindi kailangang magpa-book sa app.\n\n' +
      'Para sa may lagnat o may sakit sa araw ng bakuna, kumonsulta muna sa doktor.',
    from: '2026-11-03', to: '2026-11-14', audience: 'all', status: 'active',
  },
  {
    id: 'a2', icon: 'calendar-days', colors: ['#0d7a86', '#0f4c5c'],
    title: 'Holiday Schedule Advisory', subtitle: 'Nob 1–2 · Undas',
    summary: 'Sarado ang OPD clinics sa Nob 1 at 2. Bukas ang Emergency Room 24/7.',
    body:
      'Dahil sa Undas, **sarado ang lahat ng OPD clinics** sa Nobyembre 1 (Linggo) at Nobyembre 2 (Lunes).\n\n' +
      'Ang mga online appointment sa mga petsang ito ay awtomatikong ililipat. Makakatanggap kayo ng abiso para pumili ng bagong petsa.\n\n' +
      '**Bukas pa rin ang Emergency Room 24/7.**\n\nBabalik sa normal na operasyon ang OPD sa Nobyembre 3 (Martes).',
    from: '2026-10-28', to: '2026-11-02', audience: 'all', status: 'active',
  },
  {
    id: 'a3', icon: 'heart-pulse', colors: ['#6a3db5', '#3b1f73'],
    title: 'Bagong Cardiology Clinic Hours', subtitle: 'Simula Okt 20',
    summary: 'Bukas na rin ang Cardiology tuwing Sabado, 10:00 AM – 2:00 PM.',
    body: 'Bukas na rin ang Cardiology clinic tuwing **Sabado, 10:00 AM – 2:00 PM** sa Kuwarto 301.',
    from: '2026-10-20', to: '2026-11-30', audience: 'all', status: 'active',
  },
  {
    id: 'a4', icon: 'baby', colors: ['#12805a', '#0b4f38'],
    title: 'Pedia Vaccination Week', subtitle: 'Nob 16–20',
    summary: 'Libreng bakuna para sa mga batang 0–5 taon.',
    body: 'Libreng bakuna para sa mga batang **0–5 taong gulang**. Dalhin ang baby book.',
    from: '2026-11-16', to: '2026-11-20', audience: { clinics: ['ped', 'ob'] }, status: 'pending',
  },
];

export const PATIENT_NOTIFICATIONS: AppNotification[] = [
  { id: 'pn1', icon: 'bell-ring', tone: 'blue', title: bi('Malapit na ang turn mo!', 'Your turn is coming up!'), body: bi('3 pasyente na lang bago ka · Kuwarto 204', '3 patients ahead of you · Room 204'), when: bi('2 min', '2 min'), unread: true },
  { id: 'pn2', icon: 'calendar-check', tone: 'green', title: bi('Matagumpay ang Reserbasyon', 'Booking Successful'), body: bi('Dr. Jose Reyes · Nob 5 · para kay Sofia · Booking QR handa na', 'Dr. Jose Reyes · Nov 5 · for Sofia · Booking QR ready'), when: bi('Kahapon', 'Yesterday'), unread: true },
  { id: 'pn3', icon: 'star', tone: 'amber', title: bi('Markahan ang iyong konsulta', 'Rate your consultation'), body: bi('Tapos na ang konsulta mo kay Dr. Santos.', 'Your consultation with Dr. Santos is complete.'), when: bi('Okt 12', 'Oct 12') },
  { id: 'pn4', icon: 'calendar-check', tone: 'purple', title: bi('Na-book ang Balik-konsulta', 'Follow-up Booked'), body: bi('In-book ka ni Dr. Maria Santos sa Nob 12 · Kuwarto 204. Handa na ang Booking QR.', 'Dr. Maria Santos booked you on Nov 12 · Room 204. Your Booking QR is ready.'), when: bi('Okt 12', 'Oct 12') },
  { id: 'pn5', icon: 'clock-alert', tone: 'amber', title: bi('Mahuhuli ang doktor', 'Doctor is running late'), body: bi('Mahuhuli ng 30 minuto si Dr. Mendoza ngayon.', 'Dr. Mendoza will be 30 minutes late today.'), when: bi('Okt 8', 'Oct 8') },
  { id: 'pn6', icon: 'key-round', tone: 'gray', title: bi('OTP Code', 'OTP Code'), body: bi('Ang iyong code ay 482913.', 'Your code is 482913.'), when: bi('Set 30', 'Sep 30') },
];

export const DOCTOR_NOTIFICATIONS: (AppNotification & { group: 'today' | 'yesterday' | 'earlier' })[] = [
  { id: 'dn1', group: 'today', category: 'queue', icon: 'user-plus', tone: 'blue', title: bi('Bagong pasyente sa pila', 'New patient in queue'), body: bi('IM-020 Maricel Aquino (Walk-in mula sa Kiosk)', 'IM-020 Maricel Aquino (Walk-in from the Kiosk)'), when: bi('10:24 AM', '10:24 AM'), unread: true },
  { id: 'dn2', group: 'today', category: 'record', icon: 'file-clock', tone: 'amber', title: bi('May burador na susuriin', 'Draft ready for review'), body: bi('Ginawa ni Sek. Carla Ramos para kay Lourdes Bautista', 'Prepared by Sec. Carla Ramos for Lourdes Bautista'), when: bi('9:10 AM', '9:10 AM'), unread: true },
  { id: 'dn3', group: 'today', category: 'record', icon: 'calendar-check', tone: 'purple', title: bi('Balik-konsulta ngayong linggo', 'Follow-ups this week'), body: bi('5 pasyente ang awtomatikong naka-book', '5 patients booked automatically'), when: bi('7:00 AM', '7:00 AM'), unread: true },
  { id: 'dn4', group: 'yesterday', category: 'queue', icon: 'calendar-x', tone: 'red', title: bi('Naabisuhan na ang mga pasyente', 'Patients notified'), body: bi('Ipinasa ni Sek. Carla Ramos ang abiso ng Nob 9 sa 4 na pasyente', 'Sec. Carla Ramos forwarded the Nov 9 notice to 4 patients'), when: bi('2:30 PM', '2:30 PM') },
  { id: 'dn5', group: 'earlier', category: 'announcement', icon: 'megaphone', tone: 'gray', title: bi('Anunsyo ng Ospital', 'Hospital Announcement'), body: bi('Holiday Schedule Advisory', 'Holiday Schedule Advisory'), when: bi('Okt 28', 'Oct 28') },
];

export const SECRETARY_NOTIFICATIONS: AppNotification[] = [
  { id: 'sn1', category: 'queue', icon: 'map-pin-check', tone: 'teal', title: bi('Dumating si Grace Tolentino', 'Grace Tolentino arrived'), body: bi('Na-scan ang Booking QR sa Kiosk · IM-017', 'Booking QR scanned at the Kiosk · IM-017'), when: bi('9:02 AM', '9:02 AM'), unread: true },
  { id: 'sn2', category: 'record', icon: 'send', tone: 'blue', title: bi('Ipina-fill ni Dr. Santos', 'Dr. Santos delegated a draft'), body: bi('Teodoro Ramos · IM-013', 'Teodoro Ramos · IM-013'), when: bi('9:05 AM', '9:05 AM'), unread: true },
  { id: 'sn3', category: 'queue', icon: 'calendar-x', tone: 'red', title: bi('Na-block ang petsa', 'Date blocked'), body: bi('Dr. Maria Santos · kailangang abisuhan ang mga pasyente', 'Dr. Maria Santos · patients need to be notified'), when: bi('Kahapon', 'Yesterday'), unread: true },
  { id: 'sn4', category: 'announcement', icon: 'megaphone', tone: 'gray', title: bi('Anunsyo ng Ospital', 'Hospital Announcement'), body: bi('Holiday Schedule Advisory', 'Holiday Schedule Advisory'), when: bi('Okt 28', 'Oct 28'), unread: true },
];

export const DEFAULT_SETTINGS: SystemSettings = {
  scanWindowMinutes: 60,
  kioskSlipSeconds: 20,
  autoLogoutMinutes: { patient: 5, doctor: 10, secretary: 10, admin: 15 },
  bookingWindowDays: 7,
  cancellationCutoffHours: 2,
  reminderDaysBefore: 1,
};

/** AI Guide canned answers (symptom → specialization). Real AI service plugs in later. */
export const AI_GUIDE = {
  quick: [
    { key: 'pedia', q: bi('Saan ang Pediatriya?', 'Where is Pediatrics?') },
    { key: 'santos', q: bi('Kailan si Dr. Santos?', 'When is Dr. Santos available?') },
    { key: 'lab', q: bi('Saan ang Laboratoryo?', 'Where is the Laboratory?') },
    { key: 'em', q: bi('Masakit ang dibdib ko', 'I have chest pain') },
  ],
  answers: {
    hi: bi('Kumusta! Ako ang DYH AI Gabay. Matutulungan kitang hanapin ang tamang klinika, doktor, iskedyul at lokasyon sa ospital.', 'Hello! I am the DYH AI Guide. I can help you find the right clinic, doctor, schedule and location in the hospital.'),
    em: bi('Pumunta agad sa Emergency Room.', 'Go to the Emergency Room immediately.'),
    pedia: bi('Ang **Pediatriya** ay nasa **Unang Palapag (Kuwarto 108–109)**. Bukas ngayon si Dr. Carmela Diaz hanggang 11:00 AM at si Dr. Jose Reyes mula 1:00 PM.', '**Pediatrics** is on the **Ground Floor (Rooms 108–109)**. Dr. Carmela Diaz is open today until 11:00 AM and Dr. Jose Reyes from 1:00 PM.'),
    santos: bi('Si **Dr. Maria Santos** (Panloob na Medisina) ay nasa **Kuwarto 204** tuwing Lun, Miy at Biy, 8:00 AM–12:00 PM. Bukas siya ngayon — Tinatawag: IM-015.', '**Dr. Maria Santos** (Internal Medicine) is in **Room 204** every Mon, Wed and Fri, 8:00 AM–12:00 PM. She is open today — Now Serving: IM-015.'),
    lab: bi('Ang **Laboratoryo** ay nasa Unang Palapag, sa kaliwa ng Pangunahing Lobby, katabi ng Kahera. Bukas 7:00 AM – 5:00 PM.', 'The **Laboratory** is on the Ground Floor, left of the Main Lobby, beside the Cashier. Open 7:00 AM – 5:00 PM.'),
    def: bi('Matutulungan kitang hanapin ang tamang klinika o doktor at ang kanilang iskedyul. Para sa tanong medikal, kumonsulta sa doktor.', 'I can help you find the right clinic or doctor and their schedule. For medical questions, please consult a doctor.'),
  },
} as const;

export type AiGuideKey = keyof typeof AI_GUIDE.answers;

/** Keyword routing used by the mock AI Guide. Emergencies always win. */
export const routeAiQuestion = (q: string): AiGuideKey => {
  const l = q.toLowerCase();
  if (/dibdib|chest|hirap huminga|breath|hininga|nahimatay|unconscious/.test(l)) return 'em';
  if (/pedia|bata/.test(l)) return 'pedia';
  if (/santos|internal|panloob/.test(l)) return 'santos';
  if (/lab/.test(l)) return 'lab';
  return 'def';
};
