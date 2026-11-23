import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import { vars } from 'nativewind';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { palettes } from '@dyh/tokens';
import type { Lang, Tone } from '@dyh/core';
import { setLanguage } from '@dyh/i18n';

export type Scheme = 'light' | 'dark';
export type Palette = (typeof palettes)['light'];
export type ColorKey = keyof Palette;

const kebab = (k: string) => k.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase();
const cssVars = (p: Palette) => vars(Object.fromEntries(Object.entries(p).map(([k, v]) => [`--${kebab(k)}`, v])));
const VARS = { light: cssVars(palettes.light), dark: cssVars(palettes.dark) };

const ThemeCtx = createContext<{ scheme: Scheme; c: Palette }>({ scheme: 'light', c: palettes.light });

/** Raw colours for props that can't take a className (icons, SVG, gradients). */
export const useColors = () => useContext(ThemeCtx).c;
export const useScheme = () => useContext(ThemeCtx).scheme;

/** Badge / alert tone → [background, foreground] palette keys. */
export const TONES: Record<Tone, [ColorKey, ColorKey]> = {
  blue: ['sky', 'blue'],
  green: ['greenBg', 'green'],
  amber: ['amberBg', 'amber'],
  red: ['redBg', 'red'],
  purple: ['purpleBg', 'purple'],
  teal: ['tealBg', 'teal'],
  gray: ['grayBg', 'gray'],
  prio: ['prioBg', 'prio'],
};

export function ThemeProvider({ scheme, children }: { scheme: Scheme; children: ReactNode }) {
  return (
    <ThemeCtx.Provider value={{ scheme, c: palettes[scheme] }}>
      <View style={[VARS[scheme], { flex: 1, backgroundColor: palettes[scheme].scr }]}>{children}</View>
    </ThemeCtx.Provider>
  );
}

/**
 * Re-applies the theme variables. Modals render in a portal outside the root view
 * (on web the CSS variables would not reach them), so every overlay wraps its content in this.
 */
export function ThemeScope({ children }: { children: ReactNode }) {
  const { scheme } = useContext(ThemeCtx);
  return <View style={[VARS[scheme], { flex: 1 }]}>{children}</View>;
}

/* ---------------- Per-app preferences (persisted on device) ---------------- */

export interface Prefs {
  lang: Lang;
  theme: Scheme;
  bigText: boolean;
  setLang: (l: Lang) => void;
  setTheme: (t: Scheme) => void;
  setBigText: (v: boolean) => void;
}

const stores = new Map<string, ReturnType<typeof makePrefs>>();
const makePrefs = (key: string) =>
  create<Prefs>()(
    persist(
      (set) => ({
        lang: 'tl',
        theme: 'light',
        bigText: false,
        setLang: (lang) => {
          setLanguage(lang);
          set({ lang });
        },
        setTheme: (theme) => set({ theme }),
        setBigText: (bigText) => set({ bigText }),
      }),
      {
        name: key,
        storage: createJSONStorage(() => AsyncStorage),
        partialize: (s) => ({ lang: s.lang, theme: s.theme, bigText: s.bigText }),
        onRehydrateStorage: () => (s) => s && setLanguage(s.lang),
      },
    ),
  );

let activeKey = 'dyh-prefs';
/** Call once at app start (DyhAppRoot does this) so `usePrefs` knows which app it is in. */
export const configurePrefs = (key: string) => {
  activeKey = key;
  if (!stores.has(key)) stores.set(key, makePrefs(key));
  return stores.get(key)!;
};
export const usePrefs = <T,>(sel: (p: Prefs) => T): T => configurePrefs(activeKey)(sel);

/** Keeps i18next in sync with the persisted language. */
export function useLangSync() {
  const lang = usePrefs((p) => p.lang);
  useEffect(() => setLanguage(lang), [lang]);
}
