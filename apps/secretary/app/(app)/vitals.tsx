import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useApiMutation, useQueue, useTodayVitals } from '@dyh/api';
import { type QueueEntry, type Vitals } from '@dyh/core';
import { common, useLoc, useT } from '@dyh/i18n';
import { Alert, Button, Card, Field, Icon, Input, PriorityBadge, Row, SearchBox, Stat, Txt, TypeBadge, cx, matches, toast } from '@dyh/ui-native';
import { SecScreen } from '../../src/components/shell';
import { useCurrent, useDoctorId } from '../../src/lib';
import { sm } from '../../src/msgs';
import { useUi } from '../../src/store';

/** Body-mass index from kg and cm, or "—" when either is missing. */
const bmiOf = (wt?: string, ht?: string) => {
  const w = parseFloat(wt ?? ''),
    h = parseFloat(ht ?? '') / 100;
  return w > 0 && h > 0 ? (w / (h * h)).toFixed(1) : '—';
};

export default function VitalsScreen() {
  const vitalsFor = useUi((s) => s.vitalsFor);
  return vitalsFor ? <VitalsForm n={vitalsFor} /> : <VitalsList />;
}

function VitalsList() {
  const t = useT(sm);
  const id = useDoctorId();
  const { data: q } = useQueue(id);
  const { data: vit } = useTodayVitals();
  const [s, setS] = useState('');
  const list = q ? ([q.serving, ...q.waiting].filter(Boolean) as QueueEntry[]) : [];
  const done = list.filter((p) => !!vit?.[p.number]).length;
  const shown = list.filter((p) => matches([p.number, p.patientName], s));
  return (
    <SecScreen title={t('vitals')} icon="heart-pulse">
      <Txt size={12.5} className="text-muted">
        {t('vitalsSub')}
      </Txt>
      <Row className="mt-3" gap="gap-2">
        <Stat icon="circle-check" label={t('recorded')} value={<Txt w="x" size={24} className="text-green">{done}</Txt>} className="flex-1" />
        <Stat icon="clock" label={t('pending')} value={<Txt w="x" size={24} className="text-amber">{list.length - done}</Txt>} className="flex-1" />
      </Row>
      <SearchBox value={s} onChange={setS} placeholder={t('searchQ')} className="mb-2 mt-3" />
      {shown.map((p) => {
        const v = vit?.[p.number];
        return (
          <Pressable key={p.number} onPress={() => useUi.getState().set({ vitalsFor: p.number })} className="mb-2 flex-row items-center gap-3 rounded-2xl border border-line bg-card p-3">
            <View className={cx('min-w-[62px] items-center rounded-xl px-2 py-2', p.priority ? 'bg-prio-bg' : 'bg-sky')}>
              <Txt w="x" size={13.5} className={p.priority ? 'text-prio' : 'text-blue'}>
                {p.number}
              </Txt>
            </View>
            <View className="flex-1">
              <Txt w="b" numberOfLines={1}>
                {p.patientName}
              </Txt>
              <Txt size={12} className="mt-0.5 text-muted" numberOfLines={1}>
                {v ? `BP ${v.bp ?? '—'} · ${v.wt ?? '—'} kg · ${v.temp ? `${v.temp}°C` : "—"}` : t('noVitalsYet')}
              </Txt>
            </View>
            {v ? (
              <Icon name="circle-check" size={20} color="green" />
            ) : (
              <View className="rounded-lg bg-blue px-2.5 py-1.5">
                <Txt w="b" size={12} className="text-white">
                  {t('record')}
                </Txt>
              </View>
            )}
          </Pressable>
        );
      })}
    </SecScreen>
  );
}

type Form = { sys: string; dia: string; hr: string; temp: string; rr: string; o2: string; wt: string; ht: string; cc: string };

function VitalsForm({ n }: { n: string }) {
  const t = useT(sm);
  const tc = useT(common);
  const loc = useLoc();
  const id = useDoctorId();
  const { doctor } = useCurrent();
  const { data: q } = useQueue(id);
  const { data: vit } = useTodayVitals();
  const p = q ? ([q.serving, ...q.waiting, ...q.skipped].find((x) => x?.number === n) ?? null) : null;
  const old = vit?.[n];
  const [f, setF] = useState<Form>(() => {
    const [sys = '', dia = ''] = (old?.bp ?? '').split('/');
    const str = (x?: number | string) => (x == null ? '' : String(x));
    return { sys, dia, hr: str(old?.hr), temp: str(old?.temp), rr: str(old?.rr), o2: str(old?.o2), wt: str(old?.wt), ht: str(old?.ht), cc: old?.chiefComplaint ? loc(old.chiefComplaint) : '' };
  });
  const save = useApiMutation((a, v: Vitals) => a.saveVitals(n, v));
  const close = () => useUi.getState().set({ vitalsFor: null });
  const set = (k: keyof Form) => (v: string) => setF({ ...f, [k]: v });
  const num = (x: string) => (x.trim() ? Number(x) : undefined);

  const onSave = async () => {
    await save.mutateAsync({
      bp: f.sys || f.dia ? `${f.sys}/${f.dia}` : undefined,
      hr: num(f.hr),
      temp: f.temp || undefined,
      rr: num(f.rr),
      o2: num(f.o2),
      wt: num(f.wt),
      ht: num(f.ht),
      chiefComplaint: f.cc || undefined,
    });
    toast.success(t('vSaved'));
    close();
  };

  const box = (k: keyof Form, icon: string, label: string, ph: string, kb: 'numeric' | 'decimal-pad' = 'decimal-pad') => (
    <View className="w-[48%]">
      <Field icon={icon} label={label}>
        <Input value={f[k]} onChangeText={set(k)} placeholder={ph} keyboardType={kb} accessibilityLabel={label} />
      </Field>
    </View>
  );

  return (
    <SecScreen
      title={t('recordVitals')}
      icon="heart-pulse"
      right={
        <Button size="sm" variant="o" icon="x" onPress={close}>
          {tc('cancel')}
        </Button>
      }
    >
      <Card className="flex-row items-center gap-3 p-3">
        <View className={cx('min-w-[62px] items-center rounded-xl px-2 py-2', p?.priority ? 'bg-prio-bg' : 'bg-sky')}>
          <Txt w="x" size={13.5} className={p?.priority ? 'text-prio' : 'text-blue'}>
            {n}
          </Txt>
        </View>
        <View className="flex-1">
          <Txt w="b">{p?.patientName ?? '—'}</Txt>
          {p && (
            <Row className="mt-1" gap="gap-1">
              <TypeBadge type={p.type} />
              <PriorityBadge p={p.priority} />
            </Row>
          )}
        </View>
      </Card>

      <Field icon="heart-pulse" label={t('bp')}>
        <Row>
          <View className="flex-1">
            <Input value={f.sys} onChangeText={set('sys')} placeholder="120" keyboardType="numeric" accessibilityLabel="Systolic" />
          </View>
          <Txt w="b" size={18} className="text-muted">
            /
          </Txt>
          <View className="flex-1">
            <Input value={f.dia} onChangeText={set('dia')} placeholder="80" keyboardType="numeric" accessibilityLabel="Diastolic" />
          </View>
        </Row>
      </Field>
      <View className="flex-row flex-wrap justify-between">
        {box('hr', 'activity', t('pulse'), '76', 'numeric')}
        {box('temp', 'thermometer', t('temp'), '36.5')}
        {box('rr', 'wind', t('rr'), '16', 'numeric')}
        {box('o2', 'droplets', 'SpO₂ (%)', '98', 'numeric')}
        {box('wt', 'weight', t('wt'), '60')}
        {box('ht', 'ruler', t('ht'), '160', 'numeric')}
      </View>

      <Card className="mt-3 flex-row items-center justify-between px-3.5 py-3">
        <Row gap="gap-1.5">
          <Icon name="calculator" size={16} />
          <Txt w="b" size={13}>
            {t('bmiAuto')}
          </Txt>
        </Row>
        <Txt w="x" size={20}>
          {bmiOf(f.wt, f.ht)}
        </Txt>
      </Card>

      <Field icon="message-square" label={t('chief')} optional>
        <Input multiline value={f.cc} onChangeText={set('cc')} placeholder={t('chiefPh')} accessibilityLabel={t('chief')} />
      </Field>
      <Alert kind="info" icon="eye" className="mt-3" text={t('seesNow', { n: doctor?.name ?? '' })} />
      <Button size="lg" full icon="save" className="mt-3" loading={save.isPending} onPress={onSave}>
        {t('saveVitals')}
      </Button>
    </SecScreen>
  );
}
