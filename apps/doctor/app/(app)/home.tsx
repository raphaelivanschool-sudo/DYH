import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useAnnouncements, useQueue, useSchedule } from '@dyh/api';
import { DOCTOR_REPORT, addDays, formatHHmm, initials, onlineStats, weekdayOf, type Announcement } from '@dyh/core';
import { common, useT } from '@dyh/i18n';
import { AnnouncementCard, AnnouncementDialog, Avatar, Badge, Button, Card, ChartLegend, Chip, Collapsible, Empty, Gradient, Icon, IconButton, Picker, Row, Screen, SectionTitle, Txt, VBars } from '@dyh/ui-native';
import { Bell, go, openRecord } from '../../src/components/shell';
import { useClock, useDates, useDoctorId, useFollowUps, useMe, useOpenDrafts, usePatients } from '../../src/lib';
import { dm } from '../../src/msgs';
import { useUi } from '../../src/store';

const ONLINE = '#2d6cdf';
const WALKIN = '#9db9e9';

export default function Home() {
  const t = useT(dm);
  const tc = useT(common);
  const dt = useDates();
  const { today, hour } = useClock();
  const id = useDoctorId();
  const { doctor, spec, first } = useMe();
  const { data: q } = useQueue(id);
  const { data: sched } = useSchedule(id);
  const { data: pts } = usePatients();
  const { data: fus } = useFollowUps();
  const drafts = useOpenDrafts();
  const { data: anns } = useAnnouncements();
  const [revOpen, setRevOpen] = useState(true);
  const [fuOpen, setFuOpen] = useState(false);
  const [ann, setAnn] = useState<Announcement | null>(null);
  const week = sched?.week;
  const w = weekdayOf(today);
  const open = !!week?.[w]?.on;
  const nextDay = useMemo(() => {
    for (let k = 1; k < 8; k++) if (week?.[weekdayOf(addDays(today, k))]?.on) return addDays(today, k);
    return null;
  }, [week, today]);
  const onl = q ? onlineStats(q) : { total: 0, arrived: 0, expected: 0 };
  const pt = (pid: string) => pts?.find((p) => p.id === pid);
  const hospAnn = anns?.find((a) => a.id === 'a2') ?? anns?.[0];

  return (
    <Screen
      header={
        <Row className="px-[18px] pb-3 pt-1.5" gap="gap-2.5">
          <IconButton icon="menu" label={tc('menu')} onPress={() => useUi.getState().set({ drawer: true })} />
          <Avatar text={initials(doctor?.name.replace('Dr. ', '') ?? '')} />
          <View className="flex-1">
            <Txt w="b">{doctor?.name}</Txt>
            <Txt size={12} className="text-muted" numberOfLines={1}>
              {spec} · {tc('room')} {doctor?.room}
            </Txt>
          </View>
          <Bell />
        </Row>
      }
    >
      <Txt size={12.5} className="text-muted">
        {dt.dayLong(w)}, {dt.long(today)}
      </Txt>
      <Txt w="x" size={22}>
        {t(hour < 12 ? 'greet' : 'greetPm', { n: first })}
      </Txt>

      {open && q ? (
        <Gradient colors={['#1f56b0', '#17325f']} className="mt-3 overflow-hidden rounded-[22px] p-4">
          <Row className="justify-between">
            <Badge tone="blue" icon="door-open" className="bg-white/20">
              {t('clinicToday')}
            </Badge>
            <Row gap="gap-1">
              <Icon name="clock" size={13} color="#ffffffd0" />
              <Txt size={12} className="text-white" style={{ opacity: 0.85 }}>
                {formatHHmm(week?.[w]?.in)} – {formatHHmm(week?.[w]?.out)}
              </Txt>
            </Row>
          </Row>
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
          <View className="mt-2 rounded-[14px] px-3 py-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
            <Row gap="gap-1.5">
              <Icon name="smartphone" size={14} color="#ffffff" />
              <Txt size={12.5} className="text-white">
                <Txt w="b" size={12.5} className="text-white">
                  {onl.total}
                </Txt>{' '}
                {t('bookedOnline')}
              </Txt>
            </Row>
            <Row className="mt-1" gap="gap-3">
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
            </Row>
          </View>
          <Button variant="w" full icon="list-ordered" iconRight="chevron-right" className="mt-3" onPress={() => go('/queue')}>
            {t('openQueue')}
          </Button>
        </Gradient>
      ) : (
        <Card className="mt-3 items-center p-5">
          <Avatar icon="calendar-off" size="xl" light />
          <Txt w="b" size={18} className="mt-3">
            {t('noClinic')}
          </Txt>
          {nextDay && (
            <Txt size={12.5} className="mt-1 text-center text-muted">
              {t('nextClinic')}:{' '}
              <Txt w="b" size={12.5}>
                {dt.dayLong(weekdayOf(nextDay))}, {dt.short(nextDay)} · {formatHHmm(week?.[weekdayOf(nextDay)]?.in)} – {formatHHmm(week?.[weekdayOf(nextDay)]?.out)}
              </Txt>
            </Txt>
          )}
          <Button variant="o" full icon="calendar-cog" className="mt-3" onPress={() => go('/schedule')}>
            {t('viewSchedule')}
          </Button>
        </Card>
      )}

      <Row className="mt-3" gap="gap-2.5">
        <Card className="flex-1 p-3.5" onPress={() => go('/record')}>
          <Row gap="gap-1">
            <Icon name="users" size={14} color="muted" />
            <Txt w="s" size={12} className="flex-1 text-muted" numberOfLines={1}>
              {t('ptsWeek')}
            </Txt>
          </Row>
          <Txt w="x" size={24} className="mt-1">
            46
          </Txt>
          <Txt size={11} className="text-green">
            ▲ 8% {t('vsLast')}
          </Txt>
        </Card>
        <Card className="flex-1 p-3.5" onPress={() => setRevOpen(true)}>
          <Row gap="gap-1">
            <Icon name="file-clock" size={14} color="muted" />
            <Txt w="s" size={12} className="flex-1 text-muted" numberOfLines={1}>
              {t('draftsReview')}
            </Txt>
          </Row>
          <Txt w="x" size={24} className="mt-1 text-amber">
            {drafts.length}
          </Txt>
          <Txt size={11} className="text-muted">
            {t('fromSec')}
          </Txt>
        </Card>
      </Row>

      <Collapsible icon="file-clock" title={t('needsReview')} badge={<Badge tone={drafts.length ? 'amber' : 'gray'}>{drafts.length}</Badge>} open={revOpen} onToggle={() => setRevOpen(!revOpen)}>
        {drafts.length ? (
          <Card className="px-3.5 py-1">
            {drafts.map((r, i) => {
              const p = pt(r.patientId);
              return (
                <Row key={r.patientId} className={i ? 'border-t border-line py-3' : 'py-3'} gap="gap-2.5">
                  <Avatar text={initials(p?.displayName ?? '')} size="sm" light />
                  <View className="flex-1">
                    <Txt w="b" size={13}>
                      {p?.displayName}
                    </Txt>
                    <Txt size={11} className="text-muted">
                      {t('filledBy')} Sek. {r.preparedBy} · {r.preparedAt} · {r.mode === 'photo' ? t('photo') : t('text')}
                    </Txt>
                    {(r.signed || r.followUp) && (
                      <Row className="mt-1" gap="gap-1">
                        <Icon name={r.signed ? 'calendar-clock' : 'calendar-plus'} size={12} color="purple" />
                        <Txt size={11} className="flex-1 text-purple">
                          {r.signed ? t('signedFuLeft') : t('hasFu')}
                        </Txt>
                      </Row>
                    )}
                  </View>
                  <Button size="sm" variant="g" icon="eye" onPress={() => openRecord(r.patientId)}>
                    {t('review')}
                  </Button>
                </Row>
              );
            })}
          </Card>
        ) : (
          <Empty icon="circle-check" text={t('nothingReview')} />
        )}
      </Collapsible>

      <Collapsible icon="calendar-check" title={t('upcomingFu')} badge={<Badge tone="purple">{fus?.length ?? 0}</Badge>} open={fuOpen} onToggle={() => setFuOpen(!fuOpen)}>
        <Card className="px-3.5 py-1">
          {(fus ?? []).map((f, i) => (
            <Row key={f.patientId} className={i ? 'border-t border-line py-3' : 'py-3'} gap="gap-2.5">
              <Avatar text={initials(pt(f.patientId)?.displayName ?? '')} size="sm" light />
              <View className="flex-1">
                <Txt w="b" size={13}>
                  {pt(f.patientId)?.displayName}
                </Txt>
                <Txt size={11} className="text-muted">
                  {dt.dayDate(f.due)}
                </Txt>
              </View>
              <Badge tone="purple" icon="calendar-check">
                {t('booked')}
              </Badge>
            </Row>
          ))}
        </Card>
      </Collapsible>

      <VolumeChart />

      {hospAnn && (
        <>
          <SectionTitle icon="megaphone">{t('hospAnn')}</SectionTitle>
          <AnnouncementCard a={hospAnn} onPress={() => setAnn(hospAnn)} />
          <AnnouncementDialog a={ann} onClose={() => setAnn(null)} />
        </>
      )}
    </Screen>
  );
}

/** Online vs walk-in per month (or per week when one month is chosen). Jan–Oct 2026. */
function VolumeChart() {
  const t = useT(dm);
  const dt = useDates();
  const [from, setFrom] = useState(4);
  const [to, setTo] = useState(9);
  const V = DOCTOR_REPORT.volume;
  const rows =
    from === to
      ? [0.22, 0.26, 0.24, 0.28].map((x, i) => ({ label: `${t('wk')} ${i + 1}`, parts: [{ value: Math.round(V.online[from] * x), color: ONLINE }, { value: Math.round(V.walkin[from] * x), color: WALKIN }] }))
      : Array.from({ length: to - from + 1 }, (_, j) => ({ label: dt.mon(from + j), parts: [{ value: V.online[from + j], color: ONLINE }, { value: V.walkin[from + j], color: WALKIN }] }));
  const tot = rows.reduce((a, r) => a + r.parts[0].value + r.parts[1].value, 0);
  const onl = rows.reduce((a, r) => a + r.parts[0].value, 0);
  const presets: [number, number, string][] = [
    [9, 9, t('thisMonth')],
    [7, 9, t('m3')],
    [4, 9, t('m6')],
  ];
  const opts = Array.from({ length: 10 }, (_, i) => ({ value: String(i), label: `${dt.monLong(i)} 2026`, icon: 'calendar' }));
  return (
    <>
      <SectionTitle
        icon="chart-column"
        right={
          <Txt size={12.5} className="text-muted">
            {from === to ? dt.monLong(from) : `${dt.mon(from)} – ${dt.mon(to)}`}
          </Txt>
        }
      >
        {t('volume')}
      </SectionTitle>
      <Card>
        <Row className="flex-wrap" gap="gap-2">
          {presets.map(([f, tt, l]) => (
            <Chip
              key={l}
              on={from === f && to === tt}
              onPress={() => {
                setFrom(f);
                setTo(tt);
              }}
            >
              {l}
            </Chip>
          ))}
        </Row>
        <Row className="mt-2" gap="gap-2">
          <View className="flex-1">
            <Txt w="b" size={11} className="mb-1 text-muted">
              {t('from')}
            </Txt>
            <Picker title={t('fromMonth')} icon="calendar" value={String(from)} options={opts.filter((o) => +o.value <= to)} onChange={(v) => setFrom(+v)} searchable={false} />
          </View>
          <View className="flex-1">
            <Txt w="b" size={11} className="mb-1 text-muted">
              {t('to')}
            </Txt>
            <Picker title={t('toMonth')} icon="calendar" value={String(to)} options={opts.filter((o) => +o.value >= from)} onChange={(v) => setTo(+v)} searchable={false} />
          </View>
        </Row>
        <Row className="mt-3 justify-between">
          <View>
            <Txt size={11} className="text-muted">
              {t('total')}
            </Txt>
            <Txt w="x" size={22}>
              {tot}
            </Txt>
          </View>
          <View className="items-end">
            <Txt size={11} className="text-muted">
              Online
            </Txt>
            <Txt w="x" size={16} className="text-blue">
              {Math.round((onl / Math.max(1, tot)) * 100)}%
            </Txt>
          </View>
        </Row>
        <View className="mt-2">
          <VBars rows={rows} height={150} />
        </View>
        <View className="mt-2">
          <ChartLegend
            items={[
              ['Online', ONLINE],
              ['Walk-in', WALKIN],
            ]}
          />
        </View>
        <Txt size={11} className="mt-2 text-muted">
          {from === to ? t('perWeek') : t('perMonth')}
        </Txt>
      </Card>
    </>
  );
}
