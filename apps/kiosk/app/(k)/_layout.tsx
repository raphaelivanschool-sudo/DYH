import { Stack } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KioskHeader } from '../../src/components/kit';

/** Every visitor screen: header on top, content below. */
export default function KioskLayout() {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-card">
      <KioskHeader />
      <View className="flex-1 bg-scr">
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
      </View>
    </SafeAreaView>
  );
}
