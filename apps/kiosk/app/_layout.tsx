import '../global.css';
import { useKeepAwake } from 'expo-keep-awake';
import { Stack } from 'expo-router';
import { DyhAppRoot } from '@dyh/ui-native';
import { api } from '../src/api';
import { IdleWatcher } from '../src/components/kit';

export default function Root() {
  // A kiosk screen must never sleep.
  useKeepAwake();
  return (
    <DyhAppRoot api={api} prefsKey="dyh-kiosk-prefs">
      <IdleWatcher>
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
      </IdleWatcher>
    </DyhAppRoot>
  );
}
