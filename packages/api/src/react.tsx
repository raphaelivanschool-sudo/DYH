import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AppId } from '@dyh/core';
import type { DyhApi } from './contract';

const ApiContext = createContext<DyhApi | null>(null);

/** Query keys in one place so invalidation stays consistent. */
export const qk = {
  doctors: ['doctors'] as const,
  specs: ['specializations'] as const,
  live: ['live'] as const,
  availability: (doctorId: string, noShow: boolean) => ['availability', doctorId, noShow] as const,
  announcements: ['announcements'] as const,
  settings: ['settings'] as const,
  notifications: (app: AppId) => ['notifications', app] as const,
  me: ['me'] as const,
  family: ['family'] as const,
  bookings: ['bookings'] as const,
  myRecords: ['myRecords'] as const,
  consultations: ['consultations'] as const,
  queue: (doctorId: string) => ['queue', doctorId] as const,
  doctorPatients: (doctorId: string) => ['doctorPatients', doctorId] as const,
  history: (patientId: string) => ['history', patientId] as const,
  vitals: ['vitals'] as const,
  drafts: (doctorId: string) => ['drafts', doctorId] as const,
  followUps: (doctorId: string) => ['followUps', doctorId] as const,
  schedule: (doctorId: string) => ['schedule', doctorId] as const,
  admins: ['admins'] as const,
  secretaries: ['secretaries'] as const,
  rooms: ['rooms'] as const,
  pwRequests: ['pwRequests'] as const,
  audit: ['audit'] as const,
  reports: ['reports'] as const,
  ratingComments: ['ratingComments'] as const,
  masterPatients: ['masterPatients'] as const,
  clinics: ['clinics'] as const,
};

/** Maps change topics (mock events / future websocket messages) to stale queries. */
const TOPIC_KEYS: Record<string, readonly (readonly string[])[]> = {
  bookings: [qk.bookings],
  consultations: [qk.consultations],
  family: [qk.family],
  vitals: [qk.vitals],
  records: [['history'], ['drafts']],
  drafts: [['drafts']],
  followups: [['followUps'], ['drafts']],
  settings: [qk.settings],
  rooms: [qk.rooms, qk.doctors],
  audit: [qk.audit],
  doctors: [qk.doctors, qk.rooms, qk.audit],
  accounts: [qk.admins, qk.secretaries, qk.pwRequests, qk.doctors, qk.audit],
  announcements: [qk.announcements],
  clinics: [qk.clinics, qk.specs],
};

export function ApiProvider({ api, children, client }: { api: DyhApi & { subscribe?: (fn: (t: string) => void) => () => void }; children: ReactNode; client?: QueryClient }) {
  const [qc] = useState(() => client ?? new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  useEffect(() => {
    if (!api.subscribe) return;
    return api.subscribe((topic) => {
      const [kind, id] = topic.split(':');
      if (kind === 'queue') {
        void qc.invalidateQueries({ queryKey: qk.queue(id) });
        void qc.invalidateQueries({ queryKey: qk.live });
        return;
      }
      if (kind === 'schedule') {
        void qc.invalidateQueries({ queryKey: qk.schedule(id) });
        void qc.invalidateQueries({ queryKey: ['availability'] });
        return;
      }
      for (const key of TOPIC_KEYS[kind] ?? []) void qc.invalidateQueries({ queryKey: key });
    });
  }, [api, qc]);
  return (
    <ApiContext.Provider value={api}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </ApiContext.Provider>
  );
}

export function useApi(): DyhApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi must be used inside <ApiProvider>');
  return api;
}

type Opts<T> = Omit<UseQueryOptions<T, Error, T, readonly unknown[]>, 'queryKey' | 'queryFn'>;

/** Generic query bound to the API: useApiQuery(qk.doctors, (api) => api.getDoctors()). */
export function useApiQuery<T>(key: readonly unknown[], fn: (api: DyhApi) => Promise<T>, opts?: Opts<T>) {
  const api = useApi();
  return useQuery({ queryKey: key, queryFn: () => fn(api), ...opts });
}

/** Generic mutation bound to the API; invalidates `invalidate` keys on success. */
export function useApiMutation<V, R>(fn: (api: DyhApi, vars: V) => Promise<R>, invalidate: readonly (readonly unknown[])[] = []) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: V) => fn(api, v),
    onSuccess: () => Promise.all(invalidate.map((k) => qc.invalidateQueries({ queryKey: k }))),
  });
}

/* ---------------- Named hooks for the common reads ---------------- */

export const useDoctors = () => useApiQuery(qk.doctors, (a) => a.getDoctors());
export const useSpecializations = () => useApiQuery(qk.specs, (a) => a.getSpecializations(), { staleTime: Infinity });
export const useLiveStatus = () => useApiQuery(qk.live, (a) => a.getLiveStatus(), { refetchInterval: 15_000 });
export const useAnnouncements = () => useApiQuery(qk.announcements, (a) => a.getAnnouncements());
export const useSettings = () => useApiQuery(qk.settings, (a) => a.getSettings());
export const useNotifications = (app: AppId) => useApiQuery(qk.notifications(app), (a) => a.getNotifications(app));
export const useQueue = (doctorId: string) => useApiQuery(qk.queue(doctorId), (a) => a.getQueue(doctorId), { refetchInterval: 10_000 });
export const useTodayVitals = () => useApiQuery(qk.vitals, (a) => a.getTodayVitals());
export const useSchedule = (doctorId: string) => useApiQuery(qk.schedule(doctorId), (a) => a.getSchedule(doctorId));
export const useAvailability = (doctorId: string | null, noShow = false) =>
  useApiQuery(qk.availability(doctorId ?? '-', noShow), (a) => a.getAvailability(doctorId!, { noShowRestricted: noShow }), { enabled: !!doctorId });
