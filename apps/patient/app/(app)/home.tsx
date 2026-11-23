import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { qk, useApiQuery, useNotifications, useQueue } from '@dyh/api';
import { ME, type Booking } from '@dyh/core';
import { common, defineMessages, useT } from '@dyh/i18n';
import { Alert, Avatar, Button, Card, Divider, Gradient, Icon, IconButton, LinkText, Row, Screen, SectionTitle, StatusBadge, Txt } from '@dyh/ui-native';
import { AnnouncementList } from '../../src/components/announcements';
import { BookingQrDialog } from '../../src/components/booking';
import { greetingKey, useCatalog, useClock, useDates } from '../../src/lib';
import { pm } from '../../src/msgs';
import { useUi } from '../../src/store';

const m = defineMessages('patient.home', {
  services: ['Mga Serbisyo', 'Services'],
  upcoming: ['Susunod na Iskedyul', 'Upcoming Appointment'],
  familyNote: ['Ang iskedyul ng pamilya ay nasa pahina ng Pamilya.', 'Family schedules are on the Family page.'],
  yourNum: ['Iyong numero (na-scan {{t}})', 'Your number (scanned {{t}})'],
  viewQueue: ['Tingnan ang Live na Pila', 'View Live Queue'],
  walkinOnly: ['Walk-in lamang muna.', 'Walk-in only for now.'],
  walkinOnlySub: ['Dahil sa hindi pagsipot, kailangan munang matapos ang isang walk-in na konsulta bago maibalik ang online.', 'Because of a no-show, complete one walk-in consultation before online booking is restored.'],
  followUp: ['Balik-konsulta', 'Follow-up'],
  consult: ['Konsultasyon', 'Consultation'],
  noUpcoming: ['Walang paparating na iskedyul', 'No upcoming appointments'],
});

/** Today's live queue card for the signed-in patient (shown once their QR was scanned at the Kiosk). */
function LiveHero({ b }: { b: Booking }) {
  const t = useT(m);
  const p = useT(pm);
  const tc = useT(common);
  const cat = useCatalog();
  const d = cat.doctor(b.doctorId);
  const { data: q } = useQueue(b.doctorId);
  const pos = q ? q.waiting.findIndex((e) => e.number === b.queueNumber) : -1;
  const serving = q?.serving?.number ?? cat.live(b.doctorId)?.nowServing ?? '—';
  return (
    <Gradient colors={['#1f56b0', '#17325f']} className="overflow-hidden rounded-[22px] p-[18px]">
      <View className="absolute -right-10 -top-10 h-40 w-40 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }} />
      <Row className="justify-between">
        <View className="flex-row items-center gap-1 rounded-full px-2.5 py-1" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}>
          <Icon name="radio" size={12} color="#ffffff" />
          <Txt w="b" size={11} className="text-white">
            LIVE · {tc(b.type)}
          </Txt>
        </View>
        <Row gap="gap-1">
          <Icon name="door-open" size={14} color="#ffffffd9" />
          <Txt size={12.5} className="text-white" style={{ opacity: 0.85 }}>
            {p('room')} {d?.room}
          </Txt>
        </Row>
      </Row>
      <Row className="mt-3 items-end" gap="gap-[18px]">
        <View>
          <Txt size={12.5} className="text-white" style={{ opacity: 0.8 }}>
            {t('yourNum', { t: '7:42 AM' })}
          </Txt>
          <Txt w="x" size={44} className="text-white" style={{ letterSpacing: -1, lineHeight: 48 }}>
            {b.queueNumber}
          </Txt>
        </View>
        <View className="pb-1">
          <Txt size={12.5} className="text-white" style={{ opacity: 0.8 }}>
            {tc('nowServing')}
          </Txt>
          <Txt w="x" size={22} className="text-white">
            {serving}
          </Txt>
        </View>
      </Row>
      <Txt size={12.5} className="mt-2 text-white" style={{ opacity: 0.9 }}>
        {d?.name} · {p('patientsAhead', { n: Math.max(0, pos) })}
      </Txt>
      <Button variant="w" full icon="list-ordered" iconRight="chevron-right" className="mt-3" onPress={() => router.navigate('/queue')}>
        {t('viewQueue')}
      </Button>
    </Gradient>
  );
}

export default function Home() {
  const t = useT(m);
  const p = useT(pm);
  const tc = useT(common);
  const cat = useCatalog();
  const dt = useDates();
  const { today, hour } = useClock();
  const noShow = useUi((s) => s.noShow);
  const { data: bookings } = useApiQuery(qk.bookings, (a) => a.getMyBookings());
  const { data: notifs } = useNotifications('patient');
  const [qr, setQr] = useState<Booking | null>(null);
  const mine = (bookings ?? []).filter((b) => b.patientId === ME.id);
  const live = mine.find((b) => b.date === today && b.queueNumber && b.status !== 'done' && b.status !== 'cancelled');
  const next = mine.filter((b) => b.date > today && b.status !== 'cancelled').sort((a, b) => a.date.localeCompare(b.date))[0];
  const nd = cat.doctor(next?.doctorId);
  const services: [string, string, string][] = [
    ['calendar-plus', p('book'), '/book'],
    ['list-ordered', p('liveQueue'), '/queue'],
    ['qr-code', p('myQrShort'), '/qr'],
    ['file-text', p('records'), '/record'],
    ['calendar', p('calendar'), '/calendar'],
    ['users', p('family'), '/family'],
    ['stethoscope', tc('doctors'), '/doctors'],
    ['megaphone', p('news'), 'ann'],
  ];
  return (
    <Screen
      header={
        <Row className="px-[18px] pb-3 pt-1.5" gap="gap-2.5">
          <IconButton icon="menu" label={tc('menu')} onPress={() => useUi.getState().set({ drawer: true })} />
          <Avatar text="JD" />
          <View className="flex-1">
            <Txt size={12.5} className="text-muted">
              {p(greetingKey(hour))},
            </Txt>
            <Txt w="b" size={17}>
              {ME.name.first} {ME.name.last}
            </Txt>
          </View>
          <IconButton icon="bell" label={p('notifs')} dot={!!notifs?.some((n) => n.unread)} onPress={() => router.navigate('/notifications')} />
        </Row>
      }
    >
      {noShow && <Alert kind="warn" className="mb-3" text={`**${t('walkinOnly')}** ${t('walkinOnlySub')}`} />}
      {live && <LiveHero b={live} />}
      <SectionTitle icon="layout-grid">{t('services')}</SectionTitle>
      <View className="flex-row flex-wrap justify-between gap-y-3.5">
        {services.map(([i, l, path]) => (
          <Pressable key={path + l} accessibilityRole="button" onPress={() => (path === 'ann' ? useUi.getState().set({ annPopup: true }) : router.navigate(path as never))} className="w-[23%] items-center gap-[7px]">
            <View className="h-[58px] w-[58px] items-center justify-center rounded-[18px] border border-line bg-card">
              <Icon name={i} size={24} color="blue" />
            </View>
            <Txt w="s" size={11.5} className="text-center" numberOfLines={2} style={{ lineHeight: 14 }}>
              {l}
            </Txt>
          </Pressable>
        ))}
      </View>
      <SectionTitle icon="calendar-clock" right={<LinkText onPress={() => router.navigate('/calendar')}>{tc('all')}</LinkText>}>
        {t('upcoming')}
      </SectionTitle>
      {next && nd ? (
        <Card onPress={() => setQr(next)}>
          <Row gap="gap-3">
            <Avatar icon={cat.specIcon(nd)} light />
            <View className="flex-1">
              <Txt w="b">{nd.name}</Txt>
              <Txt size={12.5} className="text-muted">
                {cat.specName(nd)} · {next.isFollowUp ? t('followUp') : t('consult')}
              </Txt>
            </View>
            <StatusBadge status={next.status} />
          </Row>
          <Divider />
          <Row className="justify-between">
            <Row gap="gap-1.5">
              <Icon name="calendar" size={15} color="muted" />
              <Txt size={12.5}>{dt.dayDate(next.date)}</Txt>
            </Row>
            <Row gap="gap-1.5">
              <Icon name="door-open" size={15} color="muted" />
              <Txt size={12.5}>
                {p('room')} {nd.room}
              </Txt>
            </Row>
            <Row gap="gap-1">
              <Icon name="qr-code" size={15} color="blue" />
              <Txt w="b" size={12.5} className="text-blue">
                {p('bookingQr')}
              </Txt>
            </Row>
          </Row>
        </Card>
      ) : (
        <Card>
          <Txt className="text-center text-muted">{t('noUpcoming')}</Txt>
        </Card>
      )}
      <Row gap="gap-1" className="mt-2">
        <Icon name="users" size={13} color="muted" />
        <Txt size={11.5} className="text-muted">
          {t('familyNote')}
        </Txt>
      </Row>
      <SectionTitle icon="megaphone">{p('announcements')}</SectionTitle>
      <AnnouncementList />
      <View className="h-16" />
      <BookingQrDialog booking={qr} onClose={() => setQr(null)} />
    </Screen>
  );
}
