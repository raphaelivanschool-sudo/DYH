import { router } from 'expo-router';
import { useApi, useSettings } from '@dyh/api';
import { useT } from '@dyh/i18n';
import { StaffLogin, toast } from '@dyh/ui-native';
import { dm } from '../src/msgs';
import { useSession } from '../src/store';

export default function Login() {
  const api = useApi();
  const t = useT(dm);
  const { data: settings } = useSettings();
  return (
    <StaffLogin
      appLabel={t('appName')}
      icon="stethoscope"
      email="m.santos@dyh.ph"
      maskedMobile="0917 ••• 3381"
      autoLogoutMin={settings?.autoLogoutMinutes.doctor ?? 10}
      onLogin={async (how) => {
        try {
          const s = await api.login('doctor', how === 'bio' ? { biometric: true } : { id: how.email, secret: how.password });
          useSession.getState().signIn(s.token, s.userId, s.displayName);
          router.replace('/home');
        } catch (e) {
          toast.error((e as Error).message);
        }
      }}
    />
  );
}
