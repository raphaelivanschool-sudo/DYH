import { common, useT } from '@dyh/i18n';
import { Screen } from '@dyh/ui-native';
import { DoctorDirectory, openDoctor } from '../../src/components/doctor';
import { AppHeader } from '../../src/components/shell';

export default function Doctors() {
  const tc = useT(common);
  return (
    <Screen header={<AppHeader title={tc('doctors')} icon="stethoscope" />}>
      <DoctorDirectory onOpen={openDoctor} />
    </Screen>
  );
}
