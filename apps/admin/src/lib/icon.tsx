import { icons, type LucideProps } from 'lucide-react';

const pascal = (s: string) => s.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());

export type IconName = string;

/** Names from the prototype that Lucide has since renamed. */
const ALIASES: Record<string, string> = {
  'circle-help': 'circle-question-mark',
  'align-left': 'text-align-start',
  'help-circle': 'circle-question-mark',
  filter: 'funnel',
  text: 'type',
};

/**
 * Render a Lucide icon by its kebab-case name ("heart-pulse").
 * Data from the API (specializations, announcements, notifications) stores icon names
 * as strings, so screens need a by-name lookup. Unknown names fall back to a circle.
 */
export function Icon({ name, size = 18, ...rest }: { name: IconName } & LucideProps) {
  const Cmp = icons[pascal(ALIASES[name] ?? name) as keyof typeof icons] ?? icons.Circle;
  return <Cmp size={size} aria-hidden {...rest} />;
}
