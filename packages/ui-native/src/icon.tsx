import { icons, type LucideProps } from 'lucide-react-native';
import { useColors, type ColorKey } from './theme';

const pascal = (s: string) => s.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());

/** Prototype icon names that Lucide has since renamed (same table as the admin web app). */
const ALIASES: Record<string, string> = {
  'circle-help': 'circle-question-mark',
  'help-circle': 'circle-question-mark',
  'align-left': 'text-align-start',
  filter: 'funnel',
  text: 'type',
  fingerprint: 'fingerprint-pattern',
};

/**
 * Lucide icon by kebab-case name. API data (specializations, notifications, announcements)
 * stores icon names as strings, so screens need a by-name lookup.
 * `color` takes a palette key ("blue", "muted") or any colour string.
 */
export function Icon({ name, size = 18, color = 'ink', strokeWidth = 2, ...rest }: { name: string; color?: ColorKey | (string & {}) } & Omit<LucideProps, 'color'>) {
  const c = useColors();
  const Cmp = icons[pascal(ALIASES[name] ?? name) as keyof typeof icons] ?? icons.Circle;
  const resolved = (c as unknown as Record<string, string>)[color] ?? color;
  return <Cmp size={size} color={resolved} strokeWidth={strokeWidth} {...rest} />;
}
