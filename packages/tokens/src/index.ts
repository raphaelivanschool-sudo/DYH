/**
 * DYH design tokens, taken 1:1 from the approved HTML prototype.
 * Web reads them as CSS variables (apps/admin/src/styles.css); native apps read
 * them through the ThemeProvider in @dyh/ui-native. Change a colour here and
 * regenerate the CSS with `themeToCssVars`.
 */
export type ThemeName = 'light' | 'dark';

export interface Palette {
  bg: string; scr: string; card: string; field: string; soft: string; tog: string;
  ink: string; muted: string; line: string;
  navy: string; navy2: string; primary: string; blue: string; blue2: string; sky: string; sky2: string;
  green: string; greenBg: string; amber: string; amberBg: string; red: string; redBg: string;
  purple: string; purpleBg: string; teal: string; tealBg: string; gray: string; grayBg: string;
  prio: string; prioBg: string; shadow: string;
}

import paletteJson from './palette.json';

/** Source of truth: palette.json (also read by the NativeWind Tailwind preset). */
export const palettes: Record<ThemeName, Palette> = paletteJson;

/** Fixed brand colours that do not change with the theme. */
export const brand = {
  navy: '#1b3a6b',
  chart: { online: '#2d6cdf', walkin: '#9db9e9', forecast: '#7c4ddb', green: '#12a07a', amber: '#d68a00', red: '#e04a55', star: '#f5a524', yesterday: '#b8cdf3', capacity: '#cfd8e6', pink: '#f08bb0' },
  white: '#ffffff',
};

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 };

export const font = {
  family: 'Plus Jakarta Sans',
  /** Expo font keys loaded from @expo-google-fonts/plus-jakarta-sans. */
  native: { regular: 'PlusJakartaSans_400Regular', medium: 'PlusJakartaSans_500Medium', semibold: 'PlusJakartaSans_600SemiBold', bold: 'PlusJakartaSans_700Bold', extrabold: 'PlusJakartaSans_800ExtraBold' },
  size: { tiny: 11, small: 12, body: 14, lead: 16, h3: 18, h2: 22, h1: 28 },
};

export type ToneName = 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'teal' | 'gray' | 'prio';

/** Foreground/background pair for badges, alerts and icon chips. */
export const tone = (p: Palette, t: ToneName) =>
  ({
    blue: { fg: p.blue, bg: p.sky },
    green: { fg: p.green, bg: p.greenBg },
    amber: { fg: p.amber, bg: p.amberBg },
    red: { fg: p.red, bg: p.redBg },
    purple: { fg: p.purple, bg: p.purpleBg },
    teal: { fg: p.teal, bg: p.tealBg },
    gray: { fg: p.gray, bg: p.grayBg },
    prio: { fg: p.prio, bg: p.prioBg },
  })[t];

const kebab = (k: string) => k.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase();

/** CSS custom properties for a theme, e.g. "--navy-2: #0f2447;". */
export const themeToCssVars = (t: ThemeName) =>
  Object.entries(palettes[t])
    .map(([k, v]) => `--${kebab(k)}: ${v};`)
    .join('\n');
