import * as ScreenCapture from 'expo-screen-capture';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { qk, useApi, useApiQuery } from '@dyh/api';
import { RELATION_LABEL } from '@dyh/core';
import { defineMessages, useLoc, useT } from '@dyh/i18n';
import { Alert, Button, Card, Chip, IconButton, Loading, QR, Row, Screen, Txt, Icon, toast } from '@dyh/ui-native';
import { PinGate } from '../../src/components/auth';
import { AppHeader } from '../../src/components/shell';
import { pm } from '../../src/msgs';
import { useUi } from '../../src/store';

const m = defineMessages('patient.qr', {
  required: ['Kailangan ito bago ipakita ang QR na rekord.', 'Required before showing your QR record.'],
  expires: ['Mag-e-expire sa', 'Expires in'],
  newQr: ['Bagong QR Code', 'New QR Code'],
  newQrToast: ['Bagong QR code na-generate', 'New QR code generated'],
  forDoctor: ['Para ito sa **doktor** — ang pagpapakita nito ay nagsisilbing **pahintulot** na makita ang iyong kasaysayang medikal. Sa Kiosk, gamitin ang **Booking QR** ng iyong appointment.', 'This is for your **doctor** — showing it serves as your **consent** to open your medical history. At the Kiosk, use your appointment’s **Booking QR**.'],
  noShots: ['Naka-block ang screenshot. Ang app ng ospital lamang ang makakabasa ng QR.', 'Screenshots are blocked. Only the hospital app can read this QR.'],
});

/** Rotating Record QR (PIN-gated, screenshots blocked) per family member. */
export default function RecordQr() {
  const t = useT(m);
  const p = useT(pm);
  const loc = useLoc();
  const api = useApi();
  const unlocked = useUi((s) => s.qrUnlocked);
  const who = useUi((s) => s.qrWho);
  const { data: family } = useApiQuery(qk.family, (a) => a.getFamily());
  const member = family?.[who] ?? family?.[0];
  const [qr, setQr] = useState<{ token: string; expiresInSec: number } | null>(null);
  const [left, setLeft] = useState(0);
  const refresh = async (toastIt = false) => {
    if (!member) return;
    const r = await api.getRecordQr(member.patientId);
    setQr(r);
    setLeft(r.expiresInSec);
    if (toastIt) toast.success(t('newQrToast'));
  };
  useEffect(() => {
    if (unlocked) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, member?.patientId]);
  useEffect(() => {
    if (!unlocked) return;
    const id = setInterval(() => setLeft((s) => (s <= 1 ? (void refresh(), 0) : s - 1)), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, member?.patientId]);
  useEffect(() => {
    if (Platform.OS === 'web' || !unlocked) return;
    void ScreenCapture.preventScreenCaptureAsync('record-qr');
    return () => void ScreenCapture.allowScreenCaptureAsync('record-qr');
  }, [unlocked]);

  const lock = () => useUi.getState().set({ qrUnlocked: false });
  return (
    <Screen header={<AppHeader title={p('myQr')} icon="qr-code" right={unlocked ? <IconButton icon="lock" label={p('lock')} onPress={lock} /> : undefined} />}>
      {!unlocked ? (
        <PinGate title={p('enterPin')} sub={t('required')} onUnlock={() => useUi.getState().set({ qrUnlocked: true })} />
      ) : !family || !member ? (
        <Loading />
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 mx-auto">
            {family.map((f, i) => (
              <Chip key={f.patientId} on={i === who} icon={i ? 'user' : 'circle-user-round'} onPress={() => useUi.getState().set({ qrWho: i })}>
                {f.displayName.split(' ')[0]}
              </Chip>
            ))}
          </ScrollView>
          <Card className="mt-3 items-center p-[22px]">
            <Txt w="b" size={17}>
              {member.displayName}
            </Txt>
            <Txt size={12.5} className="text-muted">
              {member.patientId} · {member.relation === 'self' ? p('me') : loc(RELATION_LABEL[member.relation])}
            </Txt>
            <View className="mt-4">{qr ? <QR value={qr.token} size={210} /> : <Loading className="py-20" />}</View>
            <Row className="mt-3" gap="gap-1.5">
              <Icon name="timer" size={17} color="amber" />
              <Txt w="b" className="text-amber">
                {t('expires')} 0:{String(left).padStart(2, '0')}
              </Txt>
            </Row>
            <Button variant="g" full icon="refresh-cw" className="mt-3" onPress={() => refresh(true)}>
              {t('newQr')}
            </Button>
          </Card>
          <View className="mt-3 gap-2.5">
            <Alert icon="shield-check" text={t('forDoctor')} />
            <Alert kind="warn" icon="eye-off" text={t('noShots')} />
          </View>
        </>
      )}
    </Screen>
  );
}
