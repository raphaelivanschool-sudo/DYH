import { useMemo } from 'react';
import { useApi, useDoctors, useLiveStatus, useSpecializations } from '@dyh/api';
import { DAY_SHORT, MONTH_SHORT, formatHoursRange, parseISO, sortDoctorsForToday, todayState, weekdayOf, type Doctor, type ISODate } from '@dyh/core';
import { useLang, useLoc } from '@dyh/i18n';

export const useClock = () => useApi().clock();

/** Doctors + specialization names + live status, keyed for quick lookup. */
export function useCatalog() {
  const { data: doctors } = useDoctors();
  const { data: specs } = useSpecializations();
  const { data: live } = useLiveStatus();
  const loc = useLoc();
  return useMemo(() => {
    const byId = new Map((doctors ?? []).map((d) => [d.id, d]));
    const specOf = (d?: Doctor) => specs?.find((s) => s.id === d?.specializationId);
    return {
      ready: !!doctors && !!specs,
      doctors: doctors ?? [],
      specs: specs ?? [],
      doctor: (id?: string | null) => (id ? byId.get(id) : undefined),
      specName: (d?: Doctor) => loc(specOf(d)?.name),
      specIcon: (d?: Doctor) => specOf(d)?.icon ?? 'stethoscope',
      live: (id: string) => live?.find((l) => l.doctorId === id),
    };
  }, [doctors, specs, live, loc]);
}

export function useDates() {
  const [lang] = useLang();
  return {
    day: (w: number) => DAY_SHORT[lang][w],
    mon: (m0: number) => MONTH_SHORT[lang][m0],
    /** "Biy, Okt 30" */
    dayDate: (d: ISODate) => {
      const [, m, day] = parseISO(d);
      return `${DAY_SHORT[lang][weekdayOf(d)]}, ${MONTH_SHORT[lang][m]} ${day}`;
    },
    short: (d: ISODate) => {
      const [y, m, day] = parseISO(d);
      return `${MONTH_SHORT[lang][m]} ${day}, ${y}`;
    },
    days: (d: Doctor) => d.clinicDays.map((w) => DAY_SHORT[lang][w]).join(', '),
    hours: (d: Doctor) => formatHoursRange(d.hours),
  };
}

export const useSortedDoctors = (list: Doctor[]) => {
  const { today, hour } = useClock();
  return useMemo(() => sortDoctorsForToday(list, today, hour), [list, today, hour]);
};

export const useTodayState = () => {
  const { today, hour } = useClock();
  return (d: Doctor) => todayState(d, today, hour);
};

export const greetingKey = (hour: number) => (hour < 12 ? 'goodMorning' : hour < 18 ? 'goodAfternoon' : 'goodEvening');
