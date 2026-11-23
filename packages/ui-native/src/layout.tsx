import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { common, useT } from '@dyh/i18n';
import { Icon } from './icon';
import { Avatar, Gradient, IconButton, cx } from './primitives';
import { Txt } from './text';

/** A screen: safe area, optional sticky header, scrollable padded body. */
export function Screen({ header, children, scroll = true, className, footer, contentClassName, ...sv }: { header?: ReactNode; children: ReactNode; scroll?: boolean; className?: string; footer?: ReactNode; contentClassName?: string } & ScrollViewProps) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} className={cx('flex-1 bg-scr', className)}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {header}
        {scroll ? (
          <ScrollView className="flex-1" contentContainerClassName={cx('px-[18px] pb-14', contentClassName)} keyboardShouldPersistTaps="handled" {...sv}>
            {children}
          </ScrollView>
        ) : (
          <View className="flex-1">{children}</View>
        )}
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** App bar ("ahead"): menu or back button, icon + title, right slot. */
export function Header({ title, icon, onBack, onMenu, right, className }: { title?: string; icon?: string; onBack?: () => void; onMenu?: () => void; right?: ReactNode; className?: string }) {
  const t = useT(common);
  return (
    <View className={cx('flex-row items-center gap-2.5 bg-scr px-[18px] pb-3 pt-1.5', className)}>
      {onMenu && <IconButton icon="menu" label={t('menu')} onPress={onMenu} />}
      {!onMenu && onBack && <IconButton icon="chevron-left" label={t('back')} onPress={onBack} />}
      <View className="flex-1 flex-row items-center gap-2">
        {icon && <Icon name={icon} size={20} color="blue" />}
        {title && (
          <Txt w="b" size={18} className="flex-1" numberOfLines={1}>
            {title}
          </Txt>
        )}
      </View>
      {right}
    </View>
  );
}

/** Success / result screen (okScreen). */
export function ResultView({ icon, color = '#12805a', title, message, children }: { icon: string; color?: string; title: string; message?: string; children?: ReactNode }) {
  return (
    <View className="items-center pt-12">
      <Avatar icon={icon} size="xl" color={color} />
      <Txt w="x" size={22} className="mt-5 text-center">
        {title}
      </Txt>
      {message && <Txt className="mt-2 text-center text-muted">{message}</Txt>}
      <View className="mt-2 w-full items-center">{children}</View>
    </View>
  );
}

/** Floating action button (AI Guide). */
export function Fab({ icon, onPress, label, bottom = 30 }: { icon: string; onPress: () => void; label: string; bottom?: number }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} className="absolute right-4" style={{ bottom, borderRadius: 20, shadowColor: '#0f2447', shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 10 }, elevation: 8 }}>
      <Gradient style={{ width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={26} color="#ffffff" />
      </Gradient>
    </Pressable>
  );
}

export function Center({ children, className }: { children: ReactNode; className?: string }) {
  return <View className={cx('items-center', className)}>{children}</View>;
}
