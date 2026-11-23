import { useMemo, useRef, useState, type ReactNode } from 'react';
import { FlatList, Modal, Pressable, Switch, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MONTH_LONG, daysInMonth } from '@dyh/core';
import { common, useLang, useT } from '@dyh/i18n';
import { Icon } from './icon';
import { cx } from './primitives';
import { Txt } from './text';
import { ThemeScope, useColors } from './theme';

const FONT = { fontFamily: 'PlusJakartaSans_500Medium' };

export function Input({ className, multiline, ...p }: TextInputProps & { className?: string }) {
  const c = useColors();
  const [focus, setFocus] = useState(false);
  return (
    <TextInput
      placeholderTextColor={c.muted}
      multiline={multiline}
      onFocus={(e) => (setFocus(true), p.onFocus?.(e))}
      onBlur={(e) => (setFocus(false), p.onBlur?.(e))}
      className={cx('w-full rounded-xl border-[1.5px] bg-field px-3.5 py-3 text-ink', focus ? 'border-blue-2' : 'border-line', multiline && 'min-h-[84px]', className)}
      style={[FONT, { fontSize: 15, textAlignVertical: multiline ? 'top' : 'center' }]}
      {...p}
    />
  );
}

export function Field({ label, icon, optional, hint, children, className }: { label: string; icon?: string; optional?: boolean; hint?: ReactNode; children: ReactNode; className?: string }) {
  const t = useT(common);
  return (
    <View className={cx('mt-3.5', className)}>
      <View className="mb-1.5 flex-row items-center gap-1.5">
        {icon && <Icon name={icon} size={15} color="muted" />}
        <Txt w="b" size={13}>
          {label}
          {optional ? <Txt size={13} className="text-muted">{` (${t('optional')})`}</Txt> : null}
        </Txt>
      </View>
      {children}
      {hint != null && (typeof hint === 'string' ? <Txt size={11.5} className="mt-1 text-muted">{hint}</Txt> : hint)}
    </View>
  );
}

export function SearchBox({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  const c = useColors();
  return (
    <View className={cx('flex-row items-center gap-2 rounded-xl border-[1.5px] border-line bg-field pl-3 pr-1.5', className)}>
      <Icon name="search" size={18} color="muted" />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={c.muted} accessibilityLabel={placeholder} className="flex-1 py-3 text-ink" style={[FONT, { fontSize: 15 }]} />
      {!!value && (
        <Pressable accessibilityLabel="Clear" onPress={() => onChange('')} className="h-[30px] w-[30px] items-center justify-center">
          <Icon name="x" size={17} color="muted" />
        </Pressable>
      )}
    </View>
  );
}

/** Case-insensitive "contains" filter used by every list search. */
export const matches = (haystack: (string | undefined | null)[], q: string) => !q.trim() || haystack.join(' ').toLowerCase().includes(q.trim().toLowerCase());

export function Segmented<T extends string>({ value, onChange, options, className, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; icon?: string }[]; className?: string; size?: 'sm' | 'md' }) {
  return (
    <View accessibilityRole="tablist" className={cx('flex-row gap-1 rounded-xl bg-soft p-1', className)}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            className={cx('flex-1 flex-row items-center justify-center gap-1.5 rounded-[9px]', size === 'sm' ? 'px-2 py-1.5' : 'px-2 py-2.5', on && 'bg-card')}
            style={on ? { shadowColor: '#0f2447', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 } : undefined}
          >
            {o.icon && <Icon name={o.icon} size={15} color={on ? 'ink' : 'muted'} />}
            <Txt w="s" size={size === 'sm' ? 12 : 13} className={on ? 'text-ink' : 'text-muted'} numberOfLines={1}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ on, onPress, children, icon }: { on?: boolean; onPress?: () => void; children: ReactNode; icon?: string }) {
  return (
    <Pressable accessibilityState={{ selected: on }} onPress={onPress} className={cx('flex-row items-center gap-1.5 rounded-full border-[1.5px] px-[13px] py-2', on ? 'border-primary bg-primary' : 'border-line bg-card')}>
      {icon && <Icon name={icon} size={15} color={on ? '#ffffff' : 'ink'} />}
      <Txt w="s" size={13} className={on ? 'text-white' : 'text-ink'}>
        {children}
      </Txt>
    </Pressable>
  );
}

export function Toggle({ value, onChange, label, disabled }: { value: boolean; onChange?: (v: boolean) => void; label: string; disabled?: boolean }) {
  const c = useColors();
  return <Switch accessibilityLabel={label} value={value} disabled={disabled} onValueChange={onChange} trackColor={{ false: c.tog, true: c.primary }} thumbColor="#ffffff" ios_backgroundColor={c.tog} />;
}

/* ---------------- Picker (bottom sheet with search) ---------------- */

export interface PickOption {
  value: string;
  label: string;
  sub?: string;
  icon?: string;
  disabled?: boolean;
}

export function Picker({ value, onChange, options, placeholder, title, icon, searchable = options.length > 6 }: { value: string | null | undefined; onChange: (v: string) => void; options: PickOption[]; placeholder?: string; title: string; icon?: string; searchable?: boolean }) {
  const t = useT(common);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const insets = useSafeAreaInsets();
  const cur = options.find((o) => o.value === value);
  const list = useMemo(() => options.filter((o) => matches([o.label, o.sub], q)), [options, q]);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={() => setOpen(true)} className="flex-row items-center gap-2.5 rounded-xl border-[1.5px] border-line bg-field px-3.5 py-3">
        {(cur?.icon ?? icon) && <Icon name={cur?.icon ?? icon!} size={18} color={cur ? 'blue' : 'muted'} />}
        <View className="flex-1">
          <Txt w={cur ? 's' : 'm'} size={15} className={cur ? 'text-ink' : 'text-muted'} numberOfLines={1}>
            {cur?.label ?? placeholder ?? t('select')}
          </Txt>
          {cur?.sub && (
            <Txt size={11.5} className="text-muted" numberOfLines={1}>
              {cur.sub}
            </Txt>
          )}
        </View>
        <Icon name="chevrons-up-down" size={17} color="muted" />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <ThemeScope>
        <Pressable className="flex-1 bg-black/40" onPress={() => setOpen(false)} />
        <SheetBody title={title} icon={icon} onClose={() => setOpen(false)} bottomInset={insets.bottom}>
          {searchable && <SearchBox value={q} onChange={setQ} placeholder={t('search')} className="mb-2" />}
          <FlatList
            data={list}
            keyExtractor={(o) => o.value}
            style={{ maxHeight: 420 }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Txt className="py-6 text-center text-muted">{t('noResults')}</Txt>}
            renderItem={({ item: o }) => {
              const on = o.value === value;
              return (
                <Pressable
                  disabled={o.disabled}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                    setQ('');
                  }}
                  className={cx('mb-1 flex-row items-center gap-3 rounded-xl px-3 py-3', on && 'bg-sky', o.disabled && 'opacity-40')}
                >
                  {o.icon && <Icon name={o.icon} size={18} color={on ? 'blue' : 'muted'} />}
                  <View className="flex-1">
                    <Txt w="s" className={on ? 'text-blue' : 'text-ink'}>
                      {o.label}
                    </Txt>
                    {o.sub && <Txt size={12} className="text-muted">{o.sub}</Txt>}
                  </View>
                  {on && <Icon name="check" size={18} color="blue" />}
                </Pressable>
              );
            }}
          />
        </SheetBody>
        </ThemeScope>
      </Modal>
    </>
  );
}

/** The rounded panel of a bottom sheet (used by Picker and Sheet). */
export function SheetBody({ title, icon, onClose, children, bottomInset = 0 }: { title?: string; icon?: string; onClose: () => void; children: ReactNode; bottomInset?: number }) {
  const t = useT(common);
  return (
    <View className="rounded-t-[26px] bg-card px-[18px] pt-2.5" style={{ paddingBottom: 18 + bottomInset }}>
      <View className="mb-2 h-1 w-10 self-center rounded-full bg-line" />
      {title && (
        <View className="mb-3 flex-row items-center gap-2">
          {icon && <Icon name={icon} size={19} color="blue" />}
          <Txt w="b" size={17} className="flex-1">
            {title}
          </Txt>
          <Pressable accessibilityLabel={t('close')} onPress={onClose} className="h-8 w-8 items-center justify-center rounded-[10px] bg-soft">
            <Icon name="x" size={17} color="muted" />
          </Pressable>
        </View>
      )}
      {children}
    </View>
  );
}

/* ---------------- OTP / step progress ---------------- */

export function OtpBoxes({ value, onChange, length = 6 }: { value: string; onChange: (v: string) => void; length?: number }) {
  const ref = useRef<TextInputInstance>(null);
  return (
    <Pressable onPress={() => ref.current?.focus()} className="mt-3.5 flex-row justify-center gap-2">
      {Array.from({ length }, (_, i) => (
        <View key={i} className={cx('h-[54px] w-11 items-center justify-center rounded-xl border-[1.5px] bg-field', i === value.length ? 'border-blue-2' : 'border-line')}>
          <Txt w="x" size={22}>
            {value[i] ?? ''}
          </Txt>
        </View>
      ))}
      <TextInput ref={ref} value={value} onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, length))} keyboardType="number-pad" maxLength={length} accessibilityLabel="OTP" style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} />
    </Pressable>
  );
}

export function Stepper({ total, current, label }: { total: number; current: number; label: string }) {
  const t = useT(common);
  return (
    <View>
      <View className="mb-1 mt-1.5 flex-row gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <View key={i} className={cx('h-[5px] flex-1 rounded-full', i < current ? 'bg-primary' : 'bg-soft')} />
        ))}
      </View>
      <View className="flex-row items-center gap-1.5">
        <Icon name="footprints" size={14} color="muted" />
        <Txt w="b" size={12} className="text-muted">
          {t('stepOf', { n: current, total })} · {label}
        </Txt>
      </View>
    </View>
  );
}

/* ---------------- Date (month / day / year pickers; no native date input on all platforms) ---------------- */


export function DateField({ value, onChange, fromYear = 1920, toYear = 2026, label }: { value: string; onChange: (iso: string) => void; fromYear?: number; toYear?: number; label: string }) {
  const [lang] = useLang();
  const [y, m, d] = value ? value.split('-').map(Number) : [0, 0, 0];
  const emit = (ny: number, nm: number, nd: number) => {
    if (!ny || !nm || !nd) return onChange([ny || '', nm ? String(nm).padStart(2, '0') : '', nd ? String(nd).padStart(2, '0') : ''].join('-'));
    const max = daysInMonth(ny, nm - 1);
    onChange(`${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(nd, max)).padStart(2, '0')}`);
  };
  const years = Array.from({ length: toYear - fromYear + 1 }, (_, i) => String(toYear - i));
  return (
    <View className="flex-row gap-2" accessibilityLabel={label}>
      <View className="flex-[1.4]">
        <Picker title={label} value={m ? String(m) : ''} placeholder="MM" searchable={false} onChange={(v) => emit(y, Number(v), d)} options={MONTH_LONG[lang].map((n, i) => ({ value: String(i + 1), label: n }))} />
      </View>
      <View className="flex-1">
        <Picker title={label} value={d ? String(d) : ''} placeholder="DD" searchable={false} onChange={(v) => emit(y, m, Number(v))} options={Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} />
      </View>
      <View className="flex-1">
        <Picker title={label} value={y ? String(y) : ''} placeholder="YYYY" onChange={(v) => emit(Number(v), m, d)} options={years.map((v) => ({ value: v, label: v }))} />
      </View>
    </View>
  );
}
