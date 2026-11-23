import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Signed-in doctor (persisted). `doctorId` scopes every query. */
interface SessionState {
  token: string | null;
  doctorId: string;
  name: string;
  bioOn: boolean;
  notif: { queue: boolean; drafts: boolean };
  signIn: (token: string, doctorId: string, name: string) => void;
  signOut: () => void;
  set: (p: Partial<Omit<SessionState, 'signIn' | 'signOut' | 'set'>>) => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      doctorId: 'd1',
      name: 'Dr. Maria Santos',
      bioOn: true,
      notif: { queue: true, drafts: true },
      signIn: (token, doctorId, name) => set({ token, doctorId, name }),
      signOut: () => set({ token: null }),
      set: (p) => set(p),
    }),
    { name: 'dyh-doctor-session', storage: createJSONStorage(() => AsyncStorage), partialize: ({ signIn: _a, signOut: _b, set: _c, ...s }) => s },
  ),
);

/** What the identity check unlocks once it passes. */
export type VerifyTarget = { kind: 'record'; patientId: string } | { kind: 'reports' };

/** Screen state shared across the record → consult → follow-up flow (not persisted). */
interface UiState {
  drawer: boolean;
  /** Patient whose record is open (after PIN / fingerprint / QR). */
  patientId: string | null;
  recordOpen: boolean;
  reportsOpen: boolean;
  verify: VerifyTarget | null;
  scan: boolean;
  /** Consult opened from a secretary draft (per-field checks required). */
  consultFromDraft: boolean;
  /** Patients sent to the secretary to fill in during this session. */
  delegated: string[];
  set: (p: Partial<Omit<UiState, 'set'>>) => void;
}

export const useUi = create<UiState>()((set) => ({
  drawer: false,
  patientId: null,
  recordOpen: false,
  reportsOpen: false,
  verify: null,
  scan: false,
  consultFromDraft: false,
  delegated: [],
  set: (p) => set(p),
}));
