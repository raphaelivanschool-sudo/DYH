import { useMemo } from 'react';
import { qk, useApi, useApiQuery, useDoctors, useSpecializations } from '@dyh/api';
import { DAY_LONG, DAY_SHORT, MONTH_LONG, MONTH_SHORT, parseISO, weekdayOf, type ISODate } from '@dyh/core';
import { useLang, useLoc } from '@dyh/i18n';
import { useSession } from './store';

export const useClock = () => useApi().clock();
export const useDoctorId = () => useSession((s) => s.doctorId);

/** The signed-in doctor, with specialization name and "Room 214" label. */
export function useMe() {
  const id = useDoctorId();
  const { data: doctors } = useDoctors();
  const { data: specs } = useSpecializations();
  const loc = useLoc();
  const d = doctors?.find((x) => x.id === id);
  const spec = loc(specs?.find((s) => s.id === d?.specializationId)?.name);
  return { doctor: d, spec, first: (d?.name ?? '').replace(/^Dr\.\s*/, '').split(' ')[0] ?? '' };
}

export const usePatients = () => {
  const id = useDoctorId();
  return useApiQuery(qk.doctorPatients(id), (a) => a.getDoctorPatients(id));
};
export const usePatient = (pid: string | null) => {
  const { data } = usePatients();
  return data?.find((p) => p.id === pid);
};
export const useDrafts = () => {
  const id = useDoctorId();
  return useApiQuery(qk.drafts(id), (a) => a.getDrafts(id));
};
export const useFollowUps = () => {
  const id = useDoctorId();
  return useApiQuery(qk.followUps(id), (a) => a.getFollowUps(id));
};
export const useHistory = (pid: string | null) => useApiQuery(qk.history(pid ?? '-'), (a) => a.getPatientHistory(pid!), { enabled: !!pid });

/** Drafts still open: unsigned, or signed with a follow-up left to confirm. */
export function useOpenDrafts() {
  const { data } = useDrafts();
  return useMemo(() => (data ?? []).filter((d) => !d.signed || (d.followUp && !d.followUpDone)), [data]);
}
export function useDraftFor(pid: string | null) {
  const { data } = useDrafts();
  const d = data?.find((x) => x.patientId === pid);
  return { draft: d && !d.signed ? d : undefined, fuPending: d && d.signed && d.followUp && !d.followUpDone ? d : undefined };
}

/** Queue number for today's vitals lookup (vitals are keyed by queue number). */
export const VITALS_QNO: Record<string, string> = {
  'DYH-2024-000233': 'IM-015',
  'DYH-2025-003310': 'IM-016',
  'DYH-2026-002104': 'IM-017',
  'DYH-2026-004812': 'IM-018',
  'DYH-2026-004901': 'IM-019',
  'DYH-2025-000877': 'IM-020',
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
