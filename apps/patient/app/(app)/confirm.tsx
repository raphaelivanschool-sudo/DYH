import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { qk, useApiMutation, useApiQuery } from '@dyh/api';
import { RELATION_LABEL } from '@dyh/core';
import { common, defineMessages, useLoc, useT } from '@dyh/i18n';
import { Alert, Avatar, Button, Card, Dialog, Header, Icon, Loading, Mark, ResultView, Rich, Row, Screen, Txt, toast } from '@dyh/ui-native';
import { BookingQrDialog } from '../../src/components/booking';
import { useCatalog, useDates } from '../../src/lib';
import { pm } from '../../src/msgs';
import { useUi } from '../../src/store';

const m = defineMessages('patient.confirm', {
  title: ['Pagkumpirma', 'Confirmation'],
  reminder: ['Paalala: Bukas ang iskedyul ni {{name}} kay {{doc}}. Pakikumpirma.', 'Reminder: {{name}} has an appointment with {{doc}} tomorrow. Please confirm.'],
  tomorrow: ['Bukas na ang iskedyul!', 'Your appointment is tomorrow!'],
  viewQr: ['Tingnan ang Booking QR', 'View Booking QR'],
  confirmAppt: ['Kumpirmahin ang Iskedyul', 'Confirm Appointment'],
  reschedule: ['Ilipat', 'Reschedule'],
  noReply: ['Kung hindi ka sasagot, **mananatili** ang iskedyul, pero lalabas itong **Hindi Kumpirmado** sa ospital.', 'If you do not respond, the appointment **stays**, but it shows as **Unconfirmed** to the hospital.'],
  confirmed: ['Kumpirmado na!', 'Confirmed!'],
  confirmedSub: ['Kita tayo sa {{date}} sa Kuwarto {{room}}. I-scan ang Booking QR sa Kiosk pagdating.', 'See you on {{date}} at Room {{room}}. Scan your Booking QR at the Kiosk on arrival.'],
  cancelQ: ['Kanselahin ang iskedyul?', 'Cancel this appointment?'],
  cancelBody: ['Ibabalik ang puwesto sa online. Puwedeng magkansela hanggang **{{n}} oras** bago ang iskedyul.', 'The slot returns to the online pool. You may cancel up to **{{n}} hours** before the appointment.'],
  keep: ['Huwag', 'Keep it'],
  yesCancel: ['Oo, Kanselahin', 'Yes, Cancel'],
  cancelled: ['Nakansela ang iskedyul', 'Appointment cancelled'],
  confirmedToast: ['Nakumpirma ang iskedyul', 'Appointment confirmed'],
});

/** Day-before confirmation (opened from the reminder notification). Demo: Sofia's Nov 5 booking. */
export default function Confirm() {
  const t = useT(m);
  const p = useT(pm);
  const tc = useT(common);
  const loc = useLoc();
  const cat = useCatalog();
  const dt = useDates();
  const { data: bookings } = useApiQuery(qk.bookings, (a) => a.getMyBookings());
  const { data: family } = useApiQuery(qk.family, (a) => a.getFamily());
  const confirm = useApiMutation((api, id: string) => api.confirmBooking(id), [qk.bookings]);
  const cancel = useApiMutation((api, id: string) => api.cancelBooking(id), [qk.bookings]);
  const [qr, setQr] = useState(false);
  const [ask, setAsk] = useState(false);
  const b = bookings?.find((x) => x.id === 'BK-261105-007');
  const d = cat.doctor(b?.doctorId);
  const who = family?.find((f) => f.patientId === b?.patientId);
  const header = <Header title={t('title')} icon="calendar-check" onBack={() => router.navigate('/home')} />;
  if (!b || !d || !who) return <Screen header={header}><Loading /></Screen>;
  if (b.status === 'confirmed')
    return (
      <Screen>
        <ResultView icon="calendar-check" title={t('confirmed')} message={t('confirmedSub', { date: dt.dayDate(b.date), room: d.room })}>
          <Button size="lg" full icon="house" className="mt-6" onPress={() => router.navigate('/home')}>
            {p('backHome')}
          </Button>
        </ResultView>
      </Screen>
    );
  const first = who.displayName.split(' ')[0];
  return (
    <Screen header={header}>
      <Card lift className="flex-row items-start gap-3 rounded-[18px] p-3.5">
        <Mark height={28} />
        <View className="flex-1">
          <Row className="justify-between">
            <Txt w="b" size={12.5}>
              DYH Patient App
            </Txt>
            <Txt size={11} className="text-muted">
              9:00 AM
            </Txt>
          </Row>
          <Txt size={12.5} className="mt-1">
            {t('reminder', { name: first, doc: d.name })}
          </Txt>
        </View>
      </Card>
      <Card className="mt-4 items-center p-[22px]">
        <Avatar icon="calendar-clock" size="xl" />
        <Txt w="b" size={18} className="mt-3">
          {t('tomorrow')}
        </Txt>
        <View className="mt-4 w-full gap-2.5">
          {(
            [
              ['user', `${who.displayName} (${loc(RELATION_LABEL[who.relation])})`],
              ['stethoscope', `${d.name} · ${cat.specName(d)}`],
              ['calendar', dt.dayDate(b.date)],
              ['qr-code', `${p('bookingQr')}: ${b.id}`],
              ['door-open', `${p('room')} ${d.room}, ${p('floor')} ${d.floor}`],
            ] as const
          ).map(([i, v]) => (
            <Row key={i}>
              <Icon name={i} size={18} color="blue" />
              <Txt w="b" className="flex-1">
                {v}
              </Txt>
            </Row>
          ))}
        </View>
      </Card>
      <Button variant="g" full icon="qr-code" className="mt-4" onPress={() => setQr(true)}>
        {t('viewQr')}
      </Button>
      <Button
        variant="ok"
        size="lg"
        full
        icon="check"
        className="mt-2"
        loading={confirm.isPending}
        onPress={async () => {
          await confirm.mutateAsync(b.id);
          toast.success(t('confirmedToast'));
        }}
      >
        {t('confirmAppt')}
      </Button>
      <Row className="mt-2">
        <Button
          variant="o"
          className="flex-1"
          icon="calendar-arrow-up"
          onPress={() => {
            useUi.getState().startBook({ step: 4, who: who.patientId, spec: d.specializationId, doctor: d.id });
            router.navigate('/book');
          }}
        >
          {t('reschedule')}
        </Button>
        <Button variant="r" className="flex-1" icon="x" onPress={() => setAsk(true)}>
          {tc('cancel')}
        </Button>
      </Row>
      <Alert kind="warn" className="mt-4" text={t('noReply')} />
      <BookingQrDialog booking={qr ? b : null} onClose={() => setQr(false)} />
      <Dialog
        open={ask}
        onClose={() => setAsk(false)}
        title={t('cancelQ')}
        icon="calendar-x"
        actions={
          <>
            <Button variant="o" className="flex-1" onPress={() => setAsk(false)}>
              {t('keep')}
            </Button>
            <Button
              variant="r"
              className="flex-1"
              icon="x"
              onPress={async () => {
                setAsk(false);
                await cancel.mutateAsync(b.id);
                toast.info(t('cancelled'));
                router.navigate('/calendar');
              }}
            >
              {t('yesCancel')}
            </Button>
          </>
        }
      >
        <Rich text={t('cancelBody', { n: 2 })} className="text-muted" />
      </Dialog>
    </Screen>
  );
}
