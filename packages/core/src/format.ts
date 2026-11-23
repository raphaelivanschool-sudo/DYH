import type { ISODate, Lang, Localized } from './types';

/** Shorthand for writing bilingual content: bi('Tagalog', 'English'). */
export const bi = (tl: string, en: string): Localized => ({ tl, en });

/** Pick the right language from Localized content (strings pass through). */
export const loc = (x: Localized | string | undefined | null, lang: Lang): string =>
  x == null ? '' : typeof x === 'string' ? x : x[lang];

export const DAY_SHORT: Record<Lang, string[]> = {
  tl: ['Lin', 'Lun', 'Mar', 'Miy', 'Huw', 'Biy', 'Sab'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};
export const DAY_LONG: Record<Lang, string[]> = {
  tl: ['Linggo', 'Lunes', 'Martes', 'Miyerkules', 'Huwebes', 'Biyernes', 'Sabado'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};
export const MONTH_SHORT: Record<Lang, string[]> = {
  tl: ['Ene', 'Peb', 'Mar', 'Abr', 'May', 'Hun', 'Hul', 'Ago', 'Set', 'Okt', 'Nob', 'Dis'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};
export const MONTH_LONG: Record<Lang, string[]> = {
  tl: ['Enero', 'Pebrero', 'Marso', 'Abril', 'Mayo', 'Hunyo', 'Hulyo', 'Agosto', 'Setyembre', 'Oktubre', 'Nobyembre', 'Disyembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

/* ---------------- ISO date helpers (timezone-safe, no Date parsing quirks) ---------------- */

export const parseISO = (d: ISODate): [number, number, number] => {
  const [y, m, day] = d.split('-').map(Number);
  return [y, m - 1, day];
};
export const toISO = (y: number, m0: number, d: number): ISODate => {
  const dt = new Date(y, m0, d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};
export const dateOf = (d: ISODate) => {
  const [y, m, day] = parseISO(d);
  return new Date(y, m, day);
};
export const weekdayOf = (d: ISODate) => dateOf(d).getDay();
export const addDays = (d: ISODate, n: number): ISODate => {
  const [y, m, day] = parseISO(d);
  return toISO(y, m, day + n);
};
export const compareISO = (a: ISODate, b: ISODate) => (a < b ? -1 : a > b ? 1 : 0);
export const daysInMonth = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate();

/** "Oktubre 30, 2026" / "October 30, 2026" (long) or "Okt 30, 2026" (short). */
export const formatDate = (d: ISODate, lang: Lang, long = true) => {
  const [y, m, day] = parseISO(d);
  return `${(long ? MONTH_LONG : MONTH_SHORT)[lang][m]} ${day}, ${y}`;
};
/** "Biy, Okt 30" / "Fri, Oct 30". */
export const formatDayDate = (d: ISODate, lang: Lang) => {
  const [, m, day] = parseISO(d);
  return `${DAY_SHORT[lang][weekdayOf(d)]}, ${MONTH_SHORT[lang][m]} ${day}`;
};

/** 13 → "1:00 PM". Accepts fractional hours (7.5 → "7:30 AM"). */
export const formatHour = (h: number) => {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
};
/** "08:30" → "8:30 AM". */
export const formatHHmm = (x?: string) => {
  if (!x) return '—';
  const [h, m] = x.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
export const formatHoursRange = (h: { start: number; end: number }) => `${formatHour(h.start)} – ${formatHour(h.end)}`;

/** "0917 555 0142" → "0917 ••• 0142". The registered number is never shown in full. */
export const maskMobile = (m: string) => {
  const digits = m.replace(/\D/g, '');
  const local = digits.startsWith('63') ? '0' + digits.slice(2) : digits;
  return `${local.slice(0, 4)} ••• ${local.slice(-4)}`;
};

export const initials = (name: string) =>
  name
    .replace(/^Dr\.\s*/, '')
    .split(' ')
    .filter(Boolean)
    .map((x) => x[0])
    .slice(0, 2)
    .join('');

export const padNum = (n: number, len = 3) => String(n).padStart(len, '0');

/**
 * Deterministic pseudo-random integer in [a, b] from a seed string.
 * Ported from the prototype so the sample numbers stay identical.
 */
export const seededInt = (seed: string, a: number, b: number) => {
  let x = 7;
  for (const c of seed) x = (x * 31 + c.charCodeAt(0)) % 100003;
  return a + (x % (b - a + 1));
};

/** Tiny non-cryptographic hash, used for the integrity-hash placeholder. */
export const shortHash = (s: string) => '0x' + s.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 0xfffff, 7).toString(16);
