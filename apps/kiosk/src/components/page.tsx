import { type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

/** Scrollable kiosk page with a readable maximum width. */
export function KPage({ children, max = 1180 }: { children: ReactNode; max?: number }) {
  return (
    <ScrollView contentContainerClassName="px-8 pb-12 pt-7" keyboardShouldPersistTaps="handled">
      <View className="w-full self-center" style={{ maxWidth: max }}>
        {children}
      </View>
    </ScrollView>
  );
}
