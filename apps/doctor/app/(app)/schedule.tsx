import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useApiMutation, useQueue, useSchedule } from '@dyh/api';
import { BLOCK_REASONS, addDays, formatHHmm, padNum, parseISO, weekdayOf, type DoctorSchedule, type ISODate } from '@dyh/core';
import { common, useLoc, useT } from '@dyh/i18n';
import { Alert, Badge, Button, Card, Dialog, Field, Icon, IconButton, Input, Loading, Picker, Row, Rows, Screen, SectionTitle, Toggle, Txt, cx, toast, type PickOption } from '@dyh/ui-native';
import { DocHeader } from '../../src/components/shell';
import { useClock, useDates, useDoctorId } from '../../src/lib';
import { dm } from '../../src/msgs';

const TIMES: PickOption[] = Array.from({ length: 29 }, (_, i) => {
  const h = 6 + Math.floor(i / 2);
  const v = `${padNum(h, 2)}:${i % 2 ? '30' : '00'}`;
  return { value: v, label: formatHHmm(v), icon: 'clock' };
});

export default function Schedule() {
  const t = useT(dm);
  const dt = useDates();
  const { today } = useClock();
  const id = useDoctorId();
  const { data } = useSchedule(id);
  const [s, setS] = useState<DoctorSchedule | null>(null);
  const [block, setBlock] = useState(false);
  useEffect(() => {
    if (data) setS((cur) => (cur ? { ...cur, blocked: data.blocked } : structuredClone(data)));
  }, [data]);
  const save = useApiMutation((a, v: DoctorSchedule) => a.saveSchedule(v));
  const remove = useApiMutation((a, d: ISODate) => a.removeBlockedDate(id, d));
  if (!s) return <Loading />;
  const setDay = (d: number, p: Partial<DoctorSchedule['week'][number]>) => setS({ ...s, week: s.week.map((w, i) => (i === d ? { ...w, ...p } : w)) });

  return (
    <Screen header={<DocHeader title={t('clinicSchedule')} icon="calendar-cog" />}>
      <Card className={cx('flex-row items-center gap-3', s.closeOnlineToday && 'border-amber')}>
        <Icon name="globe-lock" size={20} color="blue" />
        <View className="flex-1">
          <Txt w="b">{t('closeOnline')}</Txt>
          <Txt size={12} className="text-muted">
            {t('todayOnly')} ({dt.dayDate(today)})
          </Txt>
        </View>
        <Toggle label={t('closeOnline')} value={s.closeOnlineToday} onChange={(v) => setS({ ...s, closeOnlineToday: v })} />
      </Card>
      {s.closeOnlineToday && <Alert kind="warn" className="mt-2" text={t('closeOnlineNote')} />}

      <SectionTitle
        icon="calendar-range"
        right={
          <Txt size={12} className="text-muted">
            {t('timeInOut')}
          </Txt>
        }
      >
        {t('weekly')}
      </SectionTitle>
      <Card className="px-3 py-1.5">
        {[1, 2, 3, 4, 5, 6, 0].map((d, i) => {
          const w = s.week[d];
          return (
            <View key={d} className={cx('py-2.5', i > 0 && 'border-t border-line')}>
              <Row gap="gap-3">
                <View className={cx('h-10 w-10 items-center justify-center rounded-xl', w.on ? 'bg-sky' : 'bg-soft')}>
                  <Txt w="x" size={12.5} className={w.on ? 'text-blue' : 'text-muted'}>
                    {dt.day(d)}
                  </Txt>
                </View>
                <View className="flex-1">
                  <Txt w="b">{dt.dayLong(d)}</Txt>
                  <Txt size={11.5} className="text-muted">
                    {w.on ? `${formatHHmm(w.in)} – ${formatHHmm(w.out)}` : t('noClinicDay')}
                  </Txt>
                </View>
                <Toggle label={dt.dayLong(d)} value={w.on} onChange={(on) => setDay(d, on && !w.in ? { on, in: '08:00', out: '12:00' } : { on })} />
              </Row>
              {w.on && (
                <Row className="mt-2" gap="gap-2">
                  <View className="flex-1">
                    <Row gap="gap-1" className="mb-1">
                      <Icon name="log-in" size={12} color="muted" />
                      <Txt w="b" size={11} className="text-muted">
                        {t('timeIn')}
                      </Txt>
                    </Row>
                    <Picker title={t('timeIn')} icon="clock" value={w.in} options={TIMES} onChange={(v) => setDay(d, { in: v })} searchable={false} />
                  </View>
                  <View className="pt-5">
                    <Icon name="arrow-right" size={16} color="muted" />
                  </View>
                  <View className="flex-1">
                    <Row gap="gap-1" className="mb-1">
                      <Icon name="log-out" size={12} color="muted" />
                      <Txt w="b" size={11} className="text-muted">
                        {t('timeOut')}
                      </Txt>
                    </Row>
                    <Picker title={t('timeOut')} icon="clock" value={w.out} options={TIMES.filter((x) => !w.in || x.value > w.in)} onChange={(v) => setDay(d, { out: v })} searchable={false} />
                  </View>
                </Row>
              )}
            </View>
          );
        })}
      </Card>

      <SectionTitle icon="users">{t('maxPts')}</SectionTitle>
      <Card>
        <Row>
          <Button variant="o" icon="minus" accessibilityLabel="−" onPress={() => setS({ ...s, maxPatientsPerDay: Math.max(0, s.maxPatientsPerDay - 1) })} />
          <Txt w="x" size={28} className="flex-1 text-center">
            {s.maxPatientsPerDay}
          </Txt>
          <Button variant="o" icon="plus" accessibilityLabel="+" onPress={() => setS({ ...s, maxPatientsPerDay: s.maxPatientsPerDay + 1 })} />
        </Row>
        <Alert kind="info" className="mt-3" text={t('maxPtsNote')} />
      </Card>

      <SectionTitle
        icon="calendar-x"
        right={
          <Button variant="link" size="sm" icon="plus" onPress={() => setBlock(true)}>
            {t('add')}
          </Button>
        }
      >
        {t('blockedDates')}
      </SectionTitle>
      {s.blocked.length ? (
        s.blocked.map((b) => (
          <Card key={b.date} className="mb-2 flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-red-bg">
              <Icon name="calendar-x" size={18} color="red" />
            </View>
            <View className="flex-1">
              <Txt w="b">{dt.dayDate(b.date)}</Txt>
              <Txt size={12.5} className="text-muted">
                {b.reason}
              </Txt>
              <View className="mt-1">
                {b.status === 'pending' ? (
                  <Badge tone="amber" icon="clock">
                    {t('waitSec', { n: b.affected })}
                  </Badge>
                ) : b.status === 'sent' ? (
                  <Badge tone="green" icon="check-check">
                    {t('notifiedBy', { n: b.affected, b: b.notifiedBy ?? 'Sek. Carla Ramos' })}
                  </Badge>
                ) : (
                  <Badge>{t('noAffected')}</Badge>
                )}
              </View>
            </View>
            <IconButton icon="trash-2" size="sm" label={t('remove')} onPress={() => remove.mutate(b.date)} />
          </Card>
        ))
      ) : (
        <Card className="items-center py-6">
          <Txt size={12.5} className="text-muted">
            {t('noBlocked')}
          </Txt>
        </Card>
      )}

      <Button
        variant="n"
        size="lg"
        full
        icon="save"
        className="mt-3"
        loading={save.isPending}
        onPress={async () => {
          await save.mutateAsync(s);
          toast.success(t('scheduleSaved'));
        }}
      >
        {t('saveSchedule')}
      </Button>
      <BlockDialog open={block} onClose={() => setBlock(false)} schedule={s} />
    </Screen>
  );
}

/** Block a date: pick date + reason → confirm → secretary notifies affected patients. */
function BlockDialog({ open, onClose, schedule }: { open: boolean; onClose: () => void; schedule: DoctorSchedule }) {
  const t = useT(dm);
  const tc = useT(common);
  const loc = useLoc();
  const dt = useDates();
  const { today } = useClock();
  const id = useDoctorId();
  const { data: q } = useQueue(id);
  const [date, setDate] = useState<ISODate>(today);
  const [reason, setReason] = useState<string | null>(null);
  const [other, setOther] = useState('');
  const [note, setNote] = useState('');
  const [step, setStep] = useState<0 | 1>(0);
  const mut = useApiMutation((a, v: { doctorId: string; date: ISODate; reason: string; note?: string }) => a.blockDate(v));
  const on = !!schedule.week[weekdayOf(date)]?.on;
  const aff = !on ? 0 : date === today ? (q ? q.waiting.length + q.doneCount + 1 : 0) : ((parseISO(date)[2] * 7) % 12) + 3;
  const r = BLOCK_REASONS.find((x) => x.id === reason);
  const rl = reason === 'other' ? other || loc(r?.label) : loc(r?.label);
  const dates: PickOption[] = Array.from({ length: 60 }, (_, i) => {
    const d = addDays(today, i);
    return { value: d, label: `${dt.dayDate(d)}, ${parseISO(d)[0]}`, sub: schedule.week[weekdayOf(d)]?.on ? undefined : t('noClinicDay'), icon: 'calendar' };
  });
  const close = () => {
    setStep(0);
    onClose();
  };
  if (step === 1)
    return (
      <Dialog
        open={open}
        onClose={close}
        title={t('confirmBlock')}
        icon="triangle-alert"
        actions={
          <>
            <Button variant="o" className="flex-1" icon="chevron-left" onPress={() => setStep(0)}>
              {tc('back')}
            </Button>
            <Button
              variant="r"
              className="flex-1"
              icon="calendar-x"
              loading={mut.isPending}
              onPress={async () => {
                await mut.mutateAsync({ doctorId: id, date, reason: rl, note: note || undefined });
                setReason(null);
                setNote('');
                close();
                toast.success(t('blockedToast'));
              }}
            >
              {t('yesBlock')}
            </Button>
          </>
        }
      >
        <Card className="px-4 py-1">
          <Rows
            rows={[
              ['calendar', tc('date'), dt.dayDate(date)],
              ['tag', t('reason'), rl],
              ['users', t('affected'), String(aff)],
              ['send', t('forwardTo'), 'Sek. Carla Ramos'],
            ]}
          />
        </Card>
        <Alert kind="warn" className="mt-3" text={t('blockWarn')} />
      </Dialog>
    );
  return (
    <Dialog
      open={open}
      onClose={close}
      title={t('blockTitle')}
      icon="calendar-x"
      actions={
        <>
          <Button variant="o" className="flex-1" onPress={close}>
            {tc('cancel')}
          </Button>
          <Button variant="r" className="flex-1" iconRight="chevron-right" onPress={() => (reason ? setStep(1) : toast.info(t('pickReason')))}>
            {t('continue')}
          </Button>
        </>
      }
    >
      <Field label={tc('date')} icon="calendar" hint={t('canToday')} className="mt-0">
        <Picker title={tc('date')} icon="calendar" value={date} options={dates} onChange={setDate} searchable={false} />
      </Field>
      <Alert kind={aff ? 'warn' : 'info'} className="mt-3" text={on ? t('affectedN', { n: aff, d: dt.dayDate(date) }) : t('noneAffected')} />
      <Field label={t('reason')} icon="tag">
        <Picker title={t('reason')} icon="tag" value={reason} options={BLOCK_REASONS.map((x) => ({ value: x.id, label: loc(x.label), icon: 'tag' }))} onChange={setReason} searchable={false} />
        {reason === 'other' && <Input className="mt-2" value={other} onChangeText={setOther} placeholder={t('specifyReason')} accessibilityLabel={t('specifyReason')} />}
      </Field>
      <Field label={t('noteSec')} icon="notebook-pen" optional>
        <Input multiline value={note} onChangeText={setNote} placeholder={t('blockNotePh')} accessibilityLabel={t('noteSec')} />
      </Field>
      <Alert kind="info" icon="route" className="mt-3" text={t('blockFlow')} />
    </Dialog>
  );
}
