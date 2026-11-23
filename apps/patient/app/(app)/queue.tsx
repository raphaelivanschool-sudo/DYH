import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { qk, useApiQuery, useQueue } from '@dyh/api';
import { ME } from '@dyh/core';
import { common, defineMessages, statusLabel, useT } from '@dyh/i18n';
import { Alert, Badge, Card, Empty, Icon, Loading, Mark, Row, Screen, Stat, TypeBadge, Txt, cx, useColors } from '@dyh/ui-native';
import { AppHeader } from '../../src/components/shell';
import { useCatalog, useClock } from '../../src/lib';
import { pm } from '../../src/msgs';

const m = defineMessages('patient.queue', {
  now: ['ngayon', 'now'],
  coming: ['Malapit na ang turn mo!', 'Your turn is coming up!'],
  comingSub: ['{{n}} pasyente na lang bago ka sa Kuwarto {{room}}.', 'Only {{n}} patients ahead of you in Room {{room}}.'],
  yourNumber: ['Iyong Numero', 'Your Number'],
  directions: ['Sa kanan paglabas ng elevator', 'To the right when exiting the elevator'],
  roomFloor: ['Kuwarto {{room}}, Palapag {{floor}}', 'Room {{room}}, Floor {{floor}}'],
  notify: ['Aabisuhan ka kapag **3 pasyente** na lang at kapag **turn mo na**.', 'You will be notified when **3 patients** remain and when it is **your turn**.'],
  none: ['Wala kang numero sa pila ngayon. I-scan ang Booking QR sa Kiosk pagdating.', 'You have no queue number today. Scan your Booking QR at the Kiosk on arrival.'],
});

const FLOW = [['booked', 'check'], ['confirmed', 'check'], ['arrived', 'map-pin-check'], ['in_consultation', 'stethoscope'], ['done', 'flag']] as const;

function Ring({ pct, children }: { pct: number; children: React.ReactNode }) {
  const c = useColors();
  const r = 86;
  const len = 2 * Math.PI * r;
  return (
    <View className="my-2 h-[190px] w-[190px] items-center justify-center self-center">
      <Svg width={190} height={190} style={{ position: 'absolute' }}>
        <Circle cx={95} cy={95} r={r} stroke={c.soft} strokeWidth={14} fill="none" />
        <Circle cx={95} cy={95} r={r} stroke={c.blue2} strokeWidth={14} fill="none" strokeDasharray={`${len * pct} ${len}`} strokeLinecap="round" rotation={-90} origin="95,95" />
      </Svg>
      <View className="items-center">{children}</View>
    </View>
  );
}

export default function LiveQueue() {
  const t = useT(m);
  const p = useT(pm);
  const tc = useT(common);
  const cat = useCatalog();
  const { today } = useClock();
  const { data: bookings } = useApiQuery(qk.bookings, (a) => a.getMyBookings());
  const mine = bookings?.find((b) => b.patientId === ME.id && b.date === today && b.queueNumber);
  const { data: q } = useQueue(mine?.doctorId ?? 'd1');
  const d = cat.doctor(mine?.doctorId);
  const header = <AppHeader title={p('liveQueue')} icon="list-ordered" right={<Badge tone="green" icon="radio">Live</Badge>} />;
  if (!bookings || !cat.ready) return <Screen header={header}><Loading /></Screen>;
  if (!mine || !d) return <Screen header={header}><Empty icon="ticket" text={t('none')} /></Screen>;
  const ahead = Math.max(0, q?.waiting.findIndex((e) => e.number === mine.queueNumber) ?? 0);
  const serving = q?.serving?.number ?? '—';
  const total = (q?.doneCount ?? 0) + (q?.serving ? 1 : 0) + (q?.waiting.length ?? 0);
  const pct = total ? 1 - ahead / Math.max(1, total) : 0.7;
  const cur = FLOW.findIndex(([k]) => k === mine.status);
  return (
    <Screen header={header}>
      {ahead <= 3 && (
        <Card lift className="flex-row items-start gap-3 rounded-[18px] p-3.5">
          <Mark height={28} />
          <View className="flex-1">
            <Row className="justify-between">
              <Txt w="b" size={12.5}>
                DYH Patient App
              </Txt>
              <Txt size={11} className="text-muted">
                {t('now')}
              </Txt>
            </Row>
            <Txt size={12.5} className="mt-1">
              <Txt w="b" size={12.5}>
                {t('coming')}{' '}
              </Txt>
              {t('comingSub', { n: ahead, room: d.room })}
            </Txt>
          </View>
        </Card>
      )}
      <Card className="mt-3 items-center p-5">
        <Row gap="gap-1.5">
          <Icon name="stethoscope" size={15} color="muted" />
          <Txt w="b" size={12.5} className="text-muted">
            {d.name} · {cat.specName(d)}
          </Txt>
        </Row>
        <Ring pct={pct}>
          <Txt size={12.5} className="text-muted">
            {t('yourNumber')}
          </Txt>
          <Txt w="x" size={42} style={{ letterSpacing: -1, lineHeight: 48 }}>
            {mine.queueNumber}
          </Txt>
          <View className="mt-1 items-center">
            <TypeBadge type={mine.type} />
          </View>
        </Ring>
        <Row className="mt-3 w-full">
          <Stat icon="megaphone" label={tc('nowServing')} value={serving} size={18} />
          <Stat icon="users" label={p('ahead')} value={ahead} size={18} />
          <Stat icon="door-open" label={p('room')} value={d.room} size={18} />
        </Row>
      </Card>
      <Card className="mt-3">
        <Row gap="gap-1.5">
          <Icon name="route" size={16} />
          <Txt w="b" size={12.5}>
            {tc('status')}
          </Txt>
        </Row>
        <View className="mt-3 flex-row justify-between">
          <View className="absolute left-4 right-4 top-[13px] h-[3px] bg-line" />
          {FLOW.map(([k, i], idx) => {
            const isDone = idx < cur;
            const isCur = idx === cur;
            return (
              <View key={k} className="w-[62px] items-center gap-1">
                <View className={cx('h-7 w-7 items-center justify-center rounded-full border-[3px]', isDone ? 'border-green bg-green' : isCur ? 'border-primary bg-primary' : 'border-line bg-card')}>
                  <Icon name={i} size={14} color={isDone || isCur ? '#ffffff' : 'muted'} />
                </View>
                <Txt w="s" size={10} className={cx('text-center', isCur ? 'text-blue' : 'text-muted')}>
                  {tc(statusLabel(k))}
                </Txt>
              </View>
            );
          })}
        </View>
      </Card>
      <Card className="mt-3 flex-row items-center gap-3">
        <Icon name="map-pinned" size={20} color="blue" />
        <View className="flex-1">
          <Txt w="b">{t('roomFloor', { room: d.room, floor: d.floor })}</Txt>
          <Txt size={12.5} className="text-muted">
            {t('directions')}
          </Txt>
        </View>
      </Card>
      <Alert icon="bell-ring" className="mt-3" text={t('notify')} />
    </Screen>
  );
}
