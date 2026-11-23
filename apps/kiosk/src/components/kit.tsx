import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, View, type GestureResponderEvent } from 'react-native';
import { useApi } from '@dyh/api';
import { DAY_LONG, MONTH_SHORT, parseISO, weekdayOf } from '@dyh/core';
import { common, useLang, useT } from '@dyh/i18n';
import { Button, Gradient, Icon, Logo, Rich, Segmented, Txt, cx, usePrefs, useScheme } from '@dyh/ui-native';
import { km } from '../msgs';
import { useKiosk } from '../store';

export const go = (path: string) => router.navigate(path as never);

/** Ends the visitor's session and returns to the attract loop. */
export const endSession = (to: '/' | '/home' | '/survey' = '/') => {
  useKiosk.getState().reset();
  router.replace(to as never);
};

/** "10:30 AM" from the clinic clock's decimal hour. */
export const clockLabel = (hour: number) => {
  const h = Math.floor(hour),
    m = Math.round((hour - h) * 60);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

export function useToday() {
  const { today, hour } = useApi().clock();
  const [lang] = useLang();
  const [, m, d] = parseISO(today);
  return { today, hour, dayName: DAY_LONG[lang][weekdayOf(today)], dateLabel: `${MONTH_SHORT[lang][m]} ${d}, ${parseISO(today)[0]}` };
}

/** Top bar: logo, clock, language, theme, help, and Home outside the home screen. */
export function KioskHeader() {
  const t = useT(km);
  const tc = useT(common);
  const path = usePathname();
  const { hour, dayName, dateLabel } = useToday();
  const { lang, setLang, setTheme } = usePrefs((p) => p);
  const scheme = useScheme();
  return (
    <View className="flex-row items-center gap-4 border-b border-line bg-card px-6 py-3">
      <Logo height={40} light={scheme === 'dark'} />
      <View className="flex-1" />
      <View className="items-center">
        <View className="flex-row items-center gap-1.5">
          <Icon name="clock" size={16} />
          <Txt w="b" size={16}>
            {clockLabel(hour)}
          </Txt>
        </View>
        <Txt size={12} className="text-muted">
          {dayName}, {dateLabel}
        </Txt>
      </View>
      <View className="w-[210px]">
        <Segmented value={lang} onChange={setLang} options={[{ value: 'tl', label: 'Tagalog' }, { value: 'en', label: 'English' }]} />
      </View>
      <Button variant="o" icon={scheme === 'dark' ? 'sun' : 'moon'} accessibilityLabel="Theme" onPress={() => setTheme(scheme === 'dark' ? 'light' : 'dark')} />
      <View className="flex-row items-center gap-1.5 rounded-xl bg-amber-bg px-3 py-2.5">
        <Icon name="hand-helping" size={16} color="amber" />
        <Txt w="b" size={13} className="text-amber">
          {t('needHelp')}
        </Txt>
      </View>
      {path !== '/home' && (
        <Button variant="o" icon="house" onPress={() => endSession('/home')}>
          {tc('home')}
        </Button>
      )}
    </View>
  );
}

/**
 * Sends the kiosk back to the attract loop after a period with no touches,
 * so the next visitor never sees someone else's details.
 */
export function IdleWatcher({ seconds = 90, children }: { seconds?: number; children: ReactNode }) {
  const path = usePathname();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arm = () => {
    if (timer.current) clearTimeout(timer.current);
    if (path === '/') return;
    timer.current = setTimeout(() => endSession('/'), seconds * 1000);
  };
  useEffect(() => {
    arm();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
  const onAny = (_: GestureResponderEvent) => {
    arm();
    return false;
  };
  return (
    <View className="flex-1" onStartShouldSetResponderCapture={onAny}>
      {children}
    </View>
  );
}

/** Page heading used on every kiosk step. */
export function KTitle({ icon, title, sub, right }: { icon: string; title: string; sub?: string; right?: ReactNode }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <View className="flex-1">
        <View className="flex-row items-center gap-2.5">
          <Icon name={icon} size={28} />
          <Txt w="x" size={28}>
            {title}
          </Txt>
        </View>
        {sub && (
          <Txt size={16} className="mt-1 text-muted">
            {sub}
          </Txt>
        )}
      </View>
      {right}
    </View>
  );
}

/** Large gradient tile on the home screen. */
export function KBig({ icon, title, sub, colors, onPress, wide }: { icon: string; title: string; sub: string; colors: readonly [string, string, ...string[]]; onPress: () => void; wide?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="flex-1 overflow-hidden rounded-[26px]">
      <Gradient colors={colors} className={cx('flex-1 p-7', wide ? 'flex-row items-center gap-6' : 'items-center justify-center')}>
        <View className="h-[72px] w-[72px] items-center justify-center rounded-[22px]" style={{ backgroundColor: 'rgba(255,255,255,0.16)' }}>
          <Icon name={icon} size={40} color="#ffffff" />
        </View>
        <View className={wide ? 'flex-1' : 'mt-4 items-center'}>
          <Txt w="x" size={26} className={cx('text-white', !wide && 'text-center')}>
            {title}
          </Txt>
          <Txt size={15} className={cx('mt-1 text-white', !wide && 'text-center')} style={{ opacity: 0.85 }}>
            {sub}
          </Txt>
        </View>
      </Gradient>
    </Pressable>
  );
}

/** Large toggle option (sex, priority, yes/no). */
export function KOpt({ on, onPress, icon, children, className }: { on: boolean; onPress: () => void; icon?: string; children: ReactNode; className?: string }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      className={cx('min-h-[56px] flex-1 flex-row items-center justify-center gap-2 rounded-2xl border-2 px-4', on ? 'border-blue bg-sky' : 'border-line bg-card', className)}
    >
      {icon && <Icon name={icon} size={20} color={on ? 'blue' : 'muted'} />}
      <Txt w="b" size={16} className={on ? 'text-blue' : 'text-ink'}>
        {children}
      </Txt>
    </Pressable>
  );
}

/** Full-screen outcome (welcome back, too early, thank you). */
export function KResult({ icon, color, title, body, children }: { icon: string; color: string; title: string; body?: string; children?: ReactNode }) {
  return (
    <View className="items-center pt-10">
      <View className="h-24 w-24 items-center justify-center rounded-[30px]" style={{ backgroundColor: color }}>
        <Icon name={icon} size={46} color="#ffffff" />
      </View>
      <Txt w="x" size={30} className="mt-5 text-center">
        {title}
      </Txt>
      {body && <Rich size={18} className="mt-2 max-w-[680px] text-center text-muted" text={body} />}
      {children}
    </View>
  );
}

/** Number pad for the mobile number and OTP. */
export function KPad({ onKey, onDelete, left }: { onKey: (n: string) => void; onDelete: () => void; left?: ReactNode }) {
  const cell = 'h-[60px] flex-1 items-center justify-center rounded-2xl border border-line bg-card';
  const rows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
  ];
  return (
    <View className="gap-2">
      {rows.map((r) => (
        <View key={r[0]} className="flex-row gap-2">
          {r.map((n) => (
            <Pressable key={n} accessibilityLabel={n} onPress={() => onKey(n)} className={cell}>
              <Txt w="x" size={24}>
                {n}
              </Txt>
            </Pressable>
          ))}
        </View>
      ))}
      <View className="flex-row gap-2">
        <View className="flex-1">{left}</View>
        <Pressable accessibilityLabel="0" onPress={() => onKey('0')} className={cell}>
          <Txt w="x" size={24}>
            0
          </Txt>
        </Pressable>
        <Pressable accessibilityLabel="Delete" onPress={onDelete} className={cell}>
          <Icon name="delete" size={24} />
        </Pressable>
      </View>
    </View>
  );
}

/** Seconds left before the slip screen closes itself. */
export function useCountdown(total: number, onDone: () => void) {
  const [left, setLeft] = useState(total);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const id = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (left <= 0) done.current();
  }, [left]);
  return Math.max(0, left);
}
