import { useState } from 'react';
import { View } from 'react-native';
import { useApiMutation, useSchedule } from '@dyh/api';
import { initials, isFollowUpDateOk, nextClinicDayAfter, parseISO, type Booking, type ISODate } from '@dyh/core';
import { common, useLoc, useT } from '@dyh/i18n';
import { Alert, Avatar, Badge, Button, Card, CheckBar, CheckTag, Chip, Dialog, Field, Icon, Input, MonthCalendar, ResultView, Row, Rows, Screen, SectionTitle, Segmented, Txt, authenticateBiometric } from '@dyh/ui-native';
import { DocHeader, go } from '../../src/components/shell';
import { useClock, useDates, useDoctorId, useDraftFor, useMe, usePatient } from '../../src/lib';
import { dm } from '../../src/msgs';
import { useUi } from '../../src/store';

type FuKey = 'date' | 'purpose' | 'note';

export default function FollowUp() {
  const t = useT(dm);
  const tc = useT(common);
  const loc = useLoc();
  const dt = useDates();
  const { today } = useClock();
  const [ty, tm] = parseISO(today);
  const me = useDoctorId();
  const pid = useUi((s) => s.patientId) ?? '';
  const p = usePatient(pid);
  const { fuPending: review } = useDraftFor(pid);
  const { data: sched } = useSchedule(me);
  const [date, setDate] = useState<ISODate | null>(review?.followUp?.date ?? null);
  const startOff = date ? (parseISO(date)[0] - ty) * 12 + parseISO(date)[1] - tm : 0;
  const [mon, setMon] = useState(Math.max(0, startOff));
  const [purpose, setPurpose] = useState(review?.followUp ? loc(review.followUp.purpose) : t('purposeDefault'));
  const [note, setNote] = useState(t('notePtDefault'));
  const [chk, setChk] = useState<Partial<Record<FuKey, boolean>>>({});
  const [signOpen, setSignOpen] = useState(false);
  const [booked, setBooked] = useState<Booking | null>(null);
  const book = useApiMutation((a, v: { patientId: string; doctorId: string; date: ISODate; purpose: string; note?: string }) => a.bookFollowUp(v), [['drafts'], ['followUps']]);

  const week = sched?.week ?? [];
  const blocked = sched?.blocked ?? [];
  const rvOk = !review || (['date', 'purpose', 'note'] as FuKey[]).every((k) => chk[k]);
  const fck = (k: FuKey) => (review ? <CheckTag on={!!chk[k]} onToggle={() => setChk({ ...chk, [k]: !chk[k] })} /> : null);
  const base = new Date(ty, tm + mon, 1);
  const kind = (d: ISODate) => (blocked.some((b) => b.date === d) ? 'blk' : isFollowUpDateOk(d, today, week, blocked) ? 'ok' : 'dis');
  const picks: [number, string][] = [
    [7, t('w1')],
    [14, t('w2')],
    [30, t('mo1')],
    [90, t('mo3')],
  ];
  const doBook = async () => {
    if (!date) return;
    const b = await book.mutateAsync({ patientId: pid, doctorId: me, date, purpose, note });
    setSignOpen(false);
    setBooked(b);
  };

  if (booked && p)
    return (
      <Screen header={<DocHeader title={t('followUp')} icon="calendar-plus" back="/record" right={null} />}>
        <ResultView icon="calendar-check" color="#6a3db5" title={t('fuBooked')} message={t('fuBookedSub', { n: p.displayName })}>
          <Card className="mt-3 w-full px-4 py-1">
            <Rows
              rows={[
                ['calendar', tc('date'), dt.dayDate(booked.date)],
                ['qr-code', 'Booking QR', booked.id],
                ['tag', t('type'), t('fuOnline')],
              ]}
            />
          </Card>
          <Button size="lg" full icon="house" className="mt-6" onPress={() => go('/home')}>
            {t('goHome')}
          </Button>
          <Button variant="o" full icon="folder-heart" className="mt-2" onPress={() => go('/record')}>
            {t('backRecord')}
          </Button>
        </ResultView>
      </Screen>
    );
  if (!p) return null;

  return (
    <Screen header={<DocHeader title={review ? t('reviewFu') : t('followUp')} icon="calendar-plus" back="/record" right={null} />}>
      <Card className="flex-row items-center gap-3 p-3.5">
        <Avatar text={initials(p.displayName)} light />
        <View className="flex-1">
          <Txt w="b">{p.displayName}</Txt>
          <Txt size={12} className="text-muted">
            {p.id}
          </Txt>
        </View>
        {review && (
          <Badge tone="amber" icon="file-clock">
            {t('draft')}
          </Badge>
        )}
      </Card>

      {review ? (
        <>
          <Row className="mt-3" gap="gap-1.5">
            <View className="h-1.5 flex-1 rounded-full bg-green" />
            <View className="h-1.5 flex-1 rounded-full bg-purple" />
          </Row>
          <Row className="mt-1 justify-between">
            <Row gap="gap-1">
              <Icon name="circle-check" size={12} color="green" />
              <Txt size={11} className="text-green">
                {t('step1')}
              </Txt>
            </Row>
            <Row gap="gap-1">
              <Icon name="calendar-clock" size={12} color="purple" />
              <Txt w="b" size={11} className="text-purple">
                {t('step2')}
              </Txt>
            </Row>
          </Row>
          <Alert kind="warn" icon="file-clock" className="mt-3" text={t('proposedBy', { n: `Sek. ${review.preparedBy}` })} />
          <CheckBar title={t('checkFu')} sub={t('checked')} done={(['date', 'purpose', 'note'] as FuKey[]).filter((k) => chk[k]).length} total={3} onAll={() => setChk({ date: true, purpose: true, note: true })} onClear={() => setChk({})} />
        </>
      ) : (
        <Alert kind="warn" className="mt-3" text={t('autoBook')} />
      )}

      <SectionTitle icon="timer">{t('quickPick')}</SectionTitle>
      <Row className="flex-wrap" gap="gap-2">
        {picks.map(([n, l]) => {
          const d = nextClinicDayAfter(today, n, week, blocked);
          if (!d) return null;
          return (
            <Chip
              key={n}
              icon="calendar"
              on={date === d}
              onPress={() => {
                setDate(d);
                const [y, m] = parseISO(d);
                setMon((y - ty) * 12 + m - tm);
              }}
            >
              {l}
            </Chip>
          );
        })}
      </Row>

      <SectionTitle icon="calendar" right={fck('date')}>
        {t('fuDate')}
      </SectionTitle>
      <MonthCalendar year={base.getFullYear()} month0={base.getMonth()} kind={kind} selected={date} onSelect={setDate} today={today} canPrev={mon > 0} canNext={mon < 5} onPrev={() => setMon(mon - 1)} onNext={() => setMon(mon + 1)} />
      {date && <Alert kind="info" icon="calendar-check" className="mt-3" text={`**${t('selected')}:** ${dt.dayDate(date)}, ${parseISO(date)[0]}`} />}

      <FieldWithTag icon="target" label={t('purpose')} tag={fck('purpose')}>
        <Input value={purpose} onChangeText={setPurpose} accessibilityLabel={t('purpose')} />
      </FieldWithTag>
      <FieldWithTag icon="message-square" label={t('notePt')} tag={fck('note')}>
        <Input multiline value={note} onChangeText={setNote} accessibilityLabel={t('notePt')} />
      </FieldWithTag>

      {review ? (
        <>
          <Button variant="n" size="lg" full icon="pen-tool" className="mt-4" disabled={!date || !rvOk} onPress={() => setSignOpen(true)}>
            {t('signConfirm')}
          </Button>
          {!rvOk && (
            <Row className="mt-2 justify-center" gap="gap-1">
              <Icon name="list-checks" size={13} color="amber" />
              <Txt size={11.5} className="text-amber">
                {t('checkAll')}
              </Txt>
            </Row>
          )}
        </>
      ) : (
        <Button size="lg" full icon="save" className="mt-4" disabled={!date} loading={book.isPending} onPress={doBook}>
          {t('bookFu')}
        </Button>
      )}
      <FuSignDialog open={signOpen} onClose={() => setSignOpen(false)} name={p.displayName} onConfirm={doBook} busy={book.isPending} />
    </Screen>
  );
}

function FieldWithTag({ icon, label, tag, children }: { icon: string; label: string; tag: React.ReactNode; children: React.ReactNode }) {
  return (
    <View className="mt-3.5">
      <Row className="mb-1.5 justify-between">
        <Row gap="gap-1.5">
          <Icon name={icon} size={15} color="muted" />
          <Txt w="b" size={13}>
            {label}
          </Txt>
        </Row>
        {tag}
      </Row>
      {children}
    </View>
  );
}

function FuSignDialog({ open, onClose, name, onConfirm, busy }: { open: boolean; onClose: () => void; name: string; onConfirm: () => void; busy: boolean }) {
  const t = useT(dm);
  const tc = useT(common);
  const { doctor } = useMe();
  const [method, setMethod] = useState<'pin' | 'bio'>('pin');
  const [pin, setPin] = useState('123456');
  const confirm = async () => {
    if (method === 'bio' && !(await authenticateBiometric(t('placeFinger')))) return;
    onConfirm();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('signConfirm')}
      icon="calendar-check"
      actions={
        <>
          <Button variant="o" className="flex-1" onPress={onClose}>
            {tc('back')}
          </Button>
          <Button variant="n" className="flex-1" icon="check" loading={busy} disabled={method === 'pin' && pin.length < 6} onPress={confirm}>
            {t('confirm')}
          </Button>
        </>
      }
    >
      <Card className="flex-row items-center gap-3 p-3">
        <Icon name="user-check" size={18} color="blue" />
        <View className="flex-1">
          <Txt w="b">{doctor?.name}</Txt>
          <Txt size={11} className="text-muted">
            {t('fuFor')} {name}
          </Txt>
        </View>
        <Badge tone="green" icon="shield-check">
          {t('verified')}
        </Badge>
      </Card>
      <Alert kind="info" icon="calendar-check" className="mt-3" text={t('fuSignNote')} />
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
          <Input className="mt-2" value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))} secureTextEntry keyboardType="number-pad" accessibilityLabel="PIN" />
        ) : (
          <View className="mt-3 items-center">
            <Avatar icon="fingerprint" size="xl" light />
            <Txt size={11} className="mt-1 text-muted">
              {t('placeFinger')}
            </Txt>
          </View>
        )}
      </Field>
    </Dialog>
  );
}
