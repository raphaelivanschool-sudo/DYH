import { bi, shortHash } from '../format';
import type { AdminAccount, AdminModule, AuditLogEntry, GeneratedReport, Localized, PasswordResetRequest, RatingComment } from '../types';

export const ADMIN_MODULES: { id: AdminModule; icon: string; label: Localized; crud: ('c' | 'u' | 'd')[] }[] = [
  { id: 'dashboard', icon: 'layout-dashboard', label: bi('Dashboard', 'Dashboard'), crud: [] },
  { id: 'analytics', icon: 'sparkles', label: bi('AI Analytics', 'AI Analytics'), crud: [] },
  { id: 'accounts', icon: 'user-cog', label: bi('Mga Account', 'Accounts'), crud: ['c', 'u', 'd'] },
  { id: 'clinics', icon: 'building-2', label: bi('Klinika at Serbisyo', 'Clinics & Services'), crud: ['c', 'u', 'd'] },
  { id: 'rooms', icon: 'door-open', label: bi('Kuwarto at Assignment', 'Rooms & Assignment'), crud: ['c', 'u', 'd'] },
  { id: 'announce', icon: 'megaphone', label: bi('Mga Anunsyo', 'Announcements'), crud: ['c', 'u', 'd'] },
  { id: 'master', icon: 'database', label: bi('Master List', 'Master List'), crud: [] },
  { id: 'reports', icon: 'file-chart-column', label: bi('Mga Ulat', 'Reports'), crud: ['c'] },
  { id: 'ratings', icon: 'star', label: bi('Marka', 'Ratings'), crud: [] },
  { id: 'audit', icon: 'scroll-text', label: bi('Audit Logs', 'Audit Logs'), crud: [] },
  { id: 'settings', icon: 'settings', label: bi('Setting ng Sistema', 'System Settings'), crud: ['u'] },
];

export const ADMINS: AdminAccount[] = [
  { id: 'a1', name: 'Admin Delos Reyes', email: 'admin@dyh.ph', mobile: '0917 100 2001', role: 'super', createdBy: 'System (initial setup)', createdAt: '2024-01-08', permissions: {}, status: 'active' },
  { id: 'a2', name: 'Patricia Gonzales', email: 'p.gonzales@dyh.ph', mobile: '0918 220 4410', role: 'admin', createdBy: 'Admin Delos Reyes', createdAt: '2025-04-02', status: 'active',
    permissions: { dashboard: {}, analytics: {}, accounts: { c: true, u: true }, clinics: { c: true, u: true, d: true }, rooms: { c: true, u: true, d: true }, announce: { c: true, u: true, d: true }, reports: { c: true }, ratings: {} } },
  { id: 'a3', name: 'Kevin Mercado', email: 'k.mercado@dyh.ph', mobile: '0921 554 7123', role: 'admin', createdBy: 'Admin Delos Reyes', createdAt: '2026-06-15', status: 'active',
    permissions: { dashboard: {}, announce: { c: true, u: true }, reports: {}, ratings: {} } },
  { id: 'a4', name: 'Dr. Maria Santos', email: 'm.santos@dyh.ph', mobile: '0956 482 7735', role: 'admin', createdBy: 'Admin Delos Reyes', createdAt: '2026-09-01', status: 'active',
    permissions: { dashboard: {}, analytics: {}, reports: { c: true }, ratings: {} }, doctorId: 'd1', credentials: ['MD', 'FPCP'] },
];

export const PASSWORD_REQUESTS: PasswordResetRequest[] = [
  { id: 'w1', name: 'Dr. Victor Lim', role: 'doctor', email: 'v.lim@dyh.ph', requestedOn: '2026-10-30', time: '9:42 AM', message: 'Nakalimutan ko ang password.', otpVerified: true, status: 'pending' },
  { id: 'w2', name: 'Rina Uy', role: 'secretary', email: 'r.uy@dyh.ph', requestedOn: '2026-10-30', time: '8:15 AM', message: '', otpVerified: true, status: 'pending' },
  { id: 'w3', name: 'Dr. Grace Uy', role: 'doctor', email: 'g.uy@dyh.ph', requestedOn: '2026-10-29', time: '4:50 PM', message: 'Na-lock ang account ko.', otpVerified: true, status: 'pending' },
];

export const GENERATED_REPORTS: GeneratedReport[] = [
  { id: 'r1', scope: 'Dr. Maria Santos', title: bi('Trend ng diyagnosis at bilang ng pasyente kada buwan', 'Monthly diagnosis trend and patient count'), from: '2026-05-01', to: '2026-10-31', generatedOn: '2026-10-30' },
  { id: 'r2', scope: 'Dr. Jose Reyes', title: bi('Bilang ng nabakunahan at follow-up ng mga bata (Q3)', 'Vaccination count and child follow-ups (Q3)'), from: '2026-07-01', to: '2026-09-30', generatedOn: '2026-10-27' },
  { id: 'r3', scope: 'Dr. Ramon Dela Paz', title: bi('Buod ng diyagnosis sa Q3.', 'Q3 diagnosis summary.'), from: '2026-07-01', to: '2026-09-30', generatedOn: '2026-10-21' },
];

const log = (time: string, user: string, role: AuditLogEntry['role'], action: Localized, details: Localized | string): AuditLogEntry =>
  ({ id: shortHash(time + user + (typeof details === 'string' ? details : details.en)), time, user, role, action, details, hash: shortHash(time + user) + '…' });

const ACC = bi('Pagbabago ng Account', 'Account Changes');
const SIGN = bi('Pinirmahan ang Konsulta', 'Consultation Signed');

export const AUDIT_LOGS: AuditLogEntry[] = [
  log('10:28 AM', 'Admin Delos Reyes', 'Admin', ACC, bi('Gumawa ng Admin: Kevin Mercado (Dashboard, Anunsyo, Ulat, Marka)', 'Created Admin: Kevin Mercado (Dashboard, Announcements, Reports, Ratings)')),
  log('10:24 AM', 'Patricia Gonzales', 'Admin', ACC, bi('In-assign ang Kuwarto 119 kay Dr. Bea Aquino (walang conflict)', 'Assigned Room 119 to Dr. Bea Aquino (no conflict)')),
  log('10:22 AM', 'Dr. Maria Santos', 'Doctor', SIGN, bi('Na-verify gamit ang PIN · DYH-2025-000877', 'Verified with PIN · DYH-2025-000877')),
  log('10:20 AM', 'Carla Ramos', 'Secretary', bi('Update ng Pila', 'Queue Update'), bi('IM-014 minarkahang Hindi Sumipot', 'IM-014 marked as No-show')),
  log('10:08 AM', 'Dr. Maria Santos', 'Doctor', bi('Pagtingin ng Rekord', 'Record Viewing'), bi('Binuksan ang rekord ng DYH-2024-000233 (QR)', 'Opened record DYH-2024-000233 (QR)')),
  log('10:05 AM', 'Dr. Maria Santos', 'Doctor', SIGN, 'Save & Sign · DYH-2024-000233'),
  log('9:58 AM', 'Admin Delos Reyes', 'Admin', ACC, bi('In-assign si Carla Ramos → Dr. Ramon Dela Paz', 'Assigned Carla Ramos → Dr. Ramon Dela Paz')),
  log('9:41 AM', 'Dr. Maria Santos', 'Doctor', bi('Pagbabago ng Iskedyul', 'Schedule Changes'), bi('Na-block ang Nob 9 (Seminar) · ipinasa sa sekretarya', 'Blocked Nov 9 (Seminar) · sent to secretary')),
  log('9:30 AM', 'Carla Ramos', 'Secretary', bi('SMS', 'SMS'), bi('Naipasa ang abiso ng Nob 9 sa 4 na pasyente (SMS + App)', 'Forwarded the Nov 9 notice to 4 patients (SMS + App)')),
  log('9:05 AM', 'Carla Ramos', 'Secretary', bi('Vital Signs', 'Vital Signs'), bi('Naitala ang vitals ng IM-015', 'Recorded vitals for IM-015')),
  log('8:30 AM', 'Carla Ramos', 'Secretary', bi('Pag-login', 'User Login'), 'Secretary App'),
  log('8:12 AM', 'Admin Delos Reyes', 'Admin', bi('Aksyong Pang-admin', 'Administrative Action'), bi('Naipadala ang reset link kay Dr. Grace Uy', 'Sent reset link to Dr. Grace Uy')),
];

export const RATING_COMMENTS: RatingComment[] = [
  { stars: 5, text: bi('Napakabait ni Doc at malinaw ang paliwanag.', 'The doctor was very kind and explained clearly.'), doctorName: 'Dr. Maria Santos', date: '2026-10-29' },
  { stars: 3, text: bi('Medyo matagal ang paghihintay pero maayos ang serbisyo.', 'The wait was a bit long but the service was good.'), doctorName: 'Dr. Ana Villanueva', date: '2026-10-28' },
  { stars: 5, text: bi('Nakatulong ang live na pila, hindi na ako naghintay sa labas.', 'The live queue helped, I did not have to wait outside.'), doctorName: 'Dr. Jose Reyes', date: '2026-10-27' },
  { stars: 2, text: bi('Mainit sa waiting area tuwing hapon.', 'The waiting area is hot in the afternoon.'), doctorName: 'Dr. Paolo Garcia', date: '2026-10-26' },
];

/* ---------------- Analytics datasets (served by /analytics endpoints later) ---------------- */

export const DASHBOARD_STATS = {
  updatedAt: '10:30 AM',
  kpis: {
    totalWaiting: { value: 64, clinics: 14, delta: 8 },
    servedToday: { value: 182, deltaPct: 12 },
    avgWaitMin: { value: 23, deltaMin: -4 },
    noShows: { value: 9, delta: 3 },
    onlineShare: { online: 41, walkin: 59, deltaPt: 4 },
    satisfaction: { value: 4.6, delta: 0.1 },
    followUpReturn: { value: 78, deltaPt: 3 },
  },
  perHour: {
    labels: ['7', '8', '9', '10', '11', '12', '1', '2', '3', '4'],
    today: [12, 34, 48, 41, 30, 14, 26, 33, 22, 11],
    yesterday: [10, 30, 44, 45, 26, 12, 22, 29, 18, 9],
  },
  onlineVsWalkin: { total: 246, online: 101, walkin: 145, priority: 38 },
  trend: {
    labels: ['Oct 19', '20', '21', '22', '23', '24', '26', '27', '28', '29', '30', '31', 'Nov 3', '4', '5', '6', '7', '9'],
    actual: [262, 240, 251, 233, 268, 121, 244, 255, 239, 246, 251, null, null, null, null, null, null, null],
    forecast: [null, null, null, null, null, null, null, null, null, null, 251, 128, 270, 258, 262, 249, 275, 236],
  },
  weekCompare: [
    { metric: bi('Kabuuang pasyente', 'Total patients'), now: '1,452', last: '1,318', change: '+10.2%', good: true },
    { metric: bi('Karaniwang paghihintay', 'Average wait'), now: '23 min', last: '27 min', change: '−4 min', good: true },
    { metric: bi('Hindi sumipot', 'No-show rate'), now: '3.6%', last: '4.4%', change: '−0.8 pt', good: true },
    { metric: bi('Online na booking', 'Online bookings'), now: '41%', last: '37%', change: '+4 pt', good: true },
    { metric: bi('Kasiyahan ng pasyente', 'Patient satisfaction'), now: '4.6', last: '4.5', change: '+0.1', good: true },
    { metric: bi('Karaniwang tagal ng konsulta', 'Avg consultation'), now: '13 min', last: '12 min', change: '+1 min', good: false },
  ],
};

export const ANALYTICS = {
  summary: bi(
    'Tumaas ng **10.2%** ang outpatient volume kumpara sa nakaraang panahon, pinangunahan ng **Pediatriya (+14%)** at **Panloob na Medisina (+9%)** dahil sa flu season. Bumaba ang hindi pagsipot sa **3.6%** mula nang ipatupad ang walk-in-only na patakaran. Ang pinaka-abalang oras ay **Lunes at Biyernes, 9–10 AM**, kung saan umaabot sa **38 min** ang paghihintay. Inaasahang aabot sa **~1,568 pasyente** ang susunod na linggo.',
    'Outpatient volume rose **10.2%** vs the previous period, led by **Pediatrics (+14%)** and **Internal Medicine (+9%)** due to flu season. No-shows fell to **3.6%** since the walk-in-only policy. The busiest window is **Monday and Friday, 9–10 AM**, where waits reach **38 min**. Next week is forecast at **~1,568 patients**.',
  ),
  weekly: {
    labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12', 'W13'],
    actual: [1210, 1188, 1260, 1302, 1275, 1330, 1298, 1352, 1420, 1388, 1452, null, null],
    forecast: [null, null, null, null, null, null, null, null, null, null, 1452, 1510, 1568],
  },
  heatHours: ['7', '8', '9', '10', '11', '12', '1', '2', '3', '4'],
  heatDays: [1, 2, 3, 4, 5, 6],
  noShowByDay: [6.1, 3.2, 3.8, 2.9, 4.6, 2.1],
  seasonal: {
    months: [6, 7, 8, 9],
    series: [
      { name: 'URTI', color: '#2d6cdf', data: [120, 135, 168, 212] },
      { name: 'Influenza', color: '#e04a55', data: [40, 52, 78, 121] },
      { name: 'Dengue', color: '#d68a00', data: [22, 48, 61, 30] },
      { name: 'Hypertension', color: '#12a07a', data: [150, 148, 152, 155] },
    ],
  },
  demandCapacity: [['IM', 312, 280], ['PED', 268, 220], ['OB', 201, 210], ['CAR', 154, 160], ['ORT', 160, 150], ['DER', 88, 100]] as [string, number, number][],
  recommendations: [
    { level: 'high' as const, icon: 'users', title: bi('Magdagdag ng isang pediatrician tuwing Martes at Huwebes ng hapon.', 'Add one pediatrician on Tuesday and Thursday afternoons.'), impact: bi('Inaasahang −9 min sa paghihintay sa Pediatriya.', 'Expected −9 min wait in Pediatrics.') },
    { level: 'high' as const, icon: 'clock', title: bi('Buksan ang IM clinic nang 7:30 AM tuwing Lunes at Biyernes.', 'Open IM clinic at 7:30 AM on Mondays and Fridays.'), impact: bi('Mababawasan ang dagsa ng 9–10 AM ng ~18%.', 'Reduces the 9–10 AM peak by ~18%.') },
    { level: 'medium' as const, icon: 'bell', title: bi('Magpadala ng ikalawang paalala 2 oras bago sa mga booking na 5+ araw ang layo.', 'Send a second reminder 2 hours before for bookings made 5+ days ahead.'), impact: bi('Inaasahang −2 pt sa hindi pagsipot.', 'Expected −2 pt no-show rate.') },
    { level: 'medium' as const, icon: 'syringe', title: bi('Palawigin ang flu vaccine drive hanggang Nob 28.', 'Extend the flu vaccine drive to Nov 28.'), impact: bi('Tumataas pa ang Influenza (+55% buwan-buwan).', 'Influenza still rising (+55% month-on-month).') },
    { level: 'low' as const, icon: 'calendar-plus', title: bi('Taasan ang online capacity ng Dermatolohiya mula 20 → 25.', 'Raise Dermatology online capacity from 20 → 25.'), impact: bi('Laging puno ang online slots 3 araw bago.', 'Online slots fill up 3 days ahead.') },
  ],
};

export const RATINGS_STATS = {
  average: 4.6,
  count: 1284,
  surveys: 3402,
  distribution: [[5, 812], [4, 322], [3, 98], [2, 34], [1, 18]] as [number, number][],
  kiosk: { very: 71, ok: 23, bad: 6 },
  survey: [
    { label: bi('Pasilidad', 'Facility'), very: 72, ok: 22, bad: 6 },
    { label: bi('Kalinisan', 'Cleanliness'), very: 64, ok: 28, bad: 8 },
    { label: bi('Serbisyo', 'Service'), very: 78, ok: 18, bad: 4 },
  ],
  trend: { months: [4, 5, 6, 7, 8, 9], rating: [4.3, 4.4, 4.4, 4.5, 4.5, 4.6], verySatisfied: [62, 64, 66, 67, 69, 71] },
  findings: [
    bi('Ang **paghihintay** ang pinakamadalas na reklamo (38% ng negatibong komento), lalo na sa OB-Gyne.', '**Waiting time** is the most common complaint (38% of negative comments), especially in OB-Gyne.'),
    bi('Pinakamababa ang marka sa **Kalinisan** tuwing hapon (2–5 PM) ayon sa Kiosk survey.', '**Cleanliness** scores are lowest in the afternoon (2–5 PM) per the Kiosk survey.'),
    bi('Positibo ang mga komento tungkol sa **live na pila** at malinaw na paliwanag ng doktor.', 'Comments praise the **live queue** and clear doctor explanations.'),
    bi('Tumaas ng 0.3 ang marka ng Pediatriya mula nang magdagdag ng doktor sa umaga.', 'Pediatrics rating rose 0.3 since adding a morning doctor.'),
  ],
  recommendations: [
    { level: 'high' as const, text: bi('Magdagdag ng isang OB-Gyne slot tuwing Biyernes ng umaga.', 'Add an OB-Gyne slot on Friday mornings.') },
    { level: 'medium' as const, text: bi('Magdagdag ng paglilinis ng CR at waiting area tuwing 1:30 PM.', 'Add a restroom and waiting-area cleaning round at 1:30 PM.') },
    { level: 'medium' as const, text: bi('Ipakita ang tantiyang oras ng paghihintay sa Patient App.', 'Show estimated waiting time in the Patient App.') },
    { level: 'low' as const, text: bi('Kilalanin ang mga doktor na may 4.8+ na marka sa buwanang pulong.', 'Recognize doctors rated 4.8+ at the monthly meeting.') },
  ],
};

export const REPORT_SECTIONS: { id: string; icon: string; label: Localized }[] = [
  { id: 'tot', icon: 'users', label: bi('Kabuuang pasyente at trend', 'Total patients & trend') },
  { id: 'type', icon: 'git-compare', label: bi('Online vs Walk-in', 'Online vs Walk-in') },
  { id: 'dx', icon: 'stethoscope', label: bi('Karaniwang diyagnosis', 'Common diagnoses') },
  { id: 'ns', icon: 'user-x', label: bi('Hindi sumipot', 'No-shows') },
  { id: 'fu', icon: 'repeat', label: bi('Pagbalik sa follow-up', 'Follow-up compliance') },
  { id: 'demo', icon: 'users-round', label: bi('Edad at kasarian', 'Age & sex') },
  { id: 'rx', icon: 'pill', label: bi('Pinakamadalas na inireseta', 'Most prescribed') },
];

/** Doctor-facing report dataset (Doctor App → Reports), scaled by the chosen range. */
export const DOCTOR_REPORT = {
  base: { total: 248, online: 104, newPatients: 61, noShows: 11, addenda: 4, followUps: 72, returned: 56, notArrived: 14 },
  rangeFactor: { week: 0.24, month: 1, q: 2.9, custom: 1.6 } as Record<string, number>,
  rangeDates: { week: ['2026-10-26', '2026-10-31'], month: ['2026-10-01', '2026-10-31'], q: ['2026-08-01', '2026-10-31'], custom: ['2026-09-15', '2026-10-31'] } as Record<string, [string, string]>,
  perClinicDay: [[1, 52], [3, 47], [5, 61]] as [number, number][],
  busiestHours: [['8', 34], ['9', 58], ['10', 61], ['11', 49], ['12', 18]] as [string, number][],
  ageGroups: [['0–17', 6], ['18–39', 22], ['40–59', 41], ['60+', 31]] as [string, number][],
  femalePct: 57,
  diagnoses: [['Hypertension', 38], ['Type 2 DM', 27], ['URTI', 18], ['Dyslipidemia', 12], ['Gastritis', 9]] as [string, number][],
  medicines: [['Amlodipine 5 mg', 41], ['Metformin 500 mg', 33], ['Losartan 50 mg', 22], ['Paracetamol 500 mg', 19], ['Atorvastatin 20 mg', 15]] as [string, number][],
  trend: { months: [4, 5, 6, 7, 8, 9], total: [168, 181, 176, 199, 214, 248], online: [64, 70, 69, 82, 91, 104] },
  waitTimes: [[1, 24, 12, 52], [3, 19, 11, 47], [5, 28, 13, 61]] as [number, number, number, number][],
  dxByAge: [['Hypertension', 4, 15, 19], ['Type 2 DM', 2, 12, 13], ['URTI', 9, 6, 3], ['Dyslipidemia', 1, 6, 5]] as [string, number, number, number][],
  labs: [['HbA1c', 29], ['Lipid Profile', 26], ['FBS', 21], ['Serum Creatinine', 14], ['ECG', 11]] as [string, number][],
  volume: { online: [38, 41, 45, 40, 52, 49, 55, 58, 61, 66], walkin: [62, 58, 66, 60, 71, 64, 70, 75, 69, 73] },
};
