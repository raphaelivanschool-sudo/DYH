import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Signed-in secretary and the doctor currently being assisted (persisted). */
interface SessionState {
  token: string | null;
  /** Doctors assigned by the Admin. */
  doctorIds: string[];
  doctorId: string;
  bioOn: boolean;
  notif: { queue: boolean; sound: boolean };
  signIn: (token: string) => void;
  signOut: () => void;
  set: (p: Partial<Omit<SessionState, 'signIn' | 'signOut' | 'set'>>) => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      doctorIds: ['d1', 'd2', 'd4'],
      doctorId: 'd1',
      bioOn: true,
      notif: { queue: true, sound: true },
      signIn: (token) => set({ token }),
      signOut: () => set({ token: null }),
      set: (p) => set(p),
    }),
    { name: 'dyh-secretary-session', storage: createJSONStorage(() => AsyncStorage), partialize: ({ signIn: _a, signOut: _b, set: _c, ...s }) => s },
  ),
);

interface UiState {
  drawer: boolean;
  doctorSheet: boolean;
  /** Queue number whose vitals are being edited. */
  vitalsFor: string | null;
  /** Blocked date being forwarded from the SMS screen. */
  smsBlockDate: string | null;
  set: (p: Partial<Omit<UiState, 'set'>>) => void;
}

export const useUi = create<UiState>()((set) => ({
  drawer: false,
  doctorSheet: false,
  vitalsFor: null,
  smsBlockDate: null,
  set: (p) => set(p),
}));
