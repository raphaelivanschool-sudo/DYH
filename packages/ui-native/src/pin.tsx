import { Pressable, View } from 'react-native';
import { Icon } from './icon';
import { cx } from './primitives';
import { Txt } from './text';
import { useColors } from './theme';

export function PinDots({ value, length = 6 }: { value: string; length?: number }) {
  const c = useColors();
  return (
    <View className="mt-[18px] flex-row justify-center gap-3.5" accessibilityLabel={`${value.length}/${length}`}>
      {Array.from({ length }, (_, i) => (
        <View key={i} className="h-4 w-4 rounded-full border-2" style={{ borderColor: c.ink, backgroundColor: i < value.length ? c.ink : 'transparent' }} />
      ))}
    </View>
  );
}

/** Numeric keypad. `onBio` shows a fingerprint key in the bottom-left. */
export function Keypad({ onKey, onDelete, onBio, className }: { onKey: (d: string) => void; onDelete: () => void; onBio?: () => void; className?: string }) {
  const Key = ({ children, onPress, label }: { children: React.ReactNode; onPress?: () => void; label: string }) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} className="h-[62px] w-[30%] items-center justify-center rounded-[18px] bg-card" style={({ pressed }) => (pressed ? { opacity: 0.6 } : undefined)}>
      {children}
    </Pressable>
  );
  return (
    <View className={cx('mx-auto mt-6 w-full max-w-[300px] flex-row flex-wrap justify-between gap-y-3', className)}>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
        <Key key={n} label={n} onPress={() => onKey(n)}>
          <Txt w="b" size={24}>
            {n}
          </Txt>
        </Key>
      ))}
      {onBio ? (
        <Key label="Fingerprint" onPress={onBio}>
          <Icon name="fingerprint" size={26} color="blue" />
        </Key>
      ) : (
        <View className="w-[30%]" />
      )}
      <Key label="0" onPress={() => onKey('0')}>
        <Txt w="b" size={24}>
          0
        </Txt>
      </Key>
      <Key label="Delete" onPress={onDelete}>
        <Icon name="delete" size={24} />
      </Key>
    </View>
  );
}
