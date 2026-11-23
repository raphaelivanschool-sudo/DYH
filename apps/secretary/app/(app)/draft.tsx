import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useApiMutation, useSchedule, useTodayVitals, type DelegatedPatient, type FindingsDraftInput } from '@dyh/api';
import { isFollowUpDateOk, parseISO, type ISODate } from '@dyh/core';
import { common, useLoc, useT } from '@dyh/i18n';
import {
  Alert, Badge, Button, Card, CheckBar, CheckTag, Chip, ConsultForm, Dialog, Empty, Icon, Input, MonthCalendar, Rich, Row, SearchBox, SectionTitle, Segmented, Stepper, Txt, Viewfinder, VitalsCard,
  aiConsult, consultToInput, cx, emptyConsult, matches, toast, type ConsultCheckKey, type ConsultFormState,
} from '@dyh/ui-native';
import { SecScreen } from '../../src/components/shell';
import { useClock, useCurrent, useDates, useDelegated, useDoctorId, useDrafts, usePatients } from '../../src/lib';
import { sm } from '../../src/msgs';

type Mode = 'text' | 'photo';
type Filter = 'all' | 'pend' | 'done';
type Status = 'signed' | 'fu' | 'wait';

/** Findings draft: choose patient → note & method → fill in → preview & confirm. */
export default function Draft() {
  const t = useT(sm);
  const loc = useLoc();
  const id = useDoctorId();
  const { data: rows } = useDelegated();
  const [step, setStep] = useState(0);
  const [sel, setSel] = useState<DelegatedPatient | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [form, setForm] = useState<ConsultFormState>(emptyConsult);
  const [chk, setChk] = useState<Partial<Record<ConsultCheckKey, boolean>>>({});
  const en = loc({ tl: 'tl', en: 'en' }) === 'en';
  const labels = [t('sChoose'), t('sNote'), t('sFill'), t('sPreview')];

  const reset = () => {
    setStep(0);
    setSel(null);
    setMode(null);
    setForm(emptyConsult());
    setChk({});
  };

  return (
    <SecScreen title={t('draft')} icon="file-pen">
      <Stepper total={4} current={step + 1} label={labels[step]} />
      {step === 0 && (
        <ChooseStep
          rows={rows ?? []}
          onPick={(p) => {
            setSel(p);
            setMode(null);
            setForm(emptyConsult());
            setChk({});
            setStep(1);
          }}
        />
      )}
      {step === 1 && sel && (
        <NoteStep
          p={sel}
          mode={mode}
          setMode={setMode}
          onChange={() => setStep(0)}
          onStart={() => {
            setForm(mode === 'photo' ? aiConsult(en) : emptyConsult());
            setChk({});
            setStep(2);
          }}
        />
      )}
      {step === 2 && sel && mode && <FillStep p={sel} mode={mode} form={form} setForm={setForm} chk={chk} setChk={setChk} onBack={() => setStep(1)} onNext={() => setStep(3)} />}
      {step === 3 && sel && mode && <PreviewStep doctorId={id} p={sel} mode={mode} form={form} onEdit={() => setStep(2)} onDone={reset} />}
    </SecScreen>
  );
}

function PatientCard({ p, right }: { p: DelegatedPatient; right?: React.ReactNode }) {
  const { doctor } = useCurrent();
  return (
    <Card className="mt-3 flex-row items-center gap-3 p-3">
      <View className="min-w-[62px] items-center rounded-xl bg-sky px-2 py-2">
        <Txt w="x" size={13.5} className="text-blue">
          {p.number}
        </Txt>
      </View>
      <View className="flex-1">
        <Txt w="b">{p.name}</Txt>
        <Txt size={12} className="text-muted">
          {doctor?.name} · {p.time}
        </Txt>
      </View>
      {right}
    </Card>
  );
}

/* ---------------- step 1: choose patient ---------------- */

function ChooseStep({ rows, onPick }: { rows: DelegatedPatient[]; onPick: (p: DelegatedPatient) => void }) {
  const t = useT(sm);
  const [f, setF] = useState<Filter>('all');
  const [s, setS] = useState('');
  const { data: drafts } = useDrafts();
  const { data: pts } = usePatients();
  const nPend = rows.filter((p) => !p.drafted).length;
  const statusOf = (name: string): Status => {
    const pid = pts?.find((x) => x.displayName === name)?.id;
    const d = drafts?.find((x) => x.patientId === pid);
    if (!d || !d.signed) return 'wait';
    return d.followUp && !d.followUpDone ? 'fu' : 'signed';
  };
  const list = rows.filter((p) => (f === 'all' || (f === 'done' ? !!p.drafted : !p.drafted)) && matches([p.name, p.number], s));
  const st: Record<Status, [string, 'green' | 'purple' | 'amber', string]> = {
    signed: ['badge-check', 'green', t('signedB')],
    fu: ['calendar-clock', 'purple', t('fuPendingB')],
    wait: ['hourglass', 'amber', t('awaitDoc')],
  };
  return (
    <>
      <Row className="mt-3 flex-wrap" gap="gap-2">
        {(
          [
            ['all', t('fAll'), rows.length],
            ['pend', t('fPend'), nPend],
            ['done', t('fDone'), rows.length - nPend],
          ] as const
        ).map(([k, l, n]) => (
          <Chip key={k} on={f === k} onPress={() => setF(k)}>
            {`${l} · ${n}`}
          </Chip>
        ))}
      </Row>
      <SearchBox value={s} onChange={setS} placeholder={t('searchPt')} className="mb-1 mt-3" />
      {list.length ? (
        list.map((p) => {
          const [ic, tone, label] = st[statusOf(p.name)];
          return (
            <Pressable key={p.number} disabled={!!p.drafted} onPress={() => onPick(p)} className={cx('mt-2 flex-row items-center gap-3 rounded-2xl border border-line bg-card p-3', !!p.drafted && 'opacity-75')}>
              <View className="min-w-[62px] items-center rounded-xl bg-sky px-2 py-2">
                <Txt w="x" size={13.5} className="text-blue">
                  {p.number}
                </Txt>
              </View>
              <View className="flex-1">
                <Txt w="b">{p.name}</Txt>
                <Row className="mt-1 flex-wrap" gap="gap-1">
                  {p.drafted ? (
                    <>
                      <Badge tone="blue" icon="send">
                        {t('sent')} · {p.drafted === 'photo' ? t('photo') : t('text')}
                      </Badge>
                      <Badge tone={tone} icon={ic}>
                        {label}
                      </Badge>
                    </>
                  ) : (
                    <>
                      <Badge icon="clock">{p.time}</Badge>
                      {p.delegated && (
                        <Badge tone="purple" icon="notebook-pen">
                          {t('docNote')}
                        </Badge>
                      )}
                    </>
                  )}
                </Row>
              </View>
              {!p.drafted && <Icon name="chevron-right" size={18} color="muted" />}
            </Pressable>
          );
        })
      ) : (
        <Empty icon="users" text={t('noneFilter')} />
      )}
      <Alert kind="info" icon="info" className="mt-3" text={t('onlyDone')} />
    </>
  );
}

/* ---------------- step 2: doctor note & method ---------------- */

function NoteStep({ p, mode, setMode, onChange, onStart }: { p: DelegatedPatient; mode: Mode | null; setMode: (m: Mode) => void; onChange: () => void; onStart: () => void }) {
  const t = useT(sm);
  const loc = useLoc();
  const { doctor } = useCurrent();
  return (
    <>
      <PatientCard
        p={p}
        right={
          <Button size="sm" variant="o" icon="users" onPress={onChange}>
            {t('change')}
          </Button>
        }
      />
      <Card className="mt-3 border-purple bg-purple-bg">
        <Row gap="gap-1.5">
          <Icon name="notebook-pen" size={15} color="purple" />
          <Txt w="b" size={13} className="text-purple">
            {t('noteFrom', { n: doctor?.name ?? '' })}
          </Txt>
        </Row>
        <Txt size={13} className={cx('mt-2', !p.note && 'text-muted')}>
          {p.note ? loc(p.note) : t('noNote')}
        </Txt>
      </Card>
      <SectionTitle icon="square-mouse-pointer">{t('how')}</SectionTitle>
      <View className="gap-2">
        {(
          [
            ['text', 'type', t('text'), t('textSub')],
            ['photo', 'camera', t('photo'), t('photoSub')],
          ] as const
        ).map(([k, ic, l, sub]) => (
          <Pressable key={k} onPress={() => setMode(k)} className={cx('flex-row items-center gap-3 rounded-2xl border-[1.5px] p-3', mode === k ? 'border-blue-2 bg-sky-2' : 'border-line bg-card')}>
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-sky">
              <Icon name={ic} size={19} color="blue" />
            </View>
            <View className="flex-1">
              <Txt w="b">{l}</Txt>
              <Txt size={12} className="text-muted">
                {sub}
              </Txt>
            </View>
            <Icon name={mode === k ? 'circle-check' : 'circle'} size={20} color={mode === k ? 'blue' : 'muted'} />
          </Pressable>
        ))}
      </View>
      {mode === 'photo' && (
        <>
          <View className="mt-3">
            <Viewfinder height={200}>
              <View className="w-[80%] rounded-lg bg-white p-4" style={{ transform: [{ rotate: '-2deg' }] }}>
                <Txt size={13} style={{ color: '#203050', fontFamily: 'monospace' }}>
                  {'BP 150/94 HR 88 FBS 142\nDx: HTN, T2DM\nRx: Amlodipine 5mg OD\n    Metformin 500 BID\nLabs: Lipid, HbA1c'}
                </Txt>
              </View>
            </Viewfinder>
          </View>
          <Button variant="n" size="lg" full icon="camera" className="mt-3" onPress={onStart}>
            {t('takePhoto')}
          </Button>
        </>
      )}
      {mode === 'text' && (
        <Button size="lg" full icon="type" className="mt-3" onPress={onStart}>
          {t('startType')}
        </Button>
      )}
      <Alert kind="warn" icon="shield-check" className="mt-3" text={t('docStillSigns')} />
    </>
  );
}

/* ---------------- step 3: fill in ---------------- */

function FillStep({
  p, mode, form, setForm, chk, setChk, onBack, onNext,
}: { p: DelegatedPatient; mode: Mode; form: ConsultFormState; setForm: (f: ConsultFormState) => void; chk: Partial<Record<ConsultCheckKey, boolean>>; setChk: (c: Partial<Record<ConsultCheckKey, boolean>>) => void; onBack: () => void; onNext: () => void }) {
  const t = useT(sm);
  const loc = useLoc();
  const photo = mode === 'photo';
  const keys: ConsultCheckKey[] = ['title', 'findings', 'dx', 'rx', 'lab', 'notes', ...(form.fu ? (['fu'] as const) : [])];
  const nChk = keys.filter((k) => chk[k]).length;
  const allOk = !photo || nChk === keys.length;
  const tag = (k: ConsultCheckKey) =>
    photo ? (
      <Row gap="gap-1.5">
        <CheckTag on={!!chk[k]} onToggle={() => setChk({ ...chk, [k]: !chk[k] })} />
        <Badge tone="blue" icon="sparkles">
          AI
        </Badge>
      </Row>
    ) : null;
  return (
    <>
      <PatientCard
        p={p}
        right={
          <Badge tone={photo ? 'blue' : 'gray'} icon={photo ? 'camera' : 'type'}>
            {photo ? t('photo') : t('text')}
          </Badge>
        }
      />
      {p.note && <Alert kind="info" icon="notebook-pen" className="mt-2" text={`**${t('docNoteLbl')}:** ${loc(p.note)}`} />}
      {photo && (
        <>
          <Alert kind="info" icon="sparkles" className="mt-2" text={t('aiPhoto')} />
          <View className="mt-2">
            <CheckBar title={t('chkPhoto')} sub={t('chkSub')} done={nChk} total={keys.length} onAll={() => setChk(Object.fromEntries(keys.map((k) => [k, true])))} onClear={() => setChk({})} />
          </View>
        </>
      )}
      <ConsultForm form={form} setForm={setForm} tag={tag} followUp={<FollowUpBlock form={form} setForm={setForm} tag={tag('fu')} />} />
      <Row className="mt-4">
        <Button variant="o" icon="chevron-left" accessibilityLabel="Back" onPress={onBack} />
        <View className="flex-1">
          <Button size="lg" full icon="eye" disabled={!allOk} onPress={onNext}>
            {t('preview')}
          </Button>
        </View>
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
  );
}

/** Optional follow-up proposal, limited to the doctor's open clinic days. */
function FollowUpBlock({ form, setForm, tag }: { form: ConsultFormState; setForm: (f: ConsultFormState) => void; tag: React.ReactNode }) {
  const t = useT(sm);
  const id = useDoctorId();
  const { doctor } = useCurrent();
  const { today } = useClock();
  const [ty, tm] = parseISO(today);
  const { data: sched } = useSchedule(id);
  const [mon, setMon] = useState(0);
  const fu = form.fu;
  const week = sched?.week ?? [];
  const blocked = sched?.blocked ?? [];
  const kind = (d: ISODate) => (blocked.some((b) => b.date === d) ? 'blk' : isFollowUpDateOk(d, today, week, blocked) ? 'ok' : 'dis');
  const base = new Date(ty, tm + mon, 1);
  return (
    <>
      <Row className="mb-1.5 mt-4 flex-wrap justify-between" gap="gap-1.5">
        <Row gap="gap-1.5">
          <Icon name="calendar-plus" size={15} color="muted" />
          <Txt w="b" size={13}>
            {t('fuIf')}
          </Txt>
        </Row>
        {fu && tag}
      </Row>
      <Segmented
        value={fu ? 'yes' : 'none'}
        onChange={(v) => setForm({ ...form, fu: v === 'yes' ? { date: '' as ISODate, purpose: '' } : null })}
        options={[
          { value: 'none', label: t('none') },
          { value: 'yes', label: t('yes'), icon: 'calendar-plus' },
        ]}
      />
      {fu && (
        <>
          <Txt size={12} className="mt-3 text-muted">
            {t('clinicOf', { n: doctor?.name ?? '' })}
          </Txt>
          <View className="mt-2">
            <MonthCalendar year={base.getFullYear()} month0={base.getMonth()} kind={kind} selected={fu.date || null} onSelect={(d) => setForm({ ...form, fu: { ...fu, date: d } })} today={today} canPrev={mon > 0} canNext={mon < 5} onPrev={() => setMon(mon - 1)} onNext={() => setMon(mon + 1)} />
          </View>
          <Input className="mt-3" value={fu.purpose} onChangeText={(v) => setForm({ ...form, fu: { ...fu, purpose: v } })} placeholder={t('purposePh')} accessibilityLabel={t('purposePh')} />
          <Alert kind="info" icon="info" className="mt-2" text={t('fuProposal')} />
        </>
      )}
    </>
  );
}

/* ---------------- step 4: preview & confirm ---------------- */

function PreviewStep({ doctorId, p, mode, form, onEdit, onDone }: { doctorId: string; p: DelegatedPatient; mode: Mode; form: ConsultFormState; onEdit: () => void; onDone: () => void }) {
  const t = useT(sm);
  const tc = useT(common);
  const dt = useDates();
  const { today } = useClock();
  const { doctor } = useCurrent();
  const { data: vit } = useTodayVitals();
  const { data: pts } = usePatients();
  const [confirm, setConfirm] = useState(false);
  const input = consultToInput(form, pts?.find((x) => x.displayName === p.name)?.id ?? '', 'secretary');
  const submit = useApiMutation((a, v: FindingsDraftInput) => a.submitFindingsDraft(v));
  const fu = form.fu?.date ? { date: form.fu.date, purpose: form.fu.purpose || '—' } : undefined;
  const send = async () => {
    const { source: _s, ...rest } = input;
    await submit.mutateAsync({ ...rest, doctorId, queueNumber: p.number, patientName: p.name, mode, followUp: fu });
    setConfirm(false);
    toast.success(t('draftSent'));
    onDone();
  };
  const block = (icon: string, title: string, body: string) => (
    <View className="mt-3">
      <Row gap="gap-1.5">
        <Icon name={icon} size={14} color="muted" />
        <Txt w="b" size={12.5} className="text-muted">
          {title}
        </Txt>
      </Row>
      <Txt size={13.5} className="mt-1">
        {body}
      </Txt>
    </View>
  );
  const bullets = (xs: string[]) => xs.map((x) => `• ${x}`).join('\n') || '—';
  return (
    <>
      <Card className="mt-3">
        <Row className="flex-wrap" gap="gap-1.5">
          <Badge tone="amber" icon="file-clock">
            {t('draftB')}
          </Badge>
          <Badge icon={mode === 'photo' ? 'camera' : 'type'}>{mode === 'photo' ? t('photo') : t('text')}</Badge>
        </Row>
        <Txt w="x" size={17} className="mt-2">
          {form.title || t('noTitle')}
        </Txt>
        <Txt size={12} className="mt-0.5 text-muted">
          {p.name} · {p.number} · {dt.short(today)}
        </Txt>
        <VitalsCard v={vit?.[p.number]} title="Vital Signs" />
        {!!form.summary && block('text-quote', t('summary'), form.summary)}
        {block('clipboard-list', tc('findings'), form.findings || '—')}
        {block('stethoscope', tc('diagnosis'), bullets(input.diagnoses))}
        <View className="mt-3">
          <Row gap="gap-1.5">
            <Icon name="pill" size={14} color="muted" />
            <Txt w="b" size={12.5} className="text-muted">
              {tc('prescription')}
            </Txt>
          </Row>
          {input.prescriptions.length ? (
            input.prescriptions.map((r, i) => (
              <View key={i} className="mt-2 rounded-xl bg-soft px-3 py-2.5">
                <Txt w="b" size={13.5}>
                  {r.medicine}
                </Txt>
                <Row className="mt-0.5" gap="gap-1">
                  <Icon name="clock" size={12} color="muted" />
                  <Txt size={12} className="text-muted">
                    {typeof r.intake === 'string' ? r.intake || '—' : '—'}
                  </Txt>
                </Row>
              </View>
            ))
          ) : (
            <Txt className="mt-1">—</Txt>
          )}
        </View>
        {block('flask-conical', tc('labs'), bullets(input.labs))}
        {block('notebook-pen', tc('notes'), form.notes || '—')}
        {form.fu && block('calendar-plus', t('proposedFu'), `${form.fu.date ? dt.dayDate(form.fu.date) : '—'} · ${form.fu.purpose || '—'}\n${t('confirmedSep')}`)}
        <Row className="mt-4 rounded-xl border border-dashed border-line px-3 py-2.5" gap="gap-2">
          <Icon name="user-pen" size={15} color="muted" />
          <Txt size={12} className="flex-1 text-muted">
            {t('preparedFor', { n: doctor?.name ?? '' })}
          </Txt>
        </Row>
      </Card>
      <Row className="mt-4">
        <Button variant="o" icon="pencil" onPress={onEdit}>
          {tc('edit')}
        </Button>
        <View className="flex-1">
          <Button variant="ok" size="lg" full icon="check" onPress={() => setConfirm(true)}>
            {t('confirm')}
          </Button>
        </View>
      </Row>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('saveDraftQ')}
        icon="file-check"
        actions={
          <>
            <Button variant="o" className="flex-1" onPress={() => setConfirm(false)}>
              {tc('cancel')}
            </Button>
            <Button variant="ok" className="flex-1" icon="send" loading={submit.isPending} onPress={send}>
              {t('confirm')}
            </Button>
          </>
        }
      >
        <Rich size={13.5} className="text-muted" text={t('saveDraftBody', { p: p.name, d: doctor?.name ?? '' }) + (form.fu ? ' ' + t('saveDraftFu') : '')} />
        <Alert kind="warn" icon="shield-alert" className="mt-3" text={t('notPermanent')} />
      </Dialog>
    </>
  );
}

