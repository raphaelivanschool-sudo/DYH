import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path, Rect, Text as SvgText } from 'react-native-svg';
import type { Tone } from '@dyh/core';
import { common, statusIcon, statusLabel, statusTone, useT, type StatusKey } from '@dyh/i18n';
import { Icon } from './icon';
import { Rich, Txt } from './text';
import { TONES, useColors, useScheme, type ColorKey } from './theme';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export const GRAD = { brand: ['#2d6cdf', '#17325f'] as const, hero: ['#1f56b0', '#17325f'] as const, deep: ['#2d6cdf', '#17325f', '#0f2447'] as const };

/* ---------------- Buttons ---------------- */

export type ButtonVariant = 'p' | 'o' | 'g' | 'r' | 'ok' | 'n' | 'w' | 'link';
const BTN: Record<ButtonVariant, { box: string; fg: ColorKey | string }> = {
  p: { box: 'bg-primary', fg: '#ffffff' },
  o: { box: 'bg-card border-[1.5px] border-line', fg: 'ink' },
  g: { box: 'bg-sky', fg: 'blue' },
  r: { box: 'bg-red-bg', fg: 'red' },
  ok: { box: 'bg-green', fg: '#ffffff' },
  n: { box: 'bg-navy', fg: '#ffffff' },
  w: { box: 'bg-white', fg: '#17325f' },
  link: { box: '', fg: 'blue' },
};
const SIZE = { sm: { box: 'px-3 py-[9px] rounded-[10px]', fs: 13, ic: 15 }, md: { box: 'px-[18px] py-[14px] rounded-[14px]', fs: 15, ic: 18 }, lg: { box: 'px-[22px] py-[17px] rounded-[16px]', fs: 16.5, ic: 20 } };

export function Button({
  children, variant = 'p', size = 'md', icon, iconRight, disabled, loading, className, onPress, full, stacked, ...p
}: { children?: ReactNode; variant?: ButtonVariant; size?: keyof typeof SIZE; icon?: string; iconRight?: string; loading?: boolean; full?: boolean; className?: string; /** Icon above a short label (compact button grids). */ stacked?: boolean } & Omit<PressableProps, 'children'>) {
  const v = BTN[variant];
  const s = SIZE[size];
  const c = useColors();
  const fg = (c as unknown as Record<string, string>)[v.fg] ?? v.fg;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      className={cx('items-center justify-center', stacked ? 'gap-1 rounded-xl px-1 py-[11px]' : cx('flex-row gap-2', variant !== 'link' && s.box), v.box, full && 'w-full', (disabled || loading) && 'opacity-50', className)}
      style={({ pressed }) => (pressed ? { transform: [{ scale: 0.98 }], opacity: 0.92 } : undefined)}
      {...p}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : icon ? <Icon name={icon} size={s.ic} color={fg} /> : null}
      {children != null && (
        <Txt w="b" size={stacked ? 12.5 : s.fs} style={{ color: fg }} numberOfLines={1}>
          {children}
        </Txt>
      )}
      {iconRight && <Icon name={iconRight} size={s.ic} color={fg} />}
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, dot, size = 'md', color = 'ink', className }: { icon: string; onPress?: () => void; label: string; dot?: boolean; size?: 'sm' | 'md'; color?: ColorKey | string; className?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className={cx('items-center justify-center border border-line bg-card', size === 'sm' ? 'h-[34px] w-[34px] rounded-[11px]' : 'h-[42px] w-[42px] rounded-[14px]', className)}
    >
      <Icon name={icon} size={size === 'sm' ? 17 : 20} color={color} />
      {dot && <View className="absolute right-[9px] top-2 h-[9px] w-[9px] rounded-full border-2 border-card bg-red" />}
    </Pressable>
  );
}

/* ---------------- Surfaces ---------------- */

export function Card({ children, className, style, onPress, lift }: { children: ReactNode; className?: string; style?: StyleProp<ViewStyle>; onPress?: () => void; lift?: boolean }) {
  const cls = cx('rounded-2xl border border-line bg-card p-4', className);
  const shadow: ViewStyle | undefined = lift ? { shadowColor: '#0f2447', shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 6, borderWidth: 0 } : undefined;
  if (onPress)
    return (
      <Pressable onPress={onPress} className={cls} style={({ pressed }) => [shadow, style as ViewStyle, pressed && { opacity: 0.85 }]}>
        {children}
      </Pressable>
    );
  return (
    <View className={cls} style={[shadow, style]}>
      {children}
    </View>
  );
}

export function Gradient({ colors = GRAD.brand, children, className, style }: { colors?: readonly [string, string, ...string[]]; children?: ReactNode; className?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className={className} style={style}>
      {children}
    </LinearGradient>
  );
}

export function Divider({ className }: { className?: string }) {
  return <View className={cx('my-3 h-px bg-line', className)} />;
}

/* ---------------- Labels ---------------- */

export function Badge({ tone = 'gray', icon, children, className, size = 11 }: { tone?: Tone; icon?: string; children?: ReactNode; className?: string; size?: number }) {
  const c = useColors();
  const [bg, fg] = TONES[tone];
  return (
    <View className={cx('flex-row items-center gap-1 self-start rounded-full px-[9px] py-[3px]', className)} style={{ backgroundColor: c[bg] }}>
      {icon && <Icon name={icon} size={size + 1} color={fg} />}
      {children != null && (
        <Txt w="b" size={size} style={{ color: c[fg] }} numberOfLines={1}>
          {children}
        </Txt>
      )}
    </View>
  );
}

export function StatusBadge({ status }: { status: StatusKey }) {
  const t = useT(common);
  return (
    <Badge tone={statusTone[status]} icon={statusIcon[status]}>
      {t(statusLabel(status))}
    </Badge>
  );
}

export function Alert({ kind = 'info', icon, children, text, className }: { kind?: 'info' | 'warn' | 'danger' | 'ok'; icon?: string; children?: ReactNode; text?: string; className?: string }) {
  const c = useColors();
  const [bg, fg] = TONES[({ info: 'blue', warn: 'amber', danger: 'red', ok: 'green' } as const)[kind]];
  return (
    <View className={cx('flex-row items-start gap-2.5 rounded-xl px-3.5 py-3', className)} style={{ backgroundColor: c[bg] }}>
      <Icon name={icon ?? ({ info: 'info', warn: 'triangle-alert', danger: 'octagon-alert', ok: 'circle-check' } as const)[kind]} size={18} color={fg} style={{ marginTop: 1 }} />
      <View className="flex-1">{text != null ? <Rich text={text} size={13} style={{ color: c[fg] }} /> : children}</View>
    </View>
  );
}

/** Dashed "not built yet" note ("ph" in the prototype). */
export function Placeholder({ icon = 'construction', text }: { icon?: string; text: string }) {
  return (
    <View className="flex-row items-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-line bg-sky-2 px-3.5 py-3">
      <Icon name={icon} size={17} color="muted" />
      <Rich text={text} size={12.5} className="flex-1 text-muted" />
    </View>
  );
}

export function SectionTitle({ icon, children, right, className }: { icon?: string; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <View className={cx('mb-2.5 mt-5 flex-row items-center gap-2', className)}>
      {icon && <Icon name={icon} size={18} color="blue" />}
      <Txt w="b" size={15} className="flex-1 text-ink">
        {children}
      </Txt>
      {right}
    </View>
  );
}

export function LinkText({ children, onPress, icon = 'chevron-right' }: { children: ReactNode; onPress?: () => void; icon?: string }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-0.5">
      <Txt w="b" size={13} className="text-blue">
        {children}
      </Txt>
      {icon && <Icon name={icon} size={15} color="blue" />}
    </Pressable>
  );
}

/** Label/value row inside a card ("list-row"). */
export function ListRow({ icon, label, value, children, onPress, last, right }: { icon?: string; label?: ReactNode; value?: ReactNode; children?: ReactNode; onPress?: () => void; last?: boolean; right?: ReactNode }) {
  const body = (
    <>
      {icon && <Icon name={icon} size={18} color="muted" />}
      {children ?? (
        <>
          <Txt className="flex-1 text-muted">{label}</Txt>
          {typeof value === 'string' || typeof value === 'number' ? (
            <Txt w="b" className="max-w-[60%] text-right text-ink">
              {value}
            </Txt>
          ) : (
            value
          )}
        </>
      )}
      {right}
    </>
  );
  const cls = cx('flex-row items-center gap-3 py-3', !last && 'border-b border-line');
  return onPress ? (
    <Pressable onPress={onPress} className={cls}>
      {body}
    </Pressable>
  ) : (
    <View className={cls}>{body}</View>
  );
}

export function Rows({ rows }: { rows: [icon: string, label: string, value: ReactNode][] }) {
  return (
    <>
      {rows.map(([i, l, v], k) => (
        <ListRow key={l} icon={i} label={l} value={v} last={k === rows.length - 1} />
      ))}
    </>
  );
}

export function Stat({ icon, label, value, className, size = 24 }: { icon?: string; label: string; value: ReactNode; className?: string; size?: number }) {
  return (
    <View className={cx('flex-1 rounded-[14px] border border-line bg-card p-3.5', className)}>
      <View className="flex-row items-center gap-1">
        {icon && <Icon name={icon} size={13} color="muted" />}
        <Txt w="s" size={12} className="text-muted" numberOfLines={1}>
          {label}
        </Txt>
      </View>
      <Txt w="x" size={size} className="mt-1 text-ink">
        {value}
      </Txt>
    </View>
  );
}

/* ---------------- Avatars & brand ---------------- */

const AV = { sm: { box: 34, r: 11, fs: 12, ic: 17 }, md: { box: 42, r: 14, fs: 14, ic: 20 }, lg: { box: 56, r: 18, fs: 18, ic: 26 }, xl: { box: 84, r: 28, fs: 26, ic: 38 } };
export function Avatar({ text, icon, size = 'md', light, color, className }: { text?: string; icon?: string; size?: keyof typeof AV; light?: boolean; color?: string; className?: string }) {
  const s = AV[size];
  const c = useColors();
  const fg = light ? c.blue : '#ffffff';
  const inner = icon ? <Icon name={icon} size={s.ic} color={fg} /> : <Txt w="x" size={s.fs} style={{ color: fg }}>{text}</Txt>;
  const box: ViewStyle = { width: s.box, height: s.box, borderRadius: s.r, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' };
  if (light || color) return <View className={className} style={[box, { backgroundColor: color ?? c.sky }]}>{inner}</View>;
  return (
    <Gradient className={className} style={box}>
      {inner}
    </Gradient>
  );
}

/** Hospital cross mark used in notifications and headers. */
export function Mark({ height = 28, color }: { height?: number; color?: string }) {
  const dark = useScheme() === 'dark';
  const c = color ?? (dark ? '#ffffff' : '#1b3a6b');
  return (
    <Svg viewBox="12 6 58 54" height={height} width={(height * 58) / 54}>
      <Path d="M30 8H52V22H68V44H52V58H30V44H14V22H30Z" fill="none" stroke={c} strokeWidth={4} strokeLinejoin="round" />
      <Rect x={29} y={25} width={25} height={16} rx={6} fill="none" stroke={c} strokeWidth={4} />
    </Svg>
  );
}

export function Logo({ height = 44, light }: { height?: number; light?: boolean }) {
  const c = light ? '#ffffff' : '#1b3a6b';
  const tc = light ? '#1b3a6b' : '#ffffff';
  return (
    <Svg viewBox="0 0 214 90" height={height} width={(height * 214) / 90}>
      <Path d="M30 8H52V22H68V44H52V58H30V44H14V22H30Z" fill="none" stroke={c} strokeWidth={3.2} strokeLinejoin="round" />
      <Rect x={29} y={25} width={25} height={16} rx={6} fill="none" stroke={c} strokeWidth={3.2} />
      <SvgText x={70} y={58} fontFamily="Arial" fontWeight="900" fontSize={57} fill={c} letterSpacing={-1}>
        DYH
      </SvgText>
      <Rect x={8} y={66} width={198} height={19} fill={c} />
      <SvgText x={107} y={80} textAnchor="middle" fontFamily="Arial" fontWeight="700" fontSize={11.6} fill={tc} letterSpacing={1.1}>
        DR. YANGA'S HOSPITAL INC.
      </SvgText>
    </Svg>
  );
}

/* ---------------- States ---------------- */

export function Loading({ className }: { className?: string }) {
  const c = useColors();
  return (
    <View className={cx('flex-1 items-center justify-center py-16', className)}>
      <ActivityIndicator color={c.blue2} />
    </View>
  );
}

export function Empty({ icon = 'search-x', text }: { icon?: string; text: string }) {
  return (
    <View className="items-center rounded-2xl border border-line bg-card px-4 py-7">
      <Icon name={icon} size={26} color="muted" />
      <Txt className="mt-2 text-center text-muted">{text}</Txt>
    </View>
  );
}

/** Thin progress bar (capacity / slots). */
export function Bar({ value, className, color }: { value: number; className?: string; color?: string }) {
  const c = useColors();
  return (
    <View className={cx('h-1.5 overflow-hidden rounded-full bg-soft', className)}>
      <View className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color ?? c.blue2 }} />
    </View>
  );
}

export function PriorityBadge({ p }: { p: 'senior' | 'pwd' | null | undefined }) {
  const t = useT(common);
  if (!p) return null;
  return (
    <Badge tone="prio" icon={p === 'senior' ? 'person-standing' : 'accessibility'}>
      {t(p)}
    </Badge>
  );
}

export function TypeBadge({ type }: { type: 'online' | 'walkin' }) {
  const t = useT(common);
  return (
    <Badge tone={type === 'online' ? 'blue' : 'teal'} icon={type === 'online' ? 'smartphone' : 'footprints'}>
      {t(type)}
    </Badge>
  );
}

export function Row({ children, className, gap = 'gap-2' }: { children: ReactNode; className?: string; gap?: string }) {
  return <View className={cx('flex-row items-center', gap, className)}>{children}</View>;
}
