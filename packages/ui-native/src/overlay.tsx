import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { Icon } from './icon';
import { SheetBody } from './form';
import { Avatar, cx } from './primitives';
import { Txt } from './text';
import { ThemeScope, useColors } from './theme';

/** Centered dialog with icon + title, scrollable body and an action row ("modal" in the prototype). */
export function Dialog({ open, onClose, title, icon, children, actions, iconColor }: { open: boolean; onClose: () => void; title: string; icon?: string; children?: ReactNode; actions?: ReactNode; iconColor?: string }) {
  const { height } = useWindowDimensions();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <ThemeScope>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-[18px]" onPress={onClose}>
        <Pressable className="w-full max-w-[420px] rounded-3xl bg-card p-5" onPress={() => undefined} style={{ maxHeight: height * 0.86 }}>
          <View className="mb-3 flex-row items-center gap-3">
            {icon && <Avatar icon={icon} size="sm" light={!iconColor} color={iconColor} />}
            <Txt w="b" size={17} className="flex-1">
              {title}
            </Txt>
          </View>
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {actions && <View className="mt-4 flex-row gap-2">{actions}</View>}
        </Pressable>
      </Pressable>
      </ThemeScope>
    </Modal>
  );
}

/** Bottom sheet for longer forms and lists. */
export function Sheet({ open, onClose, title, icon, children }: { open: boolean; onClose: () => void; title?: string; icon?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <ThemeScope>
      <Pressable className="flex-1 bg-black/40" onPress={onClose} />
      <SheetBody title={title} icon={icon} onClose={onClose} bottomInset={insets.bottom}>
        <ScrollView style={{ maxHeight: height * 0.72 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </SheetBody>
      </ThemeScope>
    </Modal>
  );
}

/** Slide-in side navigation (patient and doctor apps). */
export function Drawer({ open, onClose, top, children, footer }: { open: boolean; onClose: () => void; top: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const { width } = useWindowDimensions();
  const w = Math.min(340, width * 0.8);
  const c = useColors();
  const x = useRef(new Animated.Value(-w)).current;
  const insets = useSafeAreaInsets();
  useEffect(() => {
    Animated.timing(x, { toValue: open ? 0 : -w, duration: 220, useNativeDriver: true }).start();
  }, [open, w, x]);
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <ThemeScope>
      <Pressable className="absolute inset-0 bg-black/40" onPress={onClose} />
      <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: w, overflow: 'hidden', borderTopRightRadius: 26, borderBottomRightRadius: 26, backgroundColor: c.card, transform: [{ translateX: x }] }}>
        {top}
        <ScrollView className="flex-1 p-2.5">{children}</ScrollView>
        {footer && <View className="border-t border-line px-4 pt-3" style={{ paddingBottom: 14 + insets.bottom }}>{footer}</View>}
      </Animated.View>
      </ThemeScope>
    </Modal>
  );
}

export function DrawerGroup({ label }: { label: string }) {
  return (
    <Txt w="b" size={10.5} className="mx-2.5 mb-1 mt-3 uppercase text-muted" style={{ letterSpacing: 0.8 }}>
      {label}
    </Txt>
  );
}

export function DrawerItem({ icon, label, on, onPress, badge }: { icon: string; label: string; on?: boolean; onPress: () => void; badge?: number }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} className={cx('flex-row items-center gap-3 rounded-xl p-3', on && 'bg-sky')}>
      <View className="h-[34px] w-[34px] items-center justify-center rounded-[10px]" style={{ backgroundColor: on ? c.primary : c.soft }}>
        <Icon name={icon} size={18} color={on ? '#ffffff' : 'blue'} />
      </View>
      <Txt w="s" size={14.5} className={cx('flex-1', on ? 'text-blue' : 'text-ink')}>
        {label}
      </Txt>
      {!!badge && (
        <View className="min-w-[20px] items-center rounded-full bg-red px-1.5 py-0.5">
          <Txt w="b" size={11} className="text-white">
            {badge}
          </Txt>
        </View>
      )}
    </Pressable>
  );
}

/* ---------------- Toasts ---------------- */

type ToastKind = 'ok' | 'info' | 'warn' | 'error';
const useToastStore = create<{ msg: string | null; kind: ToastKind; n: number }>(() => ({ msg: null, kind: 'ok', n: 0 }));
export const toast = Object.assign((msg: string, kind: ToastKind = 'ok') => useToastStore.setState((s) => ({ msg, kind, n: s.n + 1 })), {
  success: (m: string) => toast(m, 'ok'),
  info: (m: string) => toast(m, 'info'),
  error: (m: string) => toast(m, 'error'),
});

export function ToastHost() {
  const { msg, kind, n } = useToastStore();
  const o = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!msg) return;
    Animated.timing(o, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    const id = setTimeout(() => Animated.timing(o, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => useToastStore.setState({ msg: null })), 2400);
    return () => clearTimeout(id);
  }, [n, msg, o]);
  if (!msg) return null;
  const icon = { ok: 'circle-check', info: 'info', warn: 'triangle-alert', error: 'circle-x' }[kind];
  const color = { ok: '#4ccf97', info: '#82b0ff', warn: '#f2b64a', error: '#ff808a' }[kind];
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', left: 16, right: 16, bottom: 24 + insets.bottom, flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'center', borderRadius: 16, backgroundColor: '#0f2447', paddingHorizontal: 16, paddingVertical: 12, opacity: o, maxWidth: 460, transform: [{ translateY: o.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}
    >
      <Icon name={icon} size={19} color={color} />
      <Txt w="s" size={13.5} className="flex-1 text-white">
        {msg}
      </Txt>
    </Animated.View>
  );
}
