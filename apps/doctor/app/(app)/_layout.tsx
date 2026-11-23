import { Redirect, Stack, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { DoctorDrawer, SecurityHost } from '../../src/components/shell';
import { useSession, useUi } from '../../src/store';

/** Signed-in area. Leaving the record flow or reports locks them again. */
export default function AppLayout() {
  const token = useSession((s) => s.token);
  const path = usePathname();
  useEffect(() => {
    const s = useUi.getState();
    if (!['/record', '/consult', '/followup'].includes(path) && s.recordOpen) s.set({ recordOpen: false });
    if (path !== '/reports' && s.reportsOpen) s.set({ reportsOpen: false });
  }, [path]);
  if (!token) return <Redirect href="/login" />;
  return (
    <View className="flex-1">
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
      <DoctorDrawer />
      <SecurityHost />
    </View>
  );
}
