import { create } from 'zustand';
import type { KioskScanResult } from '@dyh/api';
import type { Priority } from '@dyh/core';

export interface KioskPatient {
  id: string;
  name: string;
  priority: Priority | null;
}

/**
 * One visitor's session at the kiosk. Nothing is persisted: the kiosk is a
 * shared device, so every flow starts clean and is wiped on timeout.
 */
interface KioskState {
  patient: KioskPatient | null;
  /** Result shown on the slip screen. */
  result: KioskScanResult | null;
  set: (p: Partial<Omit<KioskState, 'set' | 'reset'>>) => void;
  reset: () => void;
}

export const useKiosk = create<KioskState>()((set) => ({
  patient: null,
  result: null,
  set: (p) => set(p),
  reset: () => set({ patient: null, result: null }),
}));
