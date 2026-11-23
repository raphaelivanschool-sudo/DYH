import { router } from 'expo-router';
import { common, useT } from '@dyh/i18n';
import { Alert, Button, Header, Screen, SectionTitle } from '@dyh/ui-native';
import { AnnouncementList } from '../src/components/announcements';
import { DoctorDirectory, openDoctor } from '../src/components/doctor';
import { pm } from '../src/msgs';

/** Browse doctors and announcements without an account. Booking asks to log in. */
export default function Guest() {
  const t = useT(pm);
  useT(common);
  return (
    <Screen
      header={
        <Header
          title="Guest"
          icon="eye"
          onBack={() => router.back()}
          right={
            <Button size="sm" icon="log-in" onPress={() => router.replace('/welcome')}>
              {t('login')}
            </Button>
          }
        />
      }
    >
      <Alert text={t('guestNote')} />
      <SectionTitle icon="megaphone">{t('announcements')}</SectionTitle>
      <AnnouncementList />
      <DoctorDirectory onOpen={openDoctor} />
    </Screen>
  );
}
