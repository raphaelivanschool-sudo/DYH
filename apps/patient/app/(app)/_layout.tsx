import { Redirect, Stack, usePathname } from 'expo-router';
import { View } from 'react-native';
import { useT } from '@dyh/i18n';
import { Fab } from '@dyh/ui-native';
import { AnnouncementPopup } from '../../src/components/announcements';
import { AiGuide, PatientDrawer } from '../../src/components/shell';
import { pm } from '../../src/msgs';
import { useSession, useUi } from '../../src/store';

/** Signed-in area: drawer navigation, AI Guide button, and the post-login announcement pop-up. */
export default function AppLayout() {
  const token = useSession((s) => s.token);
  const annPopup = useUi((s) => s.annPopup);
  const path = usePathname();
  const t = useT(pm);
  if (!token) return <Redirect href="/welcome" />;
  const showFab = !['/qr', '/record'].includes(path);
  return (
    <View className="flex-1">
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
      {showFab && <Fab icon="bot" label={t('aiGuide')} onPress={() => useUi.getState().set({ chat: true })} />}
      <PatientDrawer />
      <AiGuide />
      <AnnouncementPopup key={String(annPopup)} open={annPopup} onClose={() => useUi.getState().set({ annPopup: false })} />
    </View>
  );
}
