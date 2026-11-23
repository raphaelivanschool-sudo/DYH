import { View } from 'react-native';
import { useSettings } from '@dyh/api';
import { scanOpensAtLabel, type Booking } from '@dyh/core';
import { common, useT } from '@dyh/i18n';
import { Button, Dialog, Icon, QR, Rich, Row, Rows, StatusBadge, Txt, toast } from '@dyh/ui-native';
import { useCatalog, useDates } from '../lib';
import { pm } from '../msgs';

/** "Booking ≠ Queue Number" explainer (bqExplain). */
export function BookingExplain({ compact }: { compact?: boolean }) {
  const t = useT(pm);
  const { data: s } = useSettings();
  const n = s?.scanWindowMinutes ?? 60;
  const Step = ({ k, title, body }: { k: number; title: string; body: string }) => (
    <Row className="items-start" gap="gap-2.5">
      <View className="h-6 w-6 items-center justify-center rounded-full bg-primary">
        <Txt w="x" size={12} className="text-white">
          {k}
        </Txt>
      </View>
      <View className="flex-1">
        <Txt w="b" size={13.5}>
          {title}
        </Txt>
        <Rich text={body} size={12} className="text-muted" />
      </View>
    </Row>
  );
  return (
    <View className="rounded-2xl border-[1.5px] border-blue-2 bg-sky-2 p-3.5">
      <Row gap="gap-1.5">
        <Icon name="info" size={17} color="blue" />
        <Txt w="b" size={14} className="text-blue">
          {t('bqTitle')}
        </Txt>
      </Row>
      <View className="mt-2.5 gap-1.5">
        <Step k={1} title={t('bq1')} body={t('bq1d')} />
        <View className="ml-1.5">
          <Icon name="arrow-down" size={16} color="muted" />
        </View>
        <Step k={2} title={t('bq2')} body={t('bq2d', { n })} />
      </View>
      {!compact && (
        <Txt size={11.5} className="mt-2 text-muted">
          {t('bqNote')}
        </Txt>
      )}
    </View>
  );
}

/** Booking QR for an appointment (scanned at the Kiosk to get a queue number). */
export function BookingQrDialog({ booking, onClose }: { booking: Booking | null; onClose: () => void }) {
  const t = useT(pm);
  const tc = useT(common);
  const cat = useCatalog();
  const dt = useDates();
  const { data: s } = useSettings();
  const d = cat.doctor(booking?.doctorId);
  return (
    <Dialog
      open={!!booking}
      onClose={onClose}
      title={t('bookingQr')}
      icon="qr-code"
      actions={
        <>
          <Button variant="g" className="flex-1" icon="download" onPress={() => toast.success(t('downloaded'))}>
            {t('download')}
          </Button>
          <Button className="flex-1" onPress={onClose}>
            {tc('close')}
          </Button>
        </>
      }
    >
      {booking && d && (
        <>
          <QR value={`DYH-BK:${booking.id}`} size={180} />
          <Txt w="x" className="mt-2 text-center" style={{ letterSpacing: 1 }}>
            {booking.id}
          </Txt>
          <View className="mt-1 items-center">
            <StatusBadge status={booking.status} />
          </View>
          <View className="mt-3">
            <Rows
              rows={[
                ['user', tc('patient'), booking.patientName],
                ['stethoscope', tc('doctor'), d.name],
                ['door-open', t('room'), `${d.room} · ${t('floor')} ${d.floor}`],
                ['calendar', tc('date'), dt.dayDate(booking.date)],
                ['scan-qr-code', t('scanOpens'), scanOpensAtLabel(d, s?.scanWindowMinutes ?? 60)],
                ['ticket', t('queueNumber'), booking.queueNumber ?? t('noneYet')],
              ]}
            />
          </View>
          <Txt size={12} className="mt-2 text-center text-muted">
            {t('bkqrHint')}
          </Txt>
        </>
      )}
    </Dialog>
  );
}
