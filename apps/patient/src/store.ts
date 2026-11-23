import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Signed-in state and device-level patient settings (persisted). */
interface SessionState {
  token: string | null;
  /** Whether this device has been set up with an account (welcome → PIN screen). */
  hasAccount: boolean;
  bioOn: boolean;
  notif: { on: boolean; queue: boolean; appt: boolean; ann: boolean };
  signIn: (token: string) => void;
  signOut: () => void;
  set: (p: Partial<Omit<SessionState, 'signIn' | 'signOut' | 'set'>>) => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      hasAccount: true,
      bioOn: true,
      notif: { on: true, queue: true, appt: true, ann: true },
      signIn: (token) => set({ token, hasAccount: true }),
      signOut: () => set({ token: null }),
      set: (p) => set(p),
    }),
    { name: 'dyh-patient-session', storage: createJSONStorage(() => AsyncStorage), partialize: ({ signIn: _a, signOut: _b, set: _c, ...s }) => s },
  ),
);

/** Book flow state, so other screens can jump into it (Family → Book, Doctor → Book, Reschedule). */
export interface BookDraft {
  step: 1 | 2 | 3 | 4 | 5;
  who: string | null;
  spec: string | null;
  doctor: string | null;
  viewDoctor: string | null;
  date: string | null;
  complaint: string;
}
export const EMPTY_BOOK: BookDraft = { step: 1, who: null, spec: null, doctor: null, viewDoctor: null, date: null, complaint: '' };

/** Transient UI state (not persisted): drawer, AI chat, PIN-gated screens, announcement popup. */
interface UiState {
  drawer: boolean;
  chat: boolean;
  annPopup: boolean;
  recordUnlocked: boolean;
  qrUnlocked: boolean;
  /** Doctor picked while browsing as guest; booking resumes after log in. */
  pendingDoctor: string | null;
  /** Demo flag: after a no-show only same-day walk-in is allowed. */
  noShow: boolean;
  book: BookDraft;
  qrWho: number;
  calWho: number;
  set: (p: Partial<Omit<UiState, 'set' | 'startBook'>>) => void;
  startBook: (p: Partial<BookDraft>) => void;
}

export const useUi = create<UiState>()((set) => ({
  drawer: false,
  chat: false,
  annPopup: false,
  recordUnlocked: false,
  qrUnlocked: false,
  pendingDoctor: null,
  noShow: false,
  book: EMPTY_BOOK,
  qrWho: 0,
  calWho: 0,
  set: (p) => set(p),
  startBook: (p) => set({ book: { ...EMPTY_BOOK, ...p } }),
}));
