import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { qk, useApiQuery } from '@dyh/api';
import { ME, bmi, vitalFlags, type ConsultationRecord, type Vitals } from '@dyh/core';
import { common, defineMessages, useLoc, useT } from '@dyh/i18n';
import { Alert, Avatar, Card, Divider, Empty, Icon, IconButton, Loading, Picker, Row, Screen, SearchBox, SectionTitle, Segmented, Txt, cx, matches } from '@dyh/ui-native';
import { PinGate } from '../../src/components/auth';
import { AppHeader } from '../../src/components/shell';
import { useCatalog, useDates } from '../../src/lib';
import { pm } from '../../src/msgs';
import { useUi } from '../../src/store';

const m = defineMessages('patient.record', {
  protected: ['Protektado ang iyong rekord', 'Your records are protected'],
  protectedSub: ['Ilagay ang iyong PIN o gamitin ang fingerprint para makita ang kasaysayang medikal.', 'Enter your PIN or use your fingerprint to view your medical history.'],
  show: ['Ipakita', 'Show'],
  overall: ['Buong Kasaysayan', 'Overall History'],
  perDoctor: ['Ayon sa Doktor', 'Per Doctor'],
  chooseDoctor: ['Pumili ng Doktor', 'Choose a Doctor'],
  search: ['Hanapin ang diyagnosis o gamot...', 'Search diagnosis or medicine...'],
  pulse: ['Pulso', 'Pulse'],
  weight: ['Timbang', 'Weight'],
  height: ['Taas', 'Height'],
});

export function VitalsGrid({ v }: { v: Vitals }) {
  const t = useT(m);
  const f = vitalFlags(v);
  const items: [string, string, string | number | undefined, string, boolean?][] = [
    ['heart-pulse', 'BP', v.bp, 'mmHg', f.bp],
    ['activity', t('pulse'), v.hr, 'bpm'],
    ['thermometer', 'Temp', v.temp, '°C', f.temp],
    ['wind', 'RR', v.rr, '/min'],
    ['droplets', 'SpO₂', v.o2, '%', f.o2],
    ['weight', t('weight'), v.wt, 'kg'],
    ['ruler', t('height'), v.ht, 'cm'],
    ['calculator', 'BMI', bmi(v), ''],
  ];
  return (
    <View className="mt-2 flex-row flex-wrap justify-between gap-y-1.5">
      {items.map(([i, l, val, u, hi]) => (
        <View key={l} className={cx('w-[24%] rounded-xl border p-2', hi ? 'border-red bg-red-bg' : 'border-line bg-soft')}>
          <Row gap="gap-1">
            <Icon name={i} size={12} color={hi ? 'red' : 'muted'} />
            <Txt size={10} className={hi ? 'text-red' : 'text-muted'}>
              {l}
            </Txt>
          </Row>
          <Txt w="x" size={14} className={hi ? 'text-red' : 'text-ink'}>
            {val ?? '—'}
          </Txt>
          <Txt size={9.5} className="text-muted">
            {val ? u : ' '}
          </Txt>
        </View>
      ))}
    </View>
  );
}

function Block({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <View className="mt-3">
      <Row gap="gap-1.5">
        <Icon name={icon} size={14} color="muted" />
        <Txt w="b" size={12.5} className="text-muted">
          {title}
        </Txt>
      </Row>
      <View className="mt-1">{children}</View>
    </View>
  );
}

function RecordItem({ r, open, onToggle }: { r: ConsultationRecord; open: boolean; onToggle: () => void }) {
  const tc = useT(common);
  const loc = useLoc();
  const cat = useCatalog();
  const dt = useDates();
  return (
    <View className="relative mb-3.5">
      <View className="absolute -left-5 top-4 h-3 w-3 rounded-full border-[3px] border-blue-2 bg-card" />
      <Card className="p-3.5">
        <Pressable onPress={onToggle}>
          <Row className="justify-between">
            <Row gap="gap-1">
              <Icon name="calendar" size={14} color="blue" />
              <Txt w="b" size={12.5} className="text-blue">
                {dt.short(r.date)}
              </Txt>
            </Row>
            <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color="muted" />
          </Row>
          <Txt w="b" size={15} className="mt-1">
            {r.diagnoses.map(loc).join(', ')}
          </Txt>
          <Txt size={12.5} className="text-muted">
            {r.doctorName} · {cat.specName(cat.doctor(r.doctorId))}
          </Txt>
        </Pressable>
        {open && (
          <>
            <Divider />
            {r.vitals && (
              <Block icon="heart-pulse" title="Vital Signs">
                <VitalsGrid v={r.vitals} />
              </Block>
            )}
            <Block icon="clipboard-list" title={tc('findings')}>
              <Txt>{loc(r.findings)}</Txt>
            </Block>
            <Block icon="stethoscope" title={tc('diagnosis')}>
              <Txt>{r.diagnoses.map(loc).join(', ')}</Txt>
            </Block>
            {!!r.prescriptions.length && (
              <Block icon="pill" title={tc('prescription')}>
                {r.prescriptions.map((x) => (
                  <Txt key={x.medicine}>
                    • {x.medicine} — {loc(x.intake)}
                  </Txt>
                ))}
              </Block>
            )}
            {!!r.labs.length && (
              <Block icon="flask-conical" title={tc('labs')}>
                {r.labs.map((x) => (
                  <Txt key={x}>• {x}</Txt>
                ))}
              </Block>
            )}
            <Block icon="notebook-pen" title={tc('notes')}>
              <Txt>{loc(r.notes)}</Txt>
            </Block>
            {r.addendum && (
              <Alert icon="file-plus" className="mt-3">
                <Txt w="b" size={13} className="text-blue">
                  Addendum · {dt.short(r.addendum.date)}
                </Txt>
                <Txt size={13} className="text-blue">
                  {loc(r.addendum.text)}
                </Txt>
              </Alert>
            )}
            <Row gap="gap-1.5" className="mt-3">
              <Icon name="badge-check" size={15} color="green" />
              <Txt size={12.5} className="text-muted">
                {tc('signedBy')} {r.doctorName}
              </Txt>
            </Row>
          </>
        )}
      </Card>
    </View>
  );
}

export default function Records() {
  const t = useT(m);
  const p = useT(pm);
  const tc = useT(common);
  const cat = useCatalog();
  const unlocked = useUi((s) => s.recordUnlocked);
  const { data: recs } = useApiQuery(qk.myRecords, (a) => a.getMyRecords(), { enabled: unlocked });
  const [mode, setMode] = useState<'all' | 'doc'>('all');
  const [doc, setDoc] = useState('d1');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const header = <AppHeader title={p('records')} icon="file-text" right={unlocked ? <IconButton icon="lock" label={p('lock')} onPress={() => useUi.getState().set({ recordUnlocked: false })} /> : undefined} />;
  if (!unlocked)
    return (
      <Screen header={header}>
        <PinGate title={t('protected')} sub={t('protectedSub')} onUnlock={() => useUi.getState().set({ recordUnlocked: true })} />
      </Screen>
    );
  if (!recs) return <Screen header={header}><Loading /></Screen>;
  const docs = [...new Set(recs.map((r) => r.doctorId))];
  const list = recs.filter((r) => (mode === 'all' || r.doctorId === doc) && matches([r.doctorName, ...r.diagnoses.map((x) => x.tl + ' ' + x.en), ...r.prescriptions.map((x) => x.medicine), ...r.labs], q));
  return (
    <Screen header={header}>
      <Card className="flex-row items-center gap-3">
        <Avatar text="JD" />
        <View>
          <Txt w="b">{ME.displayName}</Txt>
          <Txt size={12.5} className="text-muted">
            {ME.id} · {ME.age} {tc('years')} · {tc(ME.sex === 'M' ? 'male' : 'female')}
          </Txt>
        </View>
      </Card>
      <SectionTitle icon="funnel">{t('show')}</SectionTitle>
      <Segmented value={mode} onChange={setMode} options={[{ value: 'all', label: t('overall'), icon: 'history' }, { value: 'doc', label: t('perDoctor'), icon: 'stethoscope' }]} />
      {mode === 'doc' && (
        <View className="mt-2">
          <Picker
            title={t('chooseDoctor')}
            icon="stethoscope"
            value={doc}
            onChange={setDoc}
            options={docs.map((id) => {
              const d = cat.doctor(id);
              return { value: id, label: d?.name ?? id, sub: `${cat.specName(d)} · ${p('consultations', { n: recs.filter((r) => r.doctorId === id).length })}`, icon: cat.specIcon(d) };
            })}
          />
        </View>
      )}
      <SearchBox className="mt-2" value={q} onChange={setQ} placeholder={t('search')} />
      <Txt size={12.5} className="mt-2 text-muted">
        {p('consultations', { n: list.length })}
      </Txt>
      <View className="ml-[22px] mt-3">
        <View className="absolute -left-[15px] bottom-1.5 top-1.5 w-0.5 bg-line" />
        {list.map((r) => (
          <RecordItem key={r.id} r={r} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} />
        ))}
        {!list.length && <Empty text={tc('noResults')} />}
      </View>
    </Screen>
  );
}
