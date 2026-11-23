/**
 * @dyh/i18n — Tagalog / English for every DYH app, powered by i18next.
 *
 * Messages are declared next to the screen that uses them, as [Tagalog, English]
 * pairs (the same shape the prototype used), and registered into i18next under a
 * namespace. This keeps screens readable while still producing standard i18next
 * resources that can be exported to JSON for translators later (see `exportResources`).
 *
 *   const m = defineMessages('patient.home', { hello: ['Magandang umaga', 'Good morning'] });
 *   const t = useT(m);  t('hello')
 *
 * Interpolation uses i18next syntax: ['{{n}} pasyente', '{{n}} patients'] → t('k', { n: 3 }).
 * Bold text uses **double asterisks**; render it with the app's <Rich> component.
 *
 * Announcements are not translated (business rule) — they are plain content.
 */
import i18next from 'i18next';
import { useCallback } from 'react';
import { initReactI18next, useTranslation } from 'react-i18next';
import type { Lang, Localized } from '@dyh/core';

export type Msg = readonly [tl: string, en: string];
export type Messages = Record<string, Msg>;
export interface MessageDef<M extends Messages> {
  ns: string;
  messages: M;
}

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'tl', label: 'Tagalog' },
  { id: 'en', label: 'English' },
];

if (!i18next.isInitialized) {
  void i18next.use(initReactI18next).init({
    lng: 'tl',
    fallbackLng: 'en',
    resources: {},
    interpolation: { escapeValue: false },
    initAsync: false,
    returnNull: false,
    react: { bindI18nStore: 'added' },
  });
}

export const i18n = i18next;

/** Register messages under a namespace and get a typed handle for `useT`. */
export function defineMessages<const M extends Messages>(ns: string, messages: M): MessageDef<M> {
  const tl: Record<string, string> = {};
  const en: Record<string, string> = {};
  for (const [k, [a, b]] of Object.entries(messages)) {
    tl[k] = a;
    en[k] = b;
  }
  i18next.addResourceBundle('tl', ns, tl, true, true);
  i18next.addResourceBundle('en', ns, en, true, true);
  return { ns, messages };
}

export type TFn<M extends Messages> = (key: keyof M & string, vars?: Record<string, string | number>) => string;

/** Typed translator for a message namespace. Re-renders on language change. */
export function useT<M extends Messages>(def: MessageDef<M>): TFn<M> {
  const { t } = useTranslation(def.ns);
  return useCallback((key, vars) => t(key, vars) as string, [t]);
}

/** Current language + setter. Apps persist the value in their settings store. */
export function useLang(): [Lang, (l: Lang) => void] {
  const { i18n: inst } = useTranslation();
  const lang = (inst.language === 'en' ? 'en' : 'tl') as Lang;
  return [lang, setLanguage];
}

export const setLanguage = (l: Lang) => void i18next.changeLanguage(l);
export const currentLang = (): Lang => (i18next.language === 'en' ? 'en' : 'tl');

/** Localize server content ({tl, en}) with the current language. */
export function useLoc() {
  const [lang] = useLang();
  return useCallback((x: Localized | string | undefined | null) => (x == null ? '' : typeof x === 'string' ? x : x[lang]), [lang]);
}

/** Split "**bold** text" into segments for rich rendering (web and native). */
export function parseRich(s: string): { text: string; bold: boolean }[] {
  return s
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) => (part.startsWith('**') && part.endsWith('**') ? { text: part.slice(2, -2), bold: true } : { text: part, bold: false }));
}

/** Dump every registered namespace, e.g. to hand JSON files to translators. */
export function exportResources() {
  return { tl: i18next.store.data.tl, en: i18next.store.data.en };
}

