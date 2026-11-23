import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useApiMutation, useTodayVitals, type SignConsultationInput } from '@dyh/api';
import { DIAGNOSES, LABS, MEDICINES, initials, type ISODate } from '@dyh/core';
import { common, useLoc, useT } from '@dyh/i18n';
import { Alert, Avatar, Badge, Button, Card, CheckBar, CheckTag, Chip, Dialog, Field, Icon, Input, Picker, ResultView, Row, Screen, SearchBox, Segmented, Sheet, Toggle, Txt, Viewfinder, VitalsCard, authenticateBiometric, cx, matches, toast, type PickOption } from '@dyh/ui-native';
import { DocHeader, go } from '../../src/components/shell';
import { VITALS_QNO, useClock, useDates, useDoctorId, useDraftFor, useMe, usePatient } from '../../src/lib';
import { dm } from '../../src/msgs';
import { useUi } from '../../src/store';
import { AddendumDialog, DelegateDialog } from '../../src/components/dialogs';

type Tab = 'text' | 'photo' | 'voice';
type Rx = { med: string | null; other: string; intake: string };
interface Form {
  title: string;
  findings: string;
  summary: string;
  dx: { id: string | null; other: string }[];
  rx: Rx[];
  labs: string[];
  labOther: string;
  notes: string;
  fu: { date: ISODate; purpose: string } | null;
}
type CheckKey = 'title' | 'findings' | 'dx' | 'rx' | 'lab' | 'notes' | 'fu';

const empty = (): Form => ({ title: '', findings: '', summary: '', dx: [{ id: null, other: '' }], rx: [{ med: null, other: '', intake: '' }], labs: [], labOther: '', notes: '', fu: null });

/** What the AI (photo / voice) or the secretary's draft fills in. Mock output of the real AI service. */
const aiForm = (en: boolean): Form => ({
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

export default function Consult() {
  const t = useT(dm);
  const tc = useT(common);
  const loc = useLoc();
  const pid = useUi((s) => s.patientId) ?? '';
  const fromDraft = useUi((s) => s.consultFromDraft);
  const p = usePatient(pid);
  const { draft } = useDraftFor(pid);
  const { data: vitals } = useTodayVitals();
  const en = loc({ tl: 'tl', en: 'en' }) === 'en';
  const [tab, setTab] = useState<Tab>('text');
  const [form, setForm] = useState<Form>(() => {
    if (!fromDraft) return empty();
    const f = aiForm(en);
    return draft?.followUp ? { ...f, fu: { date: draft.followUp.date, purpose: loc(draft.followUp.purpose) } } : f;
  });
  const [ai, setAi] = useState<false | 'photo' | 'voice'>(false);
  const [photoDone, setPhotoDone] = useState(false);
  const [consent, setConsent] = useState(false);
  const [rec, setRec] = useState<0 | 1 | 2>(0);
  const [chk, setChk] = useState<Partial<Record<CheckKey, boolean>>>({});
  const [signOpen, setSignOpen] = useState(false);
  const [signed, setSigned] = useState<null | { method: 'pin' | 'biometric'; hash: string; id: string }>(null);
  const [deleg, setDeleg] = useState(false);
  const [addendum, setAddendum] = useState(false);
  const { fuPending } = useDraftFor(pid);
  const dt = useDates();
  const { today } = useClock();
  const signedDate = dt.short(today);

  const needChk = !!ai || fromDraft;
  const keys: [CheckKey, string][] = [
    ['title', t('title')],
    ['findings', tc('findings')],
    ['dx', tc('diagnosis')],
    ['rx', tc('prescription')],
    ['lab', tc('labs')],
    ['notes', tc('notes')],
    ...(form.fu ? ([['fu', t('followUp')]] as [CheckKey, string][]) : []),
  ];
  const nChk = keys.filter(([k]) => chk[k]).length;
  const allOk = !needChk || nChk === keys.length;
  const tag = (k: CheckKey) =>
    needChk ? (
      <Row gap="gap-1.5">
        <CheckTag on={!!chk[k]} onToggle={() => setChk({ ...chk, [k]: !chk[k] })} />
        {ai ? (
          <Badge tone="blue" icon="sparkles">
            AI
          </Badge>
        ) : (
          <Badge tone="amber" icon="file-clock">
            {t('draft')}
          </Badge>
        )}
      </Row>
    ) : null;
  const fill = (src: 'photo' | 'voice') => {
    setForm(aiForm(en));
    setAi(src);
    setChk({});
  };
  const showForm = tab === 'text' || (tab === 'photo' && photoDone) || (tab === 'voice' && rec === 2);

  if (signed && p)
    return (
      <Screen header={<DocHeader title={t('consult')} icon="pen-line" back="/record" right={null} />}>
        <ResultView icon="badge-check" title={t('signed')} message={t('signedSub', { p: p.displayName, d: signedDate, t: '10:32 AM', m: signed.method === 'pin' ? 'PIN' : 'Fingerprint' })}>
          <Card className="mt-4 w-full">
            <Row gap="gap-1.5">
              <Icon name="lock" size={15} />
              <Txt w="b" size={13}>
                {t('lockedNote')}
              </Txt>
            </Row>
            <Txt size={12.5} className="mt-2 text-muted">
              {t('useAddendum')}
            </Txt>
            <Row className="mt-3 rounded-xl bg-soft p-3" gap="gap-2">
              <Icon name="link-2" size={16} color="muted" />
              <View className="flex-1">
                <Txt w="b" size={12.5}>
                  {t('hash')}
                </Txt>
                <Txt size={11} className="text-muted">
                  {signed.hash} · {t('hashTbd')}
                </Txt>
              </View>
            </Row>
          </Card>
          <Button full variant="o" icon="file-plus" className="mt-3" onPress={() => setAddendum(true)}>
            {t('addAddendum')}
          </Button>
          <Button full variant="g" icon="folder-heart" className="mt-2" onPress={() => go('/record')}>
            {t('backRecord')}
          </Button>
          {fuPending ? (
            <Card className="mt-3 w-full border-purple">
              <Row gap="gap-1.5">
                <Icon name="calendar-clock" size={15} color="purple" />
                <Txt w="b" size={13}>
                  {t('nextFuSec')}
                </Txt>
              </Row>
              <Txt size={11.5} className="mt-1 text-muted">
                {t('nextFuSecSub')}
              </Txt>
              <Button full size="lg" iconRight="arrow-right" className="mt-2" onPress={() => go('/followup')}>
                {t('next')}
              </Button>
            </Card>
          ) : (
            <>
              <Button full variant="o" icon="calendar-plus" className="mt-2" onPress={() => go('/followup')}>
                {t('setFu')}
              </Button>
              <Txt size={11} className="mt-1 text-center text-muted">
                {t('notEvery')}
              </Txt>
            </>
          )}
        </ResultView>
        <AddendumDialog open={addendum} onClose={() => setAddendum(false)} recordId={signed.id} />
      </Screen>
    );

  if (!p) return null;
  return (
    <Screen header={<DocHeader title={t('consult')} icon="pen-line" back="/record" right={null} />}>
      <Card className="flex-row items-center gap-3 p-3">
        <Avatar text={initials(p.displayName)} size="sm" />
        <View className="flex-1">
          <Txt w="b">{p.displayName}</Txt>
          <Txt size={12} className="text-muted">
            {p.id} · {p.age} {tc('years')}
          </Txt>
        </View>
        <Badge tone="purple" icon="stethoscope">
          {t('inConsult')}
        </Badge>
      </Card>
      <VitalsCard v={vitals?.[VITALS_QNO[pid] ?? '']} />
      {!fromDraft && (
        <Segmented
          className="mt-3"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'text', label: t('text'), icon: 'type' },
            { value: 'photo', label: t('photo'), icon: 'camera' },
            { value: 'voice', label: t('voice'), icon: 'mic' },
          ]}
        />
      )}
      {tab === 'text' && !fromDraft && (
        <Card className="mt-2 px-3 py-2.5">
          <Row gap="gap-1.5">
            <Icon name="pen-line" size={14} />
            <Txt w="b" size={12.5}>
              {t('typing')}
            </Txt>
            <Txt size={12.5} className="text-muted">
              · {t('noChecks')}
            </Txt>
          </Row>
          <Button size="sm" variant="g" full icon="send" className="mt-2" onPress={() => setDeleg(true)}>
            {t('delegInstead')}
          </Button>
        </Card>
      )}

      {tab === 'photo' && !photoDone && (
        <>
          <View className="mt-3">
            <Viewfinder height={270}>
              <View className="w-[78%] rounded-lg bg-white p-4" style={{ transform: [{ rotate: '-2deg' }] }}>
                <Txt size={13} style={{ color: '#203050', fontFamily: 'monospace' }}>
                  {'BP 150/94 HR 88 FBS 142\nDx: HTN, T2DM\nRx: Amlodipine 5mg OD\n    Metformin 500 BID\nLabs: Lipid, HbA1c'}
                </Txt>
              </View>
            </Viewfinder>
          </View>
          <Button variant="n" size="lg" full icon="camera" className="mt-3" onPress={() => (fill('photo'), setPhotoDone(true))}>
            {t('takePhoto')}
          </Button>
          <Txt size={12.5} className="mt-2 text-center text-muted">
            {t('photoHint')}
          </Txt>
        </>
      )}
      {tab === 'photo' && photoDone && (
        <View className="mt-3 self-start">
          <Button size="sm" variant="o" icon="rotate-ccw" onPress={() => setPhotoDone(false)}>
            {t('retake')}
          </Button>
        </View>
      )}
      {tab === 'voice' && rec < 2 && (
        <>
          <Card className="mt-3 flex-row items-center gap-3">
            <Toggle label={t('consent')} value={consent} onChange={setConsent} />
            <Txt w="s" className="flex-1">
              {t('consent')}
            </Txt>
          </Card>
          {rec === 1 ? (
            <Card className="mt-3 items-center">
              <Row gap="gap-1" className="h-10">
                {Array.from({ length: 18 }, (_, i) => (
                  <View key={i} className="w-1 rounded-full bg-red" style={{ height: 8 + ((i * 7) % 26) }} />
                ))}
              </Row>
              <Txt w="b" className="mt-2 text-red">
                ● {t('recording')} 02:41
              </Txt>
              <Button variant="r" full icon="square" className="mt-3" onPress={() => (fill('voice'), setRec(2))}>
                {t('stopFill')}
              </Button>
            </Card>
          ) : (
            <>
              <Button variant="r" size="lg" full icon="mic" className="mt-3" disabled={!consent} onPress={() => setRec(1)}>
                {t('startRec')}
              </Button>
              <Txt size={12.5} className="mt-2 text-center text-muted">
                {t('consentFirst')}
              </Txt>
            </>
          )}
        </>
      )}
      {tab === 'voice' && rec === 2 && (
        <View className="mt-3 self-start">
          <Button size="sm" variant="o" icon="mic" onPress={() => setRec(0)}>
            {t('recAgain')}
          </Button>
        </View>
      )}

      {showForm && (
        <>
          {fromDraft && <Alert kind="warn" icon="file-clock" className="mt-3" text={t('secDraftNote')} />}
          {!!ai && <Alert kind="info" icon="sparkles" className="mt-3" text={ai === 'voice' ? t('aiVoice') : t('aiPhoto')} />}
          {needChk && (
            <CheckBar
              title={ai ? t('chkFrom', { s: ai === 'voice' ? t('recordingW') : t('photoW') }) : t('chkSec')}
              sub={t('chkSub')}
              done={nChk}
              total={keys.length}
              onAll={() => setChk(Object.fromEntries(keys.map(([k]) => [k, true])))}
              onClear={() => setChk({})}
            />
          )}
          <ConsultForm form={form} setForm={setForm} tag={tag} />
          <Alert kind="info" className="mt-4" text={t('noAutosave')} />
          <Row className="mt-3" gap="gap-2">
            <Button variant="o" className="flex-1" icon="save" onPress={() => toast.info(t('draftSaved'))}>
              {t('draft')}
            </Button>
            <Button variant="n" size="lg" className="flex-1" icon="pen-tool" disabled={!allOk} onPress={() => setSignOpen(true)}>
              Save & Sign
            </Button>
          </Row>
          {!allOk && (
            <Row className="mt-2 justify-center" gap="gap-1">
              <Icon name="list-checks" size={13} color="amber" />
              <Txt size={11.5} className="text-amber">
                {t('checkAllFirst')}
              </Txt>
            </Row>
          )}
        </>
      )}
      <SignDialog
        open={signOpen}
        onClose={() => setSignOpen(false)}
        input={() => toInput(form, pid, ai ? ai : fromDraft ? 'secretary' : 'typed')}
        onSigned={(r) => {
          setSignOpen(false);
          setSigned(r);
        }}
      />
      <DelegateDialog open={deleg} onClose={() => setDeleg(false)} pid={pid} />
    </Screen>
  );
}

function toInput(f: Form, patientId: string, source: SignConsultationInput['source']): Omit<SignConsultationInput, 'doctorId' | 'verifiedWith'> {
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

function ConsultForm({ form, setForm, tag }: { form: Form; setForm: (f: Form) => void; tag: (k: CheckKey) => React.ReactNode }) {
  const t = useT(dm);
  const tc = useT(common);
  const [labSheet, setLabSheet] = useState(false);
  const up = (p: Partial<Form>) => setForm({ ...form, ...p });
  const other: PickOption = { value: 'other', label: t('others'), icon: 'pencil' };
  const dxOpts: PickOption[] = [...DIAGNOSES.map((x) => ({ value: x.id, label: x.label, icon: 'stethoscope' })), other];
  const rxOpts: PickOption[] = [...MEDICINES.map((x) => ({ value: x.id, label: x.label, icon: 'pill' })), other];
  const summarize = () => {
    const f = form.findings;
    up({ summary: f.startsWith('BP 150/94') ? t('summaryAuto') : f.split(/[.;]/).filter(Boolean).slice(0, 2).join('. ').slice(0, 110) + '…' });
  };
  const Label = ({ icon, text, k }: { icon: string; text: string; k: CheckKey }) => (
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
        const set = (p: Partial<Rx>) => up({ rx: form.rx.map((x, j) => (j === i ? { ...x, ...p } : x)) });
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

      {form.fu && <ProposedFu fu={form.fu} tag={tag('fu')} onRemove={() => up({ fu: null })} />}

      <LabSheet open={labSheet} onClose={() => setLabSheet(false)} labs={form.labs} other={form.labOther} onChange={(labs, labOther) => up({ labs, labOther })} />
    </>
  );
}

function ProposedFu({ fu, tag, onRemove }: { fu: { date: ISODate; purpose: string }; tag: React.ReactNode; onRemove: () => void }) {
  const t = useT(dm);
  const dt = useDates();
  return (
    <>
      <Row className="mb-1.5 mt-4 flex-wrap justify-between" gap="gap-1.5">
        <Row gap="gap-1.5">
          <Icon name="calendar-plus" size={15} color="muted" />
          <Txt w="b" size={13}>
            {t('proposedFu')}
          </Txt>
        </Row>
        {tag}
      </Row>
      <Card className="flex-row items-center gap-3 border-purple p-3">
        <Icon name="calendar-check" size={18} color="purple" />
        <View className="flex-1">
          <Txt w="b">{dt.dayDate(fu.date)}</Txt>
          <Txt size={12.5} className="text-muted">
            {fu.purpose || '—'}
          </Txt>
        </View>
        <Button size="sm" variant="o" icon="x" accessibilityLabel={t('remove')} onPress={onRemove} />
      </Card>
      <Txt size={11} className="mt-1 text-muted">
        {t('proposedFuHint')}
      </Txt>
    </>
  );
}

function LabSheet({ open, onClose, labs, other, onChange }: { open: boolean; onClose: () => void; labs: string[]; other: string; onChange: (l: string[], o: string) => void }) {
  const t = useT(dm);
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
function SignDialog({ open, onClose, input, onSigned }: { open: boolean; onClose: () => void; input: () => Omit<SignConsultationInput, 'doctorId' | 'verifiedWith'>; onSigned: (r: { method: 'pin' | 'biometric'; hash: string; id: string }) => void }) {
  const t = useT(dm);
  const tc = useT(common);
  const me = useDoctorId();
  const { doctor } = useMe();
  const [method, setMethod] = useState<'pin' | 'bio'>('pin');
  const [pin, setPin] = useState('123456');
  const [attest, setAttest] = useState(true);
  const sign = useApiMutation((a, v: SignConsultationInput) => a.signConsultation(v), [['history'], ['drafts']]);
  const go = async () => {
    if (method === 'bio' && !(await authenticateBiometric(t('placeFinger')))) return;
    const rec = await sign.mutateAsync({ ...input(), doctorId: me, verifiedWith: method === 'pin' ? 'pin' : 'biometric' });
    onSigned({ method: method === 'pin' ? 'pin' : 'biometric', hash: rec.integrityHash ?? '0x9f3c…a71e', id: rec.id });
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('signTitle')}
      icon="pen-tool"
      actions={
        <>
          <Button variant="o" className="flex-1" onPress={onClose}>
            {tc('back')}
          </Button>
          <Button variant="n" className="flex-1" icon="pen-tool" disabled={!attest || (method === 'pin' && pin.length < 6)} loading={sign.isPending} onPress={go}>
            {t('sign')}
          </Button>
        </>
      }
    >
      <Card className="flex-row items-center gap-3 p-3">
        <Icon name="user-check" size={18} color="blue" />
        <View className="flex-1">
          <Txt w="b">{doctor?.name}</Txt>
          <Txt size={11} className="text-muted">
            {t('ownAccount')} · {doctor?.email}
          </Txt>
        </View>
        <Badge tone="green" icon="shield-check">
          {t('verified')}
        </Badge>
      </Card>
      <Alert kind="warn" icon="lock" className="mt-3" text={t('permanent')} />
      <Field label={t('confirmId')} icon="shield-check">
        <Segmented
          value={method}
          onChange={setMethod}
          options={[
            { value: 'pin', label: 'PIN', icon: 'key-round' },
            { value: 'bio', label: 'Fingerprint', icon: 'fingerprint' },
          ]}
        />
        {method === 'pin' ? (
          <Input className="mt-2" value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))} secureTextEntry keyboardType="number-pad" placeholder="••••••" accessibilityLabel="PIN" />
        ) : (
          <View className="mt-3 items-center">
            <Avatar icon="fingerprint" size="xl" light />
            <Txt size={11} className="mt-1 text-muted">
              {t('placeFinger')}
            </Txt>
          </View>
        )}
      </Field>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: attest }} onPress={() => setAttest(!attest)} className="mt-3 flex-row items-start gap-2">
        <Icon name={attest ? 'square-check' : 'square'} size={19} color={attest ? 'blue' : 'muted'} />
        <Txt size={12.5} className="flex-1">
          {t('attest')}
        </Txt>
      </Pressable>
    </Dialog>
  );
}
