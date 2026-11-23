import '../global.css';
import { Stack } from 'expo-router';
import { DyhAppRoot } from '@dyh/ui-native';
import { api } from '../src/api';

export default function Root() {
  return (
    <DyhAppRoot api={api} prefsKey="dyh-doctor-prefs">
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
    </DyhAppRoot>
  );
}
