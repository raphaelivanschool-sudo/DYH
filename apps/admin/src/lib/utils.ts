import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DAY_SHORT, formatDate, formatHoursRange, type Doctor, type ISODate, type Lang } from '@dyh/core';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

/** "Lun, Miy, Biy" — clinic days in Monday-first order. */
export const daysLabel = (d: Pick<Doctor, 'clinicDays'>, lang: Lang) =>
  [1, 2, 3, 4, 5, 6, 0].filter((x) => d.clinicDays.includes(x)).map((x) => DAY_SHORT[lang][x]).join(', ');

export const scheduleLabel = (d: Doctor, lang: Lang) => `${daysLabel(d, lang)} · ${formatHoursRange(d.hours)}`;

export const shortDate = (d: ISODate, lang: Lang) => formatDate(d, lang, false);

/** Case-insensitive "every word appears somewhere" search used by table search boxes. */
export const matches = (haystack: (string | undefined | null)[], q: string) => {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const h = haystack.filter(Boolean).join(' ').toLowerCase();
  return words.every((w) => h.includes(w));
};

/** Strip "(...)" qualifiers from specialization names for compact labels. */
export const shortSpec = (name: string) => name.split(' (')[0];
