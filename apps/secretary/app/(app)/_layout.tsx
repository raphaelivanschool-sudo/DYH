import { Redirect, Stack, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { DoctorSheet, SecretaryDrawer } from '../../src/components/shell';
import { useSession, useUi } from '../../src/store';

export default function AppLayout() {
  const token = useSession((s) => s.token);
  const path = usePathname();
  // Leaving the vitals screen closes any open vitals form.
  useEffect(() => {
    if (path !== '/vitals') useUi.getState().set({ vitalsFor: null });
  }, [path]);
  if (!token) return <Redirect href="/login" />;
  return (
    <View className="flex-1">
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
      <SecretaryDrawer />
      <DoctorSheet />
    </View>
  );
}
