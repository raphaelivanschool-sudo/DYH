/** Consultation form shared by the Doctor app (consult) and the Secretary app (findings draft). */
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import type { SignConsultationInput } from '@dyh/api';
import { DIAGNOSES, LABS, MEDICINES, type ISODate } from '@dyh/core';
import { common, defineMessages, useT } from '@dyh/i18n';
import { Field, Input, Picker, SearchBox, Chip, matches, type PickOption } from './form';
import { Icon } from './icon';
import { Sheet } from './overlay';
import { Avatar, Button, Card, Row, cx } from './primitives';
import { Txt } from './text';

export const consultMsgs = defineMessages('consult', {
  title: ['Pamagat', 'Title'],
  titlePh: ['hal. Balik-konsulta: Altapresyon', 'e.g. Follow-up: Hypertension'],
  findingsPh: ['Mga natuklasan sa pagsusuri...', 'Examination findings...'],
  summarize: ['Ibuod (mahaba ang natuklasan)', 'Summarize (long findings)'],
  summary: ['Buod ng natuklasan', 'Findings summary'],
  summaryAuto: ['Mataas ang BP (150/94) at FBS (142); may pagkahilo sa umaga, walang pamamaga.', 'Elevated BP (150/94) and FBS (142); morning dizziness, no edema.'],
  summaryHint: ['Ito ang unang makikita sa rekord; nakatago ang buong teksto sa "Basahin lahat".', 'Shown first in the record; the full text stays under "Read all".'],
  pickDx: ['Pumili o maghanap ng diyagnosis', 'Select or search a diagnosis'],
  specifyDx: ['Tukuyin ang diyagnosis', 'Specify the diagnosis'],
  addDx: ['Magdagdag ng Diyagnosis', 'Add Diagnosis'],
  medicine: ['Gamot', 'Medicine'],
  pickRx: ['Pumili o maghanap ng gamot', 'Select or search a medicine'],
  rxName: ['Pangalan at dosis ng gamot', 'Medicine name & dose'],
  intake: ['Pag-inom', 'Intake'],
  intakePh: ['hal. 1 tableta, 2x sa isang araw pagkatapos kumain (7 araw)', 'e.g. 1 tablet, twice a day after meals (7 days)'],
  addRx: ['Magdagdag ng Gamot', 'Add Medicine'],
  addLab: ['Idagdag', 'Add'],
  others: ['Iba pa (tukuyin)', 'Others (specify)'],
  othersLabPh: ['hal. Thyroid Ultrasound', 'e.g. Thyroid Ultrasound'],
  notesPh: ['Payo o iba pang tala...', 'Advice or other notes...'],
  remove: ['Alisin', 'Remove'],
});

export type RxRow = { med: string | null; other: string; intake: string };
export interface ConsultFormState {
  title: string;
  findings: string;
  summary: string;
  dx: { id: string | null; other: string }[];
  rx: RxRow[];
  labs: string[];
  labOther: string;
  notes: string;
  fu: { date: ISODate; purpose: string } | null;
}
export type ConsultCheckKey = 'title' | 'findings' | 'dx' | 'rx' | 'lab' | 'notes' | 'fu';

export const emptyConsult = (): ConsultFormState => ({ title: '', findings: '', summary: '', dx: [{ id: null, other: '' }], rx: [{ med: null, other: '', intake: '' }], labs: [], labOther: '', notes: '', fu: null });

/** What the AI (photo / voice) or the secretary's draft fills in. Mock output of the real AI service. */
export const aiConsult = (en: boolean): ConsultFormState => ({
  title: en ? 'Follow-up: Hypertension and Diabetes' : 'Balik-konsulta: Altapresyon at Diabetes',
  findings: 'BP 150/94 mmHg, HR 88, FBS 142 mg/dL. ' + (en ? 'Occasional morning dizziness. No edema.' : 'Paminsan-minsang pagkahilo sa umaga. Walang pamamaga.'),
  summary: '',
  dx: [{ id: 'htn', other: '' }, { id: 'dm', other: '' }],
  rx: [
    { med: 'aml', other: '', intake: en ? '1 tablet once every morning (30 days)' : '1 tableta, isang beses tuwing umaga (30 araw)' },
    { med: 'met', other: '', intake: en ? '1 tablet twice a day after meals (30 days)' : '1 tableta, 2x sa isang araw pagkatapos kumain (30 araw)' },
  ],
  labs: ['lipid', 'hba1c'],
  labOther: '',
  notes: en ? 'Reduce salt and sugar. Return in 2 weeks with results.' : 'Bawasan ang alat at matamis. Bumalik pagkatapos ng 2 linggo dala ang resulta.',
  fu: null,
});

export function consultToInput(f: ConsultFormState, patientId: string, source: SignConsultationInput['source']): Omit<SignConsultationInput, 'doctorId' | 'verifiedWith'> {
  return {
    patientId,
    source,
    title: f.title,
    findings: f.findings,
    findingsSummary: f.summary || undefined,
    diagnoses: f.dx.map((d) => (d.id === 'other' ? d.other : DIAGNOSES.find((x) => x.id === d.id)?.label ?? '')).filter(Boolean),
    prescriptions: f.rx
      .map((r) => ({ medicine: r.med === 'other' ? r.other : MEDICINES.find((x) => x.id === r.med)?.label ?? '', intake: r.intake }))
      .filter((r) => r.medicine),
    labs: [...f.labs.map((l) => LABS.find((x) => x.id === l)?.label ?? l), ...(f.labOther ? [f.labOther] : [])],
    notes: f.notes,
  };
}

export function ConsultForm({ form, setForm, tag, followUp }: { form: ConsultFormState; setForm: (f: ConsultFormState) => void; tag: (k: ConsultCheckKey) => ReactNode; /** Follow-up block (differs per app). */ followUp?: ReactNode }) {
  const t = useT(consultMsgs);
  const tc = useT(common);
  const [labSheet, setLabSheet] = useState(false);
  const up = (p: Partial<ConsultFormState>) => setForm({ ...form, ...p });
  const other: PickOption = { value: 'other', label: t('others'), icon: 'pencil' };
  const dxOpts: PickOption[] = [...DIAGNOSES.map((x) => ({ value: x.id, label: x.label, icon: 'stethoscope' })), other];
  const rxOpts: PickOption[] = [...MEDICINES.map((x) => ({ value: x.id, label: x.label, icon: 'pill' })), other];
  const summarize = () => {
    const f = form.findings;
    up({ summary: f.startsWith('BP 150/94') ? t('summaryAuto') : f.split(/[.;]/).filter(Boolean).slice(0, 2).join('. ').slice(0, 110) + '…' });
  };
  const Label = ({ icon, text, k }: { icon: string; text: string; k: ConsultCheckKey }) => (
    <Row className="mb-1.5 mt-4 flex-wrap justify-between" gap="gap-1.5">
      <Row gap="gap-1.5">
        <Icon name={icon} size={15} color="muted" />
        <Txt w="b" size={13}>
          {text}
        </Txt>
      </Row>
      {tag(k)}
    </Row>
  );
  return (
    <>
      <Label icon="heading" text={t('title')} k="title" />
      <Input value={form.title} onChangeText={(v) => up({ title: v })} placeholder={t('titlePh')} accessibilityLabel={t('title')} />

      <Label icon="clipboard-list" text={tc('findings')} k="findings" />
      <Input multiline value={form.findings} onChangeText={(v) => up({ findings: v })} placeholder={t('findingsPh')} accessibilityLabel={tc('findings')} />
      {form.findings.length > 80 &&
        (form.summary ? (
          <View className="mt-2 rounded-xl border border-line bg-soft p-2.5">
            <Row className="justify-between">
              <Row gap="gap-1">
                <Icon name="text-quote" size={13} color="muted" />
                <Txt w="b" size={11.5}>
                  {t('summary')}
                </Txt>
              </Row>
              <Pressable onPress={() => up({ summary: '' })}>
                <Txt w="b" size={11.5} className="text-blue">
                  {t('remove')}
                </Txt>
              </Pressable>
            </Row>
            <Input multiline value={form.summary} onChangeText={(v) => up({ summary: v })} className="mt-1" accessibilityLabel={t('summary')} />
            <Txt size={11} className="mt-1 text-muted">
              {t('summaryHint')}
            </Txt>
          </View>
        ) : (
          <View className="mt-2 self-start">
            <Button size="sm" variant="g" icon="text-quote" onPress={summarize}>
              {t('summarize')}
            </Button>
          </View>
        ))}

      <Label icon="stethoscope" text={tc('diagnosis')} k="dx" />
      {form.dx.map((d, i) => (
        <Row key={i} className="mt-2 items-start" gap="gap-2">
          <View className="flex-1">
            <Picker title={tc('diagnosis')} icon="stethoscope" placeholder={t('pickDx')} value={d.id} options={dxOpts} onChange={(v) => up({ dx: form.dx.map((x, j) => (j === i ? { ...x, id: v } : x)) })} />
            {d.id === 'other' && <Input className="mt-2" value={d.other} onChangeText={(v) => up({ dx: form.dx.map((x, j) => (j === i ? { ...x, other: v } : x)) })} placeholder={t('specifyDx')} accessibilityLabel={t('specifyDx')} />}
          </View>
          <Pressable accessibilityLabel={t('remove')} onPress={() => up({ dx: form.dx.filter((_, j) => j !== i) })} className="h-12 w-11 items-center justify-center rounded-xl border border-line bg-card">
            <Icon name="trash-2" size={17} color="muted" />
          </Pressable>
        </Row>
      ))}
      <View className="mt-2 self-start">
        <Button size="sm" variant="g" icon="plus" onPress={() => up({ dx: [...form.dx, { id: null, other: '' }] })}>
          {t('addDx')}
        </Button>
      </View>

      <Label icon="pill" text={tc('prescription')} k="rx" />
      {form.rx.map((r, i) => {
        const set = (p: Partial<RxRow>) => up({ rx: form.rx.map((x, j) => (j === i ? { ...x, ...p } : x)) });
        return (
          <Card key={i} className="mt-2 p-3">
            <Row className="justify-between">
              <Row gap="gap-1">
                <Icon name="pill" size={14} color="blue" />
                <Txt w="b" size={12.5} className="text-blue">
                  {t('medicine')} {i + 1}
                </Txt>
              </Row>
              <Pressable accessibilityLabel={t('remove')} onPress={() => up({ rx: form.rx.filter((_, j) => j !== i) })}>
                <Icon name="trash-2" size={16} color="muted" />
              </Pressable>
            </Row>
            <View className="mt-2">
              <Picker title={t('medicine')} icon="pill" placeholder={t('pickRx')} value={r.med} options={rxOpts} onChange={(v) => set({ med: v })} />
            </View>
            {r.med === 'other' && <Input className="mt-2" value={r.other} onChangeText={(v) => set({ other: v })} placeholder={t('rxName')} accessibilityLabel={t('rxName')} />}
            <Row className="mb-1 mt-2.5" gap="gap-1">
              <Icon name="clock" size={13} color="muted" />
              <Txt w="b" size={12} className="text-muted">
                {t('intake')}
              </Txt>
            </Row>
            <Input multiline value={r.intake} onChangeText={(v) => set({ intake: v })} placeholder={t('intakePh')} accessibilityLabel={t('intake')} className="min-h-[56px]" />
          </Card>
        );
      })}
      <View className="mt-2 self-start">
        <Button size="sm" variant="g" icon="plus" onPress={() => up({ rx: [...form.rx, { med: null, other: '', intake: '' }] })}>
          {t('addRx')}
        </Button>
      </View>

      <Label icon="flask-conical" text={tc('labs')} k="lab" />
      <Row className="flex-wrap" gap="gap-2">
        {LABS.filter((x) => form.labs.includes(x.id)).map((x) => (
          <Chip key={x.id} on icon="flask-conical" onPress={() => up({ labs: form.labs.filter((l) => l !== x.id) })}>
            {x.label} ✕
          </Chip>
        ))}
        {!!form.labOther && (
          <Chip on icon="pencil" onPress={() => up({ labOther: '' })}>
            {form.labOther} ✕
          </Chip>
        )}
        <Chip icon="plus" onPress={() => setLabSheet(true)}>
          {t('addLab')}
        </Chip>
      </Row>

      <Label icon="notebook-pen" text={tc('notes')} k="notes" />
      <Input multiline value={form.notes} onChangeText={(v) => up({ notes: v })} placeholder={t('notesPh')} accessibilityLabel={tc('notes')} />

      {followUp}

      <LabSheet open={labSheet} onClose={() => setLabSheet(false)} labs={form.labs} other={form.labOther} onChange={(labs, labOther) => up({ labs, labOther })} />
    </>
  );
}

function LabSheet({ open, onClose, labs, other, onChange }: { open: boolean; onClose: () => void; labs: string[]; other: string; onChange: (l: string[], o: string) => void }) {
  const t = useT(consultMsgs);
  const tc = useT(common);
  const [q, setQ] = useState('');
  const list = LABS.filter((x) => matches([x.label], q));
  return (
    <Sheet open={open} onClose={onClose} title={`${t('addLab')}: ${tc('labs')}`} icon="flask-conical">
      <SearchBox value={q} onChange={setQ} placeholder={tc('search')} />
      <View className="mt-3 gap-1.5">
        {list.map((x) => {
          const on = labs.includes(x.id);
          return (
            <Pressable key={x.id} onPress={() => onChange(on ? labs.filter((l) => l !== x.id) : [...labs, x.id], other)} className={cx('flex-row items-center gap-2.5 rounded-xl border-[1.5px] px-3 py-2.5', on ? 'border-blue-2 bg-sky-2' : 'border-line bg-card')}>
              <Avatar icon="flask-conical" size="sm" light />
              <Txt w="b" className="flex-1">
                {x.label}
              </Txt>
              {on && <Icon name="check" size={17} color="blue" />}
            </Pressable>
          );
        })}
      </View>
      <Field label={t('others')} icon="pencil">
        <Input value={other} onChangeText={(v) => onChange(labs, v)} placeholder={t('othersLabPh')} accessibilityLabel={t('others')} />
      </Field>
      <Button full icon="check" className="mt-4" onPress={onClose}>
        {tc('done')}
      </Button>
    </Sheet>
  );
}

/** E-signature: identity (PIN or fingerprint) + attestation, then the record is locked. */