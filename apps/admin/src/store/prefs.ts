import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Lang, Session } from '@dyh/core';
import { setLanguage } from '@dyh/i18n';

export type Theme = 'light' | 'dark';

interface PrefsState {
  lang: Lang;
  theme: Theme;
  /** Demo only: which admin account the portal renders as (RBAC preview). */
  viewAs: string;
  session: Session | null;
  setLang: (l: Lang) => void;
  setTheme: (t: Theme) => void;
  setViewAs: (id: string) => void;
  setSession: (s: Session | null) => void;
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      lang: 'tl',
      theme: 'light',
      viewAs: 'a1',
      session: null,
      setLang: (lang) => {
        setLanguage(lang);
        set({ lang });
      },
      setTheme: (theme) => set({ theme }),
      setViewAs: (viewAs) => set({ viewAs }),
      setSession: (session) => set({ session }),
    }),
    {
      name: 'dyh-admin-prefs',
      onRehydrateStorage: () => (s) => s && setLanguage(s.lang),
    },
  ),
);
