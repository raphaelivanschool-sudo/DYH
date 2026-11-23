import { useState } from 'react';
import { View } from 'react-native';
import { useApiMutation, useDoctors, useQueue, useSettings, type KioskScanResult } from '@dyh/api';
import { formatHoursRange } from '@dyh/core';
import { useT } from '@dyh/i18n';
import { Alert, Button, Card, Input, Txt, Viewfinder } from '@dyh/ui-native';
import { KResult, KTitle, endSession, go } from '../../src/components/kit';
import { KPage } from '../../src/components/page';
import { km } from '../../src/msgs';
import { useKiosk } from '../../src/store';

/** Demo codes: a walk-in QR issued before the clinic window, and a booking for another day. */
const DEMO_EARLY = 'WK-261030-050';
const DEMO_OTHER_DAY = 'BK-261112-004';

/**
 * Booking QR or Walk-in QR. A real kiosk reads the code with the camera or a
 * USB scanner (which types into the code field); the demo buttons stand in for it.
 */
export default function Scan() {
  const t = useT(km);
  const [code, setCode] = useState('');
  const [res, setRes] = useState<KioskScanResult | null>(null);
  const { data: settings } = useSettings();
  const { data: doctors } = useDoctors();
  const { data: q1 } = useQueue('d1');
  const expected = q1?.expected[0];
  const scan = useApiMutation((a, c: string) => a.kioskScan(c));

  const run = async (c: string) => {
    if (!c.trim()) return;
    const r = await scan.mutateAsync(c);
    if (r.status === 'issued') {
      useKiosk.getState().set({ result: r });
      go('/slip');
    } else setRes(r);
  };
  const back = (
    <Button size="lg" icon="house" className="mt-6 min-w-[280px]" onPress={() => endSession('/home')}>
      {t('backStart')}
    </Button>
  );

  if (res?.status === 'too_early') {
    const d = doctors?.find((x) => x.id === res.doctorId);
    return (
      <KPage>
        <KResult icon="clock" color="#b26a00" title={t('tooEarly')} body={t('tooEarlySub', { d: d?.name ?? '', h: d ? formatHoursRange(d.hours) : '', o: res.opensAt ?? '' })}>
          {back}
        </KResult>
      </KPage>
    );
  }
  if (res?.status === 'wrong_day')
    return (
      <KPage>
        <KResult icon="calendar-x" color="#c0392b" title={t('noAppt')} body={t('noApptSub')}>
          {back}
        </KResult>
      </KPage>
    );

  return (
    <KPage>
      <KTitle icon="scan-qr-code" title={t('scanBk')} sub={t('scanSub')} />
      <View className="mt-5 flex-row items-start gap-6">
        <View className="flex-1">
          <Viewfinder height={360} label={t('holdQr')} />
          <Card className="mt-4 p-4">
            <Txt w="b" size={14}>
              {t('typeCode')}
            </Txt>
            <View className="mt-2 flex-row gap-2">
              <View className="flex-1">
                <Input value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="BK-261030-021" onSubmitEditing={() => run(code)} accessibilityLabel={t('typeCode')} />
              </View>
              <Button icon="search" disabled={!code.trim()} loading={scan.isPending} onPress={() => run(code)}>
                {t('check')}
              </Button>
            </View>
          </Card>
        </View>
        <View className="flex-1 gap-3">
          <Txt w="b" size={14} className="text-muted">
            {t('demoPick')}
          </Txt>
          <Button variant="g" size="lg" full icon="calendar-check" disabled={!expected} onPress={() => expected && run(expected.bookingId)}>
            {`${t('demoFound')}${expected ? ` · ${expected.patientName}` : ''}`}
          </Button>
          <Button variant="o" size="lg" full icon="clock" onPress={() => run(DEMO_EARLY)}>
            {t('demoEarly')}
          </Button>
          <Button variant="o" size="lg" full icon="calendar-x" onPress={() => run(DEMO_OTHER_DAY)}>
            {t('demoOther')}
          </Button>
          {res?.status === 'not_found' && <Alert kind="danger" icon="circle-x" text={t('notFound')} />}
          {res?.status === 'full' && <Alert kind="danger" icon="ban" text={t('full')} />}
          <Alert kind="info" icon="info" text={t('onlyHere', { n: settings?.scanWindowMinutes ?? 60 })} />
        </View>
      </View>
    </KPage>
  );
}
