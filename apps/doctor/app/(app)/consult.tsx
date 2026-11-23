import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useApiMutation, useTodayVitals, type SignConsultationInput } from '@dyh/api';
import { initials, type ISODate } from '@dyh/core';
import { common, useLoc, useT } from '@dyh/i18n';
import { Alert, Avatar, Badge, Button, Card, CheckBar, CheckTag, ConsultForm, Dialog, Field, Icon, Input, ResultView, Row, Screen, Segmented, Toggle, Txt, Viewfinder, VitalsCard, aiConsult, authenticateBiometric, consultToInput, emptyConsult, toast, type ConsultCheckKey, type ConsultFormState } from '@dyh/ui-native';
import { DocHeader, go } from '../../src/components/shell';
import { VITALS_QNO, useClock, useDates, useDoctorId, useDraftFor, useMe, usePatient } from '../../src/lib';
import { dm } from '../../src/msgs';
import { useUi } from '../../src/store';
import { AddendumDialog, DelegateDialog } from '../../src/components/dialogs';

type Tab = 'text' | 'photo' | 'voice';
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
  const [form, setForm] = useState<ConsultFormState>(() => {
    if (!fromDraft) return emptyConsult();
    const f = aiConsult(en);
    return draft?.followUp ? { ...f, fu: { date: draft.followUp.date, purpose: loc(draft.followUp.purpose) } } : f;
  });
  const [ai, setAi] = useState<false | 'photo' | 'voice'>(false);
  const [photoDone, setPhotoDone] = useState(false);
  const [consent, setConsent] = useState(false);
  const [rec, setRec] = useState<0 | 1 | 2>(0);
  const [chk, setChk] = useState<Partial<Record<ConsultCheckKey, boolean>>>({});
  const [signOpen, setSignOpen] = useState(false);
  const [signed, setSigned] = useState<null | { method: 'pin' | 'biometric'; hash: string; id: string }>(null);
  const [deleg, setDeleg] = useState(false);
  const [addendum, setAddendum] = useState(false);
  const { fuPending } = useDraftFor(pid);
  const dt = useDates();
  const { today } = useClock();
  const signedDate = dt.short(today);

  const needChk = !!ai || fromDraft;
  const keys: [ConsultCheckKey, string][] = [
    ['title', t('title')],
    ['findings', tc('findings')],
    ['dx', tc('diagnosis')],
    ['rx', tc('prescription')],
    ['lab', tc('labs')],
    ['notes', tc('notes')],
    ...(form.fu ? ([['fu', t('followUp')]] as [ConsultCheckKey, string][]) : []),
  ];
  const nChk = keys.filter(([k]) => chk[k]).length;
  const allOk = !needChk || nChk === keys.length;
  const tag = (k: ConsultCheckKey) =>
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
    setForm(aiConsult(en));
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
          <ConsultForm form={form} setForm={setForm} tag={tag} followUp={form.fu && <ProposedFu fu={form.fu} tag={tag('fu')} onRemove={() => setForm({ ...form, fu: null })} />} />
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
        input={() => consultToInput(form, pid, ai ? ai : fromDraft ? 'secretary' : 'typed')}
        onSigned={(r) => {
          setSignOpen(false);
          setSigned(r);
        }}
      />
      <DelegateDialog open={deleg} onClose={() => setDeleg(false)} pid={pid} />
    </Screen>
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
