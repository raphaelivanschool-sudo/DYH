import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useApiMutation, useSchedule } from '@dyh/api';
import { type BlockedDate, type ISODate } from '@dyh/core';
import { common, useT } from '@dyh/i18n';
import { Alert, Avatar, Button, Card, Chip, Dialog, Field, Icon, IconButton, Input, ResultView, Rich, Row, Txt, cx } from '@dyh/ui-native';
import { SecScreen } from '../../src/components/shell';
import { useCurrent, useDates, useDoctorId } from '../../src/lib';
import { sm } from '../../src/msgs';
import { useUi } from '../../src/store';

type Tpl = 'Cancelled' | 'Late' | 'Rescheduled' | 'Other';
type Rec = 'today' | 'all';

/** Mock patient totals until the backend returns real counts. */
const TODAY_COUNT = 12;
const ALL_COUNT = 348;
const MAX_SMS = 160;

/**
 * Patient notices for the selected doctor only. Message text stays in Tagalog
 * (announcements are sent as written, not translated).
 */
export default function Sms() {
  const t = useT(sm);
  const tc = useT(common);
  const dt = useDates();
  const id = useDoctorId();
  const { doctor } = useCurrent();
  const { data: sched } = useSchedule(id);
  const blkDate = useUi((s) => s.smsBlockDate);
  const pend = sched?.blocked.filter((b) => b.status === 'pending') ?? [];
  const bk = pend.find((b) => b.date === blkDate) ?? null;
  const [rec, setRec] = useState<Rec>('today');
  const [app, setApp] = useState(true);
  const [sms, setSms] = useState(true);
  const [tpl, setTpl] = useState<Tpl>(bk ? 'Cancelled' : 'Late');
  const [subj, setSubj] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [sent, setSent] = useState<number | null>(null);
  const send = useApiMutation((a, v: { doctorId: string; date?: ISODate; template: string; message: string; channels: ('app' | 'sms')[] }) => a.sendPatientNotice(v));

  const name = doctor?.name ?? '';
  const tpls: Record<Tpl, string> = {
    Cancelled: bk
      ? `Paalala mula sa DYH: Hindi makakapag-clinic si ${name} sa ${dt.dayDate(bk.date)} (${bk.reason}). Pumili po ng bagong petsa sa Patient App o tumawag sa clinic.`
      : `Paalala mula sa DYH: Kanselado ang clinic ni ${name} ngayong araw. Makakatanggap kayo ng reschedule options.`,
    Late: `Paalala mula sa DYH: Mahuhuli ng 30 minuto si ${name}. Salamat sa inyong pasensya.`,
    Rescheduled: `Paalala mula sa DYH: Na-reschedule ang inyong appointment kay ${name}. Tingnan ang Patient App para sa bagong oras.`,
    Other: '',
  };
  const text = msg ?? tpls[tpl];
  const count = rec === 'all' ? ALL_COUNT : bk ? bk.affected : TODAY_COUNT;
  const channels = [app && 'app', sms && 'sms'].filter(Boolean) as ('app' | 'sms')[];
  const chLabel = [app && t('inApp'), sms && 'SMS'].filter(Boolean).join(' + ');

  const pickBlock = (b: BlockedDate) => {
    useUi.getState().set({ smsBlockDate: b.date });
    setTpl('Cancelled');
    setMsg(null);
  };
  const doSend = async () => {
    const r = await send.mutateAsync({ doctorId: id, date: bk?.date, template: tpl === 'Other' ? subj || 'Other' : tpl, message: text, channels });
    setConfirm(false);
    setSent(bk && rec === 'today' ? r.sent : count);
    useUi.getState().set({ smsBlockDate: null });
    setMsg(null);
  };

  if (sent != null)
    return (
      <SecScreen>
        <ResultView icon="send" title={t('queued')} message={t('queuedSub', { n: sent, d: name })}>
          <Row className="mt-4 w-full rounded-xl border border-dashed border-line px-3 py-2.5" gap="gap-2">
            <Icon name="construction" size={15} color="muted" />
            <Txt size={12} className="flex-1 text-muted">
              {t('mockSms')}
            </Txt>
          </Row>
          <Button full variant="o" icon="plus" className="mt-3" onPress={() => setSent(null)}>
            {t('another')}
          </Button>
        </ResultView>
      </SecScreen>
    );

  const tplMeta: [Tpl, string, string][] = [
    ['Cancelled', t('tCancelled'), 'calendar-x'],
    ['Late', t('tLate'), 'clock-alert'],
    ['Rescheduled', t('tResched'), 'calendar-arrow-up'],
    ['Other', t('tOther'), 'pencil'],
  ];
  const recRows: [Rec, string, number, string][] = bk
    ? [
        ['today', t('onlyBookedOn', { d: dt.dayDate(bk.date) }), bk.affected, 'calendar-x'],
        ['all', t('allOf', { n: name }), ALL_COUNT, 'users'],
      ]
    : [
        ['today', t('withToday'), TODAY_COUNT, 'calendar-check'],
        ['all', t('allOf', { n: name }), ALL_COUNT, 'users'],
      ];

  return (
    <SecScreen title={t('smsTitle')} icon="megaphone">
      <Rich size={12.5} className="text-muted" text={t('onlyFor', { n: name })} />

      {bk ? (
        <Card className="mt-3 border-red">
          <Row className="justify-between">
            <Row gap="gap-1.5">
              <Icon name="calendar-x" size={15} color="red" />
              <Txt w="b" size={13} className="text-red">
                {t('schedChange')}
              </Txt>
            </Row>
            <IconButton icon="x" size="sm" label={tc('clear')} onPress={() => useUi.getState().set({ smsBlockDate: null })} />
          </Row>
          {(
            [
              ['calendar', tc('date'), dt.dayDate(bk.date)],
              ['tag', t('reason'), bk.reason],
              ['users', t('affected'), t('patientsN', { n: bk.affected })],
            ] as const
          ).map(([ic, l, v]) => (
            <Row key={l} className="mt-2" gap="gap-2">
              <Icon name={ic} size={15} color="muted" />
              <Txt size={12.5} className="flex-1 text-muted">
                {l}
              </Txt>
              <Txt w="b" size={12.5}>
                {v}
              </Txt>
            </Row>
          ))}
          {bk.note && <Alert kind="info" icon="notebook-pen" className="mt-2" text={t('docNoteB', { n: bk.note })} />}
          <Row className="mt-2" gap="gap-1">
            <Icon name="timer" size={12} color="red" />
            <Txt size={11} className="flex-1 text-red">
              {t('autoDefault')}
            </Txt>
          </Row>
        </Card>
      ) : pend.length ? (
        <Alert kind="warn" icon="calendar-x" className="mt-3">
          <Rich size={12.5} text={t('toForward', { n: pend.length })} />
          <View className="mt-2 gap-1.5">
            {pend.map((b) => (
              <Button key={b.date} size="sm" variant="o" icon="send" onPress={() => pickBlock(b)}>
                {`${dt.dayDate(b.date)} · ${t('patientsN', { n: b.affected })}`}
              </Button>
            ))}
          </View>
        </Alert>
      ) : null}

      <Field icon="users" label={t('recipients')}>
        <View className="gap-2">
          {recRows.map(([k, l, n, ic]) => (
            <Pressable key={k} onPress={() => setRec(k)} className={cx('flex-row items-center gap-3 rounded-2xl border-[1.5px] p-3', rec === k ? 'border-blue-2 bg-sky-2' : 'border-line bg-card')}>
              <Avatar icon={ic} size="sm" light />
              <View className="flex-1">
                <Txt w="b" size={13}>
                  {l}
                </Txt>
                <Txt size={11.5} className="text-muted">
                  {t('patientsN', { n })}
                </Txt>
              </View>
              <Icon name={rec === k ? 'circle-check' : 'circle'} size={20} color={rec === k ? 'blue' : 'muted'} />
            </Pressable>
          ))}
        </View>
      </Field>

      <Field icon="bell" label={t('sendVia')} hint={!channels.length ? t('pickOne') : undefined}>
        <Row gap="gap-2">
          {(
            [
              [app, setApp, 'smartphone', t('inApp')],
              [sms, setSms, 'message-square-text', 'SMS'],
            ] as const
          ).map(([on, set, ic, l]) => (
            <Pressable key={l} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => set(!on)} className={cx('flex-1 flex-row items-center gap-2 rounded-xl border-[1.5px] px-3 py-3', on ? 'border-blue-2 bg-sky-2' : 'border-line bg-card')}>
              <Icon name={on ? 'square-check' : 'square'} size={18} color={on ? 'blue' : 'muted'} />
              <Icon name={ic} size={16} />
              <Txt w="b" size={12.5} className="flex-1">
                {l}
              </Txt>
            </Pressable>
          ))}
        </Row>
      </Field>

      <Field icon="layout-template" label="Template">
        <Row className="flex-wrap" gap="gap-2">
          {tplMeta.map(([k, l, ic]) => (
            <Chip
              key={k}
              icon={ic}
              on={tpl === k}
              onPress={() => {
                setTpl(k);
                setMsg(null);
              }}
            >
              {l}
            </Chip>
          ))}
        </Row>
      </Field>
      {tpl === 'Other' && (
        <Field icon="pencil" label={t('subject')}>
          <Input value={subj} onChangeText={setSubj} placeholder={t('subjectPh')} accessibilityLabel={t('subject')} />
        </Field>
      )}
      <Field icon="message-square" label={t('message')}>
        <Input multiline value={text} onChangeText={setMsg} placeholder={t('messagePh')} accessibilityLabel={t('message')} style={{ minHeight: 110 }} />
        <Txt size={11} className={cx('mt-1 text-right', text.length > MAX_SMS ? 'text-red' : 'text-muted')}>
          {text.length}/{MAX_SMS}
        </Txt>
      </Field>
      <Button size="lg" full icon="send" className="mt-3" disabled={!channels.length || !text.trim()} onPress={() => setConfirm(true)}>
        {t('send')}
      </Button>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('confirmRec')}
        icon="users"
        actions={
          <>
            <Button variant="o" className="flex-1" onPress={() => setConfirm(false)}>
              {tc('cancel')}
            </Button>
            <Button className="flex-1" icon="send" loading={send.isPending} onPress={doSend}>
              {t('send')}
            </Button>
          </>
        }
      >
        <Alert kind="warn" icon="users" text={t('sendingTo', { n: count, d: name, c: chLabel })} />
        {app && <Alert kind="info" icon="smartphone" className="mt-2" text={t('alsoApp')} />}
        {bk && <Alert kind="info" icon="eye" className="mt-2" text={t('docSees')} />}
      </Dialog>
    </SecScreen>
  );
}
