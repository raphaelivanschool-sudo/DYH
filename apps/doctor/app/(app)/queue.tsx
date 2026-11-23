import { View } from 'react-native';
import { useQueue, useSchedule, useTodayVitals } from '@dyh/api';
import { onlineStats, weekdayOf, type QueueEntry } from '@dyh/core';
import { common, useLoc, useT } from '@dyh/i18n';
import { Alert, Avatar, Badge, Button, Card, Empty, Gradient, Icon, Loading, PriorityBadge, Row, Screen, SectionTitle, Txt, TypeBadge, VitalsGrid, cx } from '@dyh/ui-native';
import { Bell, DocHeader } from '../../src/components/shell';
import { useClock, useDates, useDoctorId, useMe } from '../../src/lib';
import { dm } from '../../src/msgs';
import { useUi } from '../../src/store';

export default function Queue() {
  const t = useT(dm);
  const tc = useT(common);
  const loc = useLoc();
  const dt = useDates();
  const { today } = useClock();
  const id = useDoctorId();
  const { doctor } = useMe();
  const { data: q } = useQueue(id);
  const { data: sched } = useSchedule(id);
  const { data: vitals } = useTodayVitals();
  const open = sched ? !!sched.week[weekdayOf(today)]?.on : true;

  if (!open)
    return (
      <Screen header={<DocHeader title={t('liveQueue')} icon="list-ordered" />}>
        <Card className="items-center px-4 py-10">
          <Icon name="calendar-off" size={34} color="muted" />
          <Txt w="b" size={17} className="mt-3">
            {t('noClinic')}
          </Txt>
          <Txt size={12.5} className="mt-1 text-center text-muted">
            {t('noQueueDay')}
          </Txt>
        </Card>
      </Screen>
    );
  if (!q) return <Loading />;
  const onl = onlineStats(q);
  const s = q.serving;
  const v = s ? vitals?.[s.number] : undefined;

  return (
    <Screen
      header={
        <DocHeader
          title={t('liveQueue')}
          icon="list-ordered"
          right={
            <Row>
              <Badge tone="green" icon="radio" className="self-center">
                Live
              </Badge>
              <Bell />
            </Row>
          }
        />
      }
    >
      <Row className="flex-wrap" gap="gap-2">
        <Badge tone="blue" icon="door-open">
          {tc('room')} {doctor?.room}
        </Badge>
        <Badge icon="calendar">{dt.dayDate(today)}</Badge>
        <Badge tone="green" icon="check-check">
          {t('doneN', { n: q.doneCount })}
        </Badge>
        <Badge tone="blue" icon="smartphone">
          {t('onlineArrived', { a: onl.arrived, t: onl.total })}
        </Badge>
      </Row>

      <Card className="mt-3 overflow-hidden p-0">
        {s ? (
          <>
            <Gradient colors={['#1f56b0', '#17325f']} className="p-4">
              <Row className="justify-between">
                <Row gap="gap-1">
                  <Icon name="megaphone" size={13} color="#ffffffd0" />
                  <Txt w="b" size={11.5} className="text-white" style={{ opacity: 0.85, letterSpacing: 0.5 }}>
                    {tc('nowServing').toUpperCase()}
                  </Txt>
                </Row>
                <Badge tone="purple" icon="stethoscope">
                  {t('inConsult')}
                </Badge>
              </Row>
              <Row className="mt-2" gap="gap-3">
                <Txt w="x" size={34} className="text-white" style={{ letterSpacing: -1 }}>
                  {s.number}
                </Txt>
                <View className="flex-1">
                  <Txt w="b" size={17} className="text-white">
                    {s.patientName}
                  </Txt>
                  <Row className="mt-1" gap="gap-1.5">
                    <TypeBadge type={s.type} />
                    <PriorityBadge p={s.priority} />
                  </Row>
                </View>
              </Row>
              {v ? (
                <VitalsGrid v={v} compact dark />
              ) : (
                <Row className="mt-2" gap="gap-1">
                  <Icon name="heart-pulse" size={13} color="#ffffffc0" />
                  <Txt size={12} className="text-white" style={{ opacity: 0.8 }}>
                    {t('noVitalsYet')}
                  </Txt>
                </Row>
              )}
            </Gradient>
            <View className="p-3.5">
              <Button size="lg" full icon="scan-qr-code" onPress={() => useUi.getState().set({ scan: true })}>
                {t('scanQr')}
              </Button>
              <Row className="mt-2 justify-center" gap="gap-1">
                <Icon name="lock" size={12} color="muted" />
                <Txt size={11} className="text-muted">
                  {t('qrOnly')}
                </Txt>
              </Row>
            </View>
          </>
        ) : (
          <View className="p-6">
            <Txt className="text-center text-muted">{tc('none')}</Txt>
          </View>
        )}
      </Card>

      <SectionTitle icon="users" right={<Badge tone="blue">{q.waiting.length}</Badge>}>
        {t('stillQueue')}
      </SectionTitle>
      {q.waiting.length ? q.waiting.map((p, i) => <QRow key={p.number} p={p} i={i} />) : <Empty icon="users" text={tc('none')} />}

      {!!q.expected.length && (
        <>
          <SectionTitle icon="clock" right={<Badge>{q.expected.length}</Badge>}>
            {t('expectedTitle')}
          </SectionTitle>
          {q.expected.map((e) => (
            <Card key={e.bookingId} className="mb-2 flex-row items-center gap-3 border-dashed p-3">
              <Avatar icon="smartphone" size="sm" light />
              <View className="flex-1">
                <Txt w="b" size={13.5}>
                  {e.patientName}
                </Txt>
                <Txt size={11.5} className="text-muted">
                  {e.bookingId}
                  {e.chiefComplaint ? ` · ${loc(e.chiefComplaint)}` : ''}
                </Txt>
                {e.bookedBy && (
                  <Txt size={11} className="text-muted">
                    {t('bookedBy', { n: e.bookedBy.name })}
                  </Txt>
                )}
              </View>
              <PriorityBadge p={e.priority} />
            </Card>
          ))}
        </>
      )}

      <Alert kind="info" icon="list-ordered" className="mt-2" text={t('order')} />
    </Screen>
  );
}

function QRow({ p, i }: { p: QueueEntry; i: number }) {
  const t = useT(dm);
  return (
    <Card className="mb-2 flex-row items-center gap-3 p-3">
      <View className={cx('min-w-[64px] items-center rounded-xl px-2 py-2', p.priority ? 'bg-prio-bg' : 'bg-sky')}>
        <Txt w="x" size={14} className={p.priority ? 'text-prio' : 'text-blue'}>
          {p.number}
        </Txt>
      </View>
      <View className="flex-1">
        <Txt w="b" numberOfLines={1}>
          {p.patientName}
        </Txt>
        <Row className="mt-1 flex-wrap" gap="gap-1">
          <TypeBadge type={p.type} />
          <PriorityBadge p={p.priority} />
          {p.type === 'online' && (p.arrivedAt ? <Badge tone="teal" icon="map-pin-check">{t('arrivedAt', { t: p.arrivedAt })}</Badge> : null)}
        </Row>
      </View>
      {i === 0 ? (
        <Badge tone="purple" icon="arrow-right">
          {t('next')}
        </Badge>
      ) : (
        <Txt size={11} className="text-muted">
          #{i + 1}
        </Txt>
      )}
    </Card>
  );
}
