import { Text, type TextProps } from 'react-native';
import { parseRich } from '@dyh/i18n';
import { font } from '@dyh/tokens';
import { usePrefs } from './theme';

export type Weight = 'r' | 'm' | 's' | 'b' | 'x';
const FAMILY: Record<Weight, string> = {
  r: font.native.regular,
  m: font.native.medium,
  s: font.native.semibold,
  b: font.native.bold,
  x: font.native.extrabold,
};

/**
 * App text. Weight picks the Plus Jakarta Sans face (custom fonts don't synthesise bold on Android).
 * `size` is in px; the patient app's "Larger Text" setting scales it by 1.15.
 */
export function Txt({ w = 'm', size = 14, className, style, ...p }: TextProps & { w?: Weight; size?: number; className?: string }) {
  const big = usePrefs((s) => s.bigText);
  const fs = big ? Math.round(size * 1.15) : size;
  return <Text className={className ?? 'text-ink'} style={[{ fontFamily: FAMILY[w], fontSize: fs, lineHeight: Math.round(fs * 1.4) }, style]} {...p} />;
}

/** Renders "**bold**" markup from translated strings. */
export function Rich({ text, ...p }: { text: string } & React.ComponentProps<typeof Txt>) {
  return (
    <Txt {...p}>
      {parseRich(text).map((s, i) =>
        s.bold ? (
          <Text key={i} style={{ fontFamily: FAMILY.x }}>
            {s.text}
          </Text>
        ) : (
          s.text
        ),
      )}
    </Txt>
  );
}
