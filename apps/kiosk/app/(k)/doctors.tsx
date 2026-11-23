import { Redirect } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useApiMutation, useDoctors, useLiveStatus, useQueue, useSettings, useSpecializations, type KioskScanResult } from '@dyh/api';
import { formatHoursRange, isTooEarlyToScan, nextQueueNumber, scanOpensAtLabel, type Doctor, type DoctorLiveStatus, type Priority } from '@dyh/core';
import { common, useLoc, useT } from '@dyh/i18n';
import { Alert, Avatar, Button, Card, Dialog, Empty, Icon, PriorityBadge, Rich, SearchBox, Txt, cx, matches } from '@dyh/ui-native';
import { KTitle, go, useToday } from '../../src/components/kit';
import { KPage } from '../../src/components/page';
import { km } from '../../src/msgs';
import { useKiosk } from '../../src/store';

/** Specialization grid, then today's doctors for that specialization. */
export default function Doctors() {
  const t = useT(km);
  const tc = useT(common);
  const loc = useLoc();
  const patient = useKiosk((s) => s.patient);
  const { hour, dayName, dateLabel } = useToday();
  const { data: specs } = useSpecializations();
  const { data: doctors } = useDoctors();
  const { data: live } = useLiveStatus();
  const { data: settings } = useSettings();
  const win = settings?.scanWindowMinutes ?? 60;
  const [spec, setSpec] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [join, setJoin] = useState<Doctor | null>(null);

  const liveOf = (id: string) => live?.find((l) => l.doctorId === id);
  const today = useMemo(() => (doctors ?? []).filter((d) => d.status === 'active' && liveOf(d.id)?.openToday), [doctors, live]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!patient) return <Redirect href="/home" />;
  const sp = specs?.find((s) => s.id === spec);

  const head = (
    <KTitle
      icon={sp?.icon ?? 'layout-grid'}
      title={sp ? loc(sp.name) : t('chooseSpec')}
      sub={t('docsToday', { d: `${dayName}, ${dateLabel}` })}
      right={
        <Card className="flex-row items-center gap-2 px-4 py-2.5">
          <Icon name="user" size={18} />
          <Txt w="b" size={15}>
            {patient.name}
          </Txt>
          <PriorityBadge p={patient.priority} />
        </Card>
      }
    />
  );

  if (!sp) {
    const rows = (specs ?? [])
      .map((s) => ({ s, ds: today.filter((d) => d.specializationId === s.id) }))
      .filter(({ s }) => matches([loc(s.name), s.name.tl, s.name.en, ...(doctors ?? []).filter((d) => d.specializationId === s.id).map((d) => d.name)], q))
      .sort((a, b) => Number(b.ds.length > 0) - Number(a.ds.length > 0));
    return (
      <KPage>
        {head}
        <SearchBox value={q} onChange={setQ} placeholder={t('searchSpec')} className="mt-5" />
        <View className="mt-4 flex-row flex-wrap gap-4">
          {rows.map(({ s, ds }) => (
            <Pressable
              key={s.id}
              disabled={!ds.length}
              onPress={() => setSpec(s.id)}
              className={cx('w-[23%] min-w-[200px] grow items-center rounded-[22px] border-2 bg-card px-4 py-5', ds.length ? 'border-line' : 'border-line opacity-50')}
            >
              <View className={cx('h-14 w-14 items-center justify-center rounded-2xl', ds.length ? 'bg-sky' : 'bg-soft')}>
                <Icon name={s.icon} size={28} color={ds.length ? 'blue' : 'muted'} />
              </View>
              <Txt w="b" size={16} className="mt-2.5 text-center">
                {loc(s.name)}
              </Txt>
              <Txt size={13} className={cx('mt-0.5', ds.length ? 'text-green' : 'text-muted')}>
                {ds.length ? t('nToday', { n: ds.length }) : t('noClinic')}
              </Txt>
            </Pressable>
          ))}
        </View>
        {!rows.length && <Empty icon="search-x" text={t('noClinic')} />}
      </KPage>
    );
  }

  const list = today.filter((d) => d.specializationId === sp.id);
  return (
    <KPage>
      {head}
      <View className="mt-4 flex-row">
        <Button variant="o" icon="chevron-left" onPress={() => setSpec(null)}>
          {t('allSpecs')}
        </Button>
      </View>
      <View className="mt-4 flex-row flex-wrap gap-4">
        {list.map((d) => {
          const l = liveOf(d.id);
          const full = !!l && l.servedToday + l.waiting + (l.nowServing ? 1 : 0) >= d.maxPatientsPerDay;
          const early = isTooEarlyToScan(d, hour, win) && !l?.nowServing;
          return (
            <Card key={d.id} className="w-[32%] min-w-[300px] p-5">
              <View className="flex-row items-center gap-3">
                <Avatar icon={sp.icon} />
                <View className="flex-1">
                  <Txt w="b" size={17}>
                    {d.name}
                  </Txt>
                  <Txt size={13} className="text-muted">
                    {loc(sp.name)}
                  </Txt>
                </View>
              </View>
              <View className="mt-3 flex-row gap-2">
                <LiveStat icon="megaphone" label={tc('nowServing')} value={l?.nowServing ?? '—'} />
                <LiveStat icon="users" label={tc('waiting')} value={String(l?.waiting ?? 0)} />
              </View>
              <View className="mt-3 flex-row items-center gap-1.5">
                <Icon name="door-open" size={14} color="muted" />
                <Txt size={13} className="text-muted">
                  {tc('room')} {d.room} ·
                </Txt>
                <Icon name="clock" size={14} color="muted" />
                <Txt size={13} className="text-muted">
                  {formatHoursRange(d.hours)}
                </Txt>
              </View>
              {full ? (
                <Button variant="o" size="lg" full icon="ban" className="mt-3" disabled>
                  {`${t('fullBtn')} (max ${d.maxPatientsPerDay})`}
                </Button>
              ) : early ? (
                <>
                  <Button variant="g" size="lg" full icon="qr-code" className="mt-3" onPress={() => setJoin(d)}>
                    {t('getWalkQr')}
                  </Button>
                  <Txt size={12} className="mt-1 text-center text-muted">
                    {t('numberFrom', { t: scanOpensAtLabel(d, win) })}
                  </Txt>
                </>
              ) : (
                <Button size="lg" full icon="list-plus" className="mt-3" onPress={() => setJoin(d)}>
                  {t('join')}
                </Button>
              )}
            </Card>
          );
        })}
      </View>
      <Alert kind="info" icon="info" className="mt-5" text={t('joinInfo', { n: win })} />
      {join && <JoinDialog d={join} live={liveOf(join.id)} early={isTooEarlyToScan(join, hour, win) && !liveOf(join.id)?.nowServing} opensAt={scanOpensAtLabel(join, win)} specIcon={sp.icon} specName={loc(sp.name)} patient={patient} onClose={() => setJoin(null)} />}
    </KPage>
  );
}

function LiveStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View className="flex-1 rounded-[14px] border border-line p-2.5">
      <View className="flex-row items-center gap-1">
        <Icon name={icon} size={12} color="muted" />
        <Txt w="s" size={11.5} className="text-muted" numberOfLines={1}>
          {label}
        </Txt>
      </View>
      <Txt w="x" size={20}>
        {value}
      </Txt>
    </View>
  );
}

function JoinDialog({
  d, live, early, opensAt, specIcon, specName, patient, onClose,
}: { d: Doctor; live?: DoctorLiveStatus; early: boolean; opensAt: string; specIcon: string; specName: string; patient: { id: string; name: string; priority: Priority | null }; onClose: () => void }) {
  const t = useT(km);
  const tc = useT(common);
  const { data: q } = useQueue(d.id);
  const joinQ = useApiMutation((a, v: { doctorId: string; patient: { id: string; name: string; priority: Priority | null } }) => a.kioskJoin(v.doctorId, v.patient));
  const waiting = q?.waiting.length ?? live?.waiting ?? 0;
  const go_ = async () => {
    const r: KioskScanResult = await joinQ.mutateAsync({ doctorId: d.id, patient });
    useKiosk.getState().set({ result: r });
    onClose();
    go('/slip');
  };
  const card = (
    <Card className="flex-row items-center gap-3 p-3.5">
      <Avatar icon={specIcon} />
      <View className="flex-1">
        <Txt w="b" size={17}>
          {d.name}
        </Txt>
        <Txt size={13} className="text-muted">
          {specName} · {tc('room')} {d.room}
        </Txt>
      </View>
    </Card>
  );
  return (
    <Dialog
      open
      onClose={onClose}
      title={early ? t('earlyTitle') : t('confirmJoin')}
      icon={early ? 'clock' : 'list-plus'}
      actions={
        <>
          <Button variant="o" className="flex-1" icon="x" onPress={onClose}>
            {tc('cancel')}
          </Button>
          <Button className="flex-1" icon={early ? 'qr-code' : 'check'} loading={joinQ.isPending} onPress={go_}>
            {early ? t('getQr') : tc('confirm')}
          </Button>
        </>
      }
    >
      {card}
      {early ? (
        <Alert kind="warn" icon="qr-code" className="mt-3" text={t('earlyBody', { t: opensAt })} />
      ) : (
        <>
          <View className="mt-3 flex-row gap-2">
            <View className="flex-1 rounded-2xl bg-soft p-3">
              <Txt size={12} className="text-muted">
                {t('yourPlace')}
              </Txt>
              <Txt w="x" size={24}>
                {t('placeN', { n: waiting + 1 })}
              </Txt>
              <Txt size={12} className="text-muted">
                {t('aheadN', { n: waiting })}
              </Txt>
            </View>
            <View className="flex-1 rounded-2xl bg-soft p-3">
              <Txt size={12} className="text-muted">
                {tc('nowServing')}
              </Txt>
              <Txt w="x" size={24}>
                {q?.serving?.number ?? live?.nowServing ?? '—'}
              </Txt>
              <Txt size={12} className="text-muted">
                {q ? t('yourNumber', { n: nextQueueNumber(d, q) }) : ''}
              </Txt>
            </View>
          </View>
          {patient.priority && <Rich size={13.5} className="mt-3 text-blue" text={t('prioLane')} />}
        </>
      )}
    </Dialog>
  );
}
