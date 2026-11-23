import { useMemo } from 'react';
import { qk, useApi, useApiQuery, useDoctors, useSpecializations } from '@dyh/api';
import { DAY_LONG, DAY_SHORT, MONTH_LONG, MONTH_SHORT, parseISO, weekdayOf, type Doctor, type ISODate } from '@dyh/core';
import { useLang, useLoc } from '@dyh/i18n';
import { useSession } from './store';

export const useClock = () => useApi().clock();
export const useDoctorId = () => useSession((s) => s.doctorId);

/** Assigned doctors with specialization name / icon lookups. */
export function useAssigned() {
  const ids = useSession((s) => s.doctorIds);
  const { data: doctors } = useDoctors();
  const { data: specs } = useSpecializations();
  const loc = useLoc();
  return useMemo(() => {
    const list = ids.map((id) => doctors?.find((d) => d.id === id)).filter(Boolean) as Doctor[];
    const specOf = (d?: Doctor) => specs?.find((s) => s.id === d?.specializationId);
    return { list, specName: (d?: Doctor) => loc(specOf(d)?.name), specIcon: (d?: Doctor) => specOf(d)?.icon ?? 'stethoscope' };
  }, [ids, doctors, specs, loc]);
}

/** The doctor currently selected in the header. */
export function useCurrent() {
  const id = useDoctorId();
  const a = useAssigned();
  const d = a.list.find((x) => x.id === id);
  return { doctor: d, spec: a.specName(d), icon: a.specIcon(d) };
}

export const useDelegated = () => {
  const id = useDoctorId();
  return useApiQuery(qk.delegated(id), (a) => a.getDelegated(id));
};
export const useDrafts = () => {
  const id = useDoctorId();
  return useApiQuery(qk.drafts(id), (a) => a.getDrafts(id));
};
export const usePatients = () => {
  const id = useDoctorId();
  return useApiQuery(qk.doctorPatients(id), (a) => a.getDoctorPatients(id));
};

export function useDates() {
  const [lang] = useLang();
  return {
    lang,
    day: (w: number) => DAY_SHORT[lang][w],
    dayLong: (w: number) => DAY_LONG[lang][w],
    mon: (m0: number) => MONTH_SHORT[lang][m0],
    monLong: (m0: number) => MONTH_LONG[lang][m0],
    /** "Biy, Okt 30" */
    dayDate: (d: ISODate) => {
      const [, m, day] = parseISO(d);
      return `${DAY_SHORT[lang][weekdayOf(d)]}, ${MONTH_SHORT[lang][m]} ${day}`;
    },
    /** "Okt 30, 2026" */
    short: (d: ISODate) => {
      const [y, m, day] = parseISO(d);
      return `${MONTH_SHORT[lang][m]} ${day}, ${y}`;
    },
    /** "Oktubre 30, 2026" */
    long: (d: ISODate) => {
      const [y, m, day] = parseISO(d);
      return `${MONTH_LONG[lang][m]} ${day}, ${y}`;
    },
  };
}
