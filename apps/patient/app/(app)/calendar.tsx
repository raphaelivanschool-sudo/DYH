import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { qk, useApiQuery } from '@dyh/api';
import { DAY_SHORT, MONTH_LONG, daysInMonth, parseISO, type Booking } from '@dyh/core';
import { defineMessages, useLang, useT } from '@dyh/i18n';
import { Alert, Badge, Card, Chip, Icon, IconButton, Loading, Row, Screen, SectionTitle, StatusBadge, Txt, cx } from '@dyh/ui-native';
import { BookingQrDialog } from '../../src/components/booking';
import { AppHeader } from '../../src/components/shell';
import { useCatalog, useClock, useDates } from '../../src/lib';
import { pm } from '../../src/msgs';
import { useUi } from '../../src/store';

const m = defineMessages('patient.calendar', {
  appt: ['Iskedyul', 'Appointment'],
  fu: ['Balik-Konsulta', 'Follow-up'],
  upcoming: ['Mga Paparating', 'Upcoming'],
  fuBy: ['Balik-konsulta (in-book ng doktor)', 'Follow-up (booked by doctor)'],
  none: ['Walang paparating na iskedyul', 'No upcoming appointments'],
  tip: ['Pindutin ang iskedyul para makita ang Booking QR. Ang balik-konsulta ay awtomatikong ini-book ng doktor.', 'Tap an appointment to see its Booking QR. Follow-ups are booked automatically by the doctor.'],
});

export default function Calendar() {
  const t = useT(m);
  const p = useT(pm);
  const [lang] = useLang();
  const cat = useCatalog();
  const dt = useDates();
  const { today } = useClock();
  const who = useUi((s) => s.calWho);
  const { data: family } = useApiQuery(qk.family, (a) => a.getFamily());
  const { data: bookings } = useApiQuery(qk.bookings, (a) => a.getMyBookings());
  const [ty, tm] = parseISO(today);
  const [ym, setYm] = useState<[number, number]>([ty, tm + 1 > 11 ? 0 : tm + 1]);
  const [qr, setQr] = useState<Booking | null>(null);
  if (!family || !bookings) return <Loading />;
  const member = family[who] ?? family[0];
  const list = bookings.filter((b) => b.patientId === member.patientId && b.date > today && b.status !== 'cancelled').sort((a, b) => a.date.localeCompare(b.date));
  const [y, mo] = ym;
  const ev = new Map(list.filter((b) => parseISO(b.date)[0] === y && parseISO(b.date)[1] === mo).map((b) => [parseISO(b.date)[2], b.isFollowUp ? 'fu' : 'ev']));
  const lead = new Date(y, mo, 1).getDay();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth(y, mo) }, (_, i) => i + 1)];
  const shift = (n: number) => setYm(([yy, mm]) => (mm + n < 0 ? [yy - 1, 11] : mm + n > 11 ? [yy + 1, 0] : [yy, mm + n]));
  return (
    <Screen header={<AppHeader title={p('calendar')} icon="calendar" />}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {family.map((f, i) => (
          <Chip key={f.patientId} on={i === who} icon={i ? 'user' : 'circle-user-round'} onPress={() => useUi.getState().set({ calWho: i })}>
            {i ? f.displayName.split(' ')[0] : p('me')}
          </Chip>
        ))}
      </ScrollView>
      <Card className="mt-3">
        <Row className="justify-between">
          <IconButton size="sm" icon="chevron-left" label="Prev" onPress={() => shift(-1)} />
          <Txt w="b" size={16}>
            {MONTH_LONG[lang][mo]} {y}
          </Txt>
          <IconButton size="sm" icon="chevron-right" label="Next" onPress={() => shift(1)} />
        </Row>
        <View className="mt-3 flex-row flex-wrap">
          {DAY_SHORT[lang].map((d) => (
            <View key={d} className="w-[14.28%] items-center py-1">
              <Txt w="b" size={11} className="text-muted">
                {d}
              </Txt>
            </View>
          ))}
          {cells.map((d, i) => {
            const k = d ? ev.get(d) : undefined;
            return (
              <View key={i} className="aspect-square w-[14.28%] p-0.5">
                {d && (
                  <View className={cx('flex-1 items-center justify-center rounded-[11px]', k === 'ev' && 'bg-sky', k === 'fu' && 'bg-purple-bg')}>
                    <Txt w={k ? 'x' : 's'} size={13} className={k === 'ev' ? 'text-blue' : k === 'fu' ? 'text-purple' : 'text-ink'}>
                      {d}
                    </Txt>
                    {k && <View className={cx('mt-0.5 h-[5px] w-[5px] rounded-full', k === 'fu' ? 'bg-purple' : 'bg-blue')} />}
                  </View>
                )}
              </View>
            );
          })}
        </View>
        <Row className="mt-3" gap="gap-2.5">
          <Badge tone="blue">● {t('appt')}</Badge>
          <Badge tone="purple">● {t('fu')}</Badge>
        </Row>
      </Card>
      <SectionTitle icon="calendar-clock" right={<Txt size={12.5} className="text-muted">{member.displayName.split(' ')[0]}</Txt>}>
        {t('upcoming')}
      </SectionTitle>
      {list.length ? (
        list.map((b) => {
          const d = cat.doctor(b.doctorId);
          const [, bm, bd] = parseISO(b.date);
          return (
            <Card key={b.id} onPress={() => setQr(b)} className="mb-2 flex-row items-center gap-3">
              <View className="min-w-[58px] items-center">
                <Badge tone={b.isFollowUp ? 'purple' : 'blue'}>
                  {dt.mon(bm)} {bd}
                </Badge>
                <View className="mt-1">
                  <Icon name="qr-code" size={14} color="muted" />
                </View>
              </View>
              <View className="flex-1">
                <Txt w="b">{d?.name}</Txt>
                <Txt size={12.5} className="text-muted">
                  {cat.specName(d)}
                  {b.isFollowUp ? ` · ${t('fuBy')}` : ''}
                </Txt>
              </View>
              <StatusBadge status={b.status} />
            </Card>
          );
        })
      ) : (
        <Card>
          <Txt size={13} className="text-center text-muted">
            {t('none')}
          </Txt>
        </Card>
      )}
      <Alert className="mt-2" text={t('tip')} />
      <BookingQrDialog booking={qr} onClose={() => setQr(null)} />
    </Screen>
  );
}
