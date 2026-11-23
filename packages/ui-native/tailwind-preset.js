// Tailwind preset for the DYH native apps (NativeWind). Colours resolve to CSS
// variables set by ThemeProvider, so light/dark switch at runtime.
const { palettes } = { palettes: require('@dyh/tokens/src/palette.json') };
const kebab = (k) => k.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase();
const colors = Object.fromEntries(Object.keys(palettes.light).map((k) => [kebab(k), `var(--${kebab(k)})`]));
module.exports = { theme: { extend: { colors, borderRadius: { card: '18px' } } } };
