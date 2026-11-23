import { Pressable, View } from 'react-native';
import { useQueue, useSchedule, useTodayVitals } from '@dyh/api';
import { formatHoursRange, onlineStats, weekdayOf, type ISODate } from '@dyh/core';
import { common, useT } from '@dyh/i18n';
import { Button, Card, Gradient, Icon, Row, SectionTitle, TONES, Txt, cx, useColors } from '@dyh/ui-native';
import { SecScreen, go } from '../../src/components/shell';
import { useClock, useCurrent, useDates, useDelegated, useDoctorId, useDrafts, usePatients } from '../../src/lib';
import { sm } from '../../src/msgs';
import { useUi } from '../../src/store';

export default function Home() {
  const t = useT(sm);
  const tc = useT(common);
  const dt = useDates();
  const { today, hour } = useClock();
  const id = useDoctorId();
  const { doctor } = useCurrent();
  const { data: q } = useQueue(id);
  const { data: vit } = useTodayVitals();
  const { data: sched } = useSchedule('d1');
  const { data: deleg } = useDelegated();
  const { data: drafts } = useDrafts();
  const { data: pts } = usePatients();
  const w = weekdayOf(today);
  const hasClinic = !!doctor?.clinicDays.includes(w);
  const open = hasClinic && hour < (doctor?.hours.end ?? 0);
  const started = hasClinic && hour >= (doctor?.hours.start ?? 24);
  const onl = q ? onlineStats(q) : { total: 0, arrived: 0, expected: 0 };
  const list = q ? [q.serving, ...q.waiting].filter((p) => !!p) : [];
  const noVit = list.filter((p) => !vit?.[p!.number]);
  const pendBlocks = id === 'd1' ? (sched?.blocked.filter((b) => b.status === 'pending') ?? []) : [];
  const notDrafted = (deleg ?? []).filter((p) => !p.drafted);
  const waitSign = id === 'd1' ? (drafts ?? []).filter((d) => !d.signed) : [];
  const nameOf = (pid: string) => pts?.find((p) => p.id === pid)?.displayName ?? pid;

  return (
    <SecScreen>
      <Txt size={12.5} className="text-muted">
        {dt.dayLong(w)}, {dt.long(today)}
      </Txt>
      <Txt w="x" size={21}>
        {t('greet', { n: 'Carla' })}
      </Txt>

      {hasClinic && q ? (
        <Gradient colors={['#1f56b0', '#17325f']} className="mt-3 overflow-hidden rounded-[22px] p-4">
          <Row className="justify-between">
            <View className="flex-row items-center gap-1 rounded-full px-2.5 py-1" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}>
              <Icon name={open ? 'door-open' : 'door-closed'} size={13} color="#ffffff" />
              <Txt w="b" size={11} className="text-white">
                {open ? (started ? t('clinicOpen') : t('opensLater')) : t('clinicClosed')}
              </Txt>
            </View>
            <Row gap="gap-1">
              <Icon name="clock" size={13} color="#ffffffd0" />
              <Txt size={12} className="text-white" style={{ opacity: 0.85 }}>
                {doctor && formatHoursRange(doctor.hours)}
              </Txt>
            </Row>
          </Row>
          <Txt size={12.5} className="mt-2 text-white" style={{ opacity: 0.85 }}>
            {doctor?.name} · {tc('room')} {doctor?.room}
          </Txt>
          <Row className="mt-3" gap="gap-2">
            {(
              [
                [t('serving'), q.serving?.number ?? '—'],
                [tc('waiting'), q.waiting.length],
                [t('done'), q.doneCount],
              ] as const
            ).map(([l, v]) => (
              <View key={l} className="flex-1 rounded-[14px] p-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
                <Txt size={11} className="text-white" style={{ opacity: 0.8 }}>
                  {l}
                </Txt>
                <Txt w="x" size={19} className="text-white">
                  {v}
                </Txt>
              </View>
            ))}
          </Row>
          <View className="mt-2 flex-row flex-wrap items-center gap-3 rounded-[14px] px-3 py-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
            <Row gap="gap-1">
              <Icon name="smartphone" size={13} color="#ffffff" />
              <Txt size={12} className="text-white">
                {onl.total} {t('bookedOnline')}
              </Txt>
            </Row>
            <Row gap="gap-1">
              <Icon name="map-pin-check" size={13} color="#ffffff" />
              <Txt size={12} className="text-white">
                {onl.arrived} {t('arrived')}
              </Txt>
            </Row>
            <Row gap="gap-1">
              <Icon name="clock" size={13} color="#ffffffc0" />
              <Txt size={12} className="text-white" style={{ opacity: 0.8 }}>
                {onl.expected} {t('expected')}
              </Txt>
            </Row>
          </View>
          <Button variant="w" full icon="list-ordered" iconRight="chevron-right" className="mt-3" onPress={() => go('/queue')}>
            {t('manageQueue')}
          </Button>
        </Gradient>
      ) : (
        <Card className="mt-3 items-center p-5">
          <Icon name="calendar-off" size={32} color="muted" />
          <Txt w="b" size={17} className="mt-3 text-center">
            {t('noClinicFor', { n: doctor?.name ?? '' })}
          </Txt>
          <Txt size={12.5} className="mt-1 text-muted">
            {doctor?.clinicDays.map((d) => dt.day(d)).join(', ')} · {doctor && formatHoursRange(doctor.hours)}
          </Txt>
        </Card>
      )}

      <SectionTitle icon="zap">{t('quick')}</SectionTitle>
      <Row gap="gap-2">
        {(
          [
            ['heart-pulse', 'Vitals', '/vitals'],
            ['list-ordered', t('queue'), '/queue'],
            ['file-pen', t('draftShort'), '/draft'],
            ['megaphone', 'SMS', '/sms'],
          ] as const
        ).map(([i, l, p]) => (
          <Pressable key={p} onPress={() => go(p)} className="flex-1 items-center rounded-2xl border border-line bg-card py-3.5">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-sky">
              <Icon name={i} size={19} color="blue" />
            </View>
            <Txt w="b" size={12} className="mt-1.5">
              {l}
            </Txt>
          </Pressable>
        ))}
      </Row>

      <SectionTitle icon="bell-ring">{t('attention')}</SectionTitle>
      <View className="gap-2">
        {pendBlocks.map((b) => (
          <Attn
            key={b.date}
            tone="red"
            icon="calendar-x"
            title={t('unavailOn', { d: 'Dr. Maria Santos', date: dt.dayDate(b.date) })}
            body={`${b.reason} · ${t('needNotify', { n: b.affected })}`}
            foot={t('autoSend2h')}
            onPress={() => {
              useUi.getState().set({ smsBlockDate: b.date });
              go('/sms');
            }}
          />
        ))}
        {!!noVit.length && <Attn tone="amber" icon="heart-pulse" title={t('noVitalsN', { n: noVit.length })} body={noVit.slice(0, 3).map((p) => p!.number).join(', ') + (noVit.length > 3 ? '…' : '')} onPress={() => go('/vitals')} />}
        {!!q?.skipped.length && <Attn tone="amber" icon="skip-forward" title={t('skippedN', { n: q.skipped.length })} body={q.skipped.map((p) => `${p.number} ${p.patientName}`).join(', ')} onPress={() => go('/queue')} />}
        {!!notDrafted.length && <Attn tone="amber" icon="file-pen" title={t('notDraftedN', { n: notDrafted.length })} body={notDrafted.map((p) => p.name).join(', ')} onPress={() => go('/draft')} />}
        {!!waitSign.length && <Attn tone="blue" icon="file-clock" title={t('waitSignN', { n: waitSign.length })} body={`${waitSign.map((d) => nameOf(d.patientId)).join(', ')} · ${t('forDoc')} ${doctor?.name}`} onPress={() => go('/draft')} />}
      </View>

      <SectionTitle
        icon="calendar-range"
        right={
          <Txt size={12} className="text-muted">
            {t('readOnly')}
          </Txt>
        }
      >
        {t('docSched')}
      </SectionTitle>
      <Row gap="gap-1.5">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => {
          const on = !!doctor?.clinicDays.includes(d);
          return (
            <View key={d} className={cx('flex-1 items-center rounded-xl border py-2', on ? 'border-blue-2 bg-sky' : 'border-line bg-card', d === w && 'border-[2px] border-blue')}>
              <Txt w="b" size={11.5} className={on ? 'text-blue' : 'text-muted'}>
                {dt.day(d)}
              </Txt>
              <Txt size={10} className="text-muted">
                {on && doctor ? `${doctor.hours.start % 12 || 12}${doctor.hours.start < 12 ? 'AM' : 'PM'}` : '—'}
              </Txt>
            </View>
          );
        })}
      </Row>
      {id === 'd1' && !!sched?.blocked.length && (
        <Card className="mt-2 flex-row items-center gap-2 px-3 py-2.5">
          <Icon name="calendar-x" size={16} color="red" />
          <Txt size={12.5} className="flex-1">
            <Txt w="b" size={12.5}>
              {t('blocked')}:
            </Txt>{' '}
            {dt.dayDate(sched.blocked[0].date as ISODate)} · {sched.blocked[0].reason}
          </Txt>
        </Card>
      )}
    </SecScreen>
  );
}

function Attn({ tone, icon, title, body, foot, onPress }: { tone: 'red' | 'amber' | 'blue'; icon: string; title: string; body: string; foot?: string; onPress: () => void }) {
  const c = useColors();
  const [bg, fg] = TONES[tone];
  return (
    <Pressable onPress={onPress} className={cx('flex-row items-start gap-3 rounded-2xl border bg-card p-3.5', tone === 'red' ? 'border-red' : 'border-line')}>
      <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: c[bg] }}>
        <Icon name={icon} size={18} color={fg} />
      </View>
      <View className="flex-1">
        <Txt w="b" size={13}>
          {title}
        </Txt>
        <Txt size={12.5} className="mt-1 text-muted">
          {body}
        </Txt>
        {foot && (
          <Row className="mt-1" gap="gap-1">
            <Icon name="timer" size={12} color="red" />
            <Txt size={11} className="flex-1 text-red">
              {foot}
            </Txt>
          </Row>
        )}
      </View>
      <Icon name="chevron-right" size={16} color="muted" />
    </Pressable>
  );
}
