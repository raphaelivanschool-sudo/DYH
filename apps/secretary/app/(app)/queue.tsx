import { useState } from 'react';
import { View } from 'react-native';
import { useApiMutation, useQueue, useTodayVitals } from '@dyh/api';
import { common, useLoc, useT } from '@dyh/i18n';
import { Alert, Avatar, Badge, Button, Card, Empty, Gradient, Icon, Loading, PriorityBadge, Row, SearchBox, SectionTitle, Txt, TypeBadge, VitalsGrid, cx, matches, toast } from '@dyh/ui-native';
import { SecScreen } from '../../src/components/shell';
import { PRow, openVitals } from '../../src/components/queue';
import { useDoctorId } from '../../src/lib';
import { sm } from '../../src/msgs';

export default function Queue() {
  const t = useT(sm);
  const tc = useT(common);
  const loc = useLoc();
  const id = useDoctorId();
  const { data: q } = useQueue(id);
  const { data: vit } = useTodayVitals();
  const [s, setS] = useState('');
  const act = useApiMutation((a, v: { action: 'start' | 'skip' | 'done' | 'callBack' | 'noShow'; index?: number }) => a.queueAction(id, v.action, v.index));
  if (!q) return <Loading />;
  const run = async (action: 'start' | 'skip' | 'done' | 'callBack' | 'noShow', msg: string, index?: number) => {
    await act.mutateAsync({ action, index });
    toast.success(msg);
  };
  const sv = q.serving;
  const hasV = (n: string) => !!vit?.[n];
  const waiting = q.waiting.filter((p) => matches([p.number, p.patientName, p.patientId], s));

  return (
    <SecScreen>
      <Row gap="gap-2">
        {(
          [
            ['users', tc('waiting'), q.waiting.length, 'text-ink'],
            ['skip-forward', t('skipped'), q.skipped.length, 'text-amber'],
            ['check-check', tc('done'), q.doneCount, 'text-green'],
          ] as const
        ).map(([i, l, v, cls]) => (
          <View key={l} className="flex-1 rounded-[14px] border border-line bg-card p-2.5">
            <Row gap="gap-1">
              <Icon name={i} size={12} color="muted" />
              <Txt w="s" size={11} className="flex-1 text-muted" numberOfLines={1}>
                {l}
              </Txt>
            </Row>
            <Txt w="x" size={20} className={cls}>
              {v}
            </Txt>
          </View>
        ))}
      </Row>

      <View className="mt-3 overflow-hidden rounded-[18px] border border-line bg-card">
        {sv ? (
          <>
            <Gradient colors={['#1f56b0', '#17325f']} className="p-4">
              <Row className="justify-between">
                <Row gap="gap-1">
                  <Icon name="megaphone" size={13} color="#ffffffd0" />
                  <Txt w="b" size={11.5} className="text-white" style={{ opacity: 0.85 }}>
                    {tc('nowServing').toUpperCase()}
                  </Txt>
                </Row>
                <Badge tone="purple" icon="stethoscope">
                  {t('inConsult')}
                </Badge>
              </Row>
              <Row className="mt-2" gap="gap-3">
                <Txt w="x" size={32} className="text-white">
                  {sv.number}
                </Txt>
                <View className="flex-1">
                  <Txt w="b" size={16} className="text-white">
                    {sv.patientName}
                  </Txt>
                  <Row className="mt-1" gap="gap-1">
                    <TypeBadge type={sv.type} />
                    <PriorityBadge p={sv.priority} />
                  </Row>
                </View>
              </Row>
              {vit?.[sv.number] && <VitalsGrid v={vit[sv.number]} compact dark />}
            </Gradient>
            <Row className="p-3" gap="gap-2">
              <Button stacked className="flex-1 bg-amber-bg" variant="o" icon="skip-forward" onPress={() => run('skip', t('tSkipped', { n: sv.number }))}>
                {t('skip')}
              </Button>
              <Button stacked className={cx('flex-1', hasV(sv.number) ? 'bg-green-bg' : 'bg-red-bg')} variant="o" icon="heart-pulse" onPress={() => openVitals(sv.number)}>
                {hasV(sv.number) ? t('vitalsDone') : t('noVitals')}
              </Button>
              <Button stacked className="flex-1" variant="ok" icon="check-check" onPress={() => run('done', t('tDone', { n: sv.number }))}>
                {t('doneNext')}
              </Button>
            </Row>
          </>
        ) : (
          <View className="items-center p-5">
            <Icon name="user-round-check" size={30} color="muted" />
            <Txt w="b" className="mt-2">
              {t('noInside')}
            </Txt>
            <Txt size={12.5} className="text-muted">
              {t('callFirst')}
            </Txt>
            <Button size="lg" full icon="megaphone" className="mt-3" disabled={!q.waiting.length} onPress={() => run('start', t('tCalled', { n: q.waiting[0]?.patientName ?? '' }))}>
              {t('startCall', { n: q.waiting[0]?.number ?? '' })}
            </Button>
          </View>
        )}
      </View>

      <SectionTitle
        icon="list-ordered"
        right={
          <Row gap="gap-1">
            <Icon name="tablet" size={12} color="muted" />
            <Txt size={11} className="text-muted">
              {t('viaKiosk')}
            </Txt>
          </Row>
        }
      >
        {t('upNext')}
      </SectionTitle>
      <SearchBox value={s} onChange={setS} placeholder={t('searchQ')} className="mb-2" />
      {q.waiting.length ? (
        waiting.map((p, i) => <PRow key={p.number} p={p} hasVitals={hasV(p.number)} right={i === 0 && !s ? <Badge tone="purple" icon="arrow-right">{t('next')}</Badge> : null} />)
      ) : (
        <Empty icon="users" text={t('noWaiting')} />
      )}

      {!!q.expected.length && (
        <>
          <SectionTitle icon="clock" right={<Badge>{q.expected.length}</Badge>}>
            {t('expectedTitle')}
          </SectionTitle>
          {q.expected.map((e) => (
            <Card key={e.bookingId} className="mb-2 flex-row items-center gap-3 border-dashed p-3">
              <Avatar icon="smartphone" size="sm" light />
              <View className="flex-1">
                <Txt w="b" size={13.5}>
                  {e.patientName}
                </Txt>
                <Txt size={11.5} className="text-muted">
                  {e.bookingId}
                  {e.chiefComplaint ? ` · ${loc(e.chiefComplaint)}` : ''}
                </Txt>
              </View>
              <PriorityBadge p={e.priority} />
            </Card>
          ))}
        </>
      )}

      <SectionTitle icon="skip-forward" right={<Badge tone="amber">{q.skipped.length}</Badge>}>
        {t('skippedList')}
      </SectionTitle>
      {q.skipped.length ? (
        q.skipped.map((p, i) => (
          <Card key={p.number} className="mb-2 border-amber p-3">
            <Row gap="gap-2.5">
              <View className="min-w-[62px] items-center rounded-xl bg-amber-bg px-2 py-2">
                <Txt w="x" size={13.5} className="text-amber">
                  {p.number}
                </Txt>
              </View>
              <View className="flex-1">
                <Txt w="b" numberOfLines={1}>
                  {p.patientName}
                </Txt>
                <Txt size={11} className="text-muted">
                  {t('skipped')} · {p.type === 'online' ? 'Online' : tc('walkin')}
                </Txt>
              </View>
            </Row>
            <Row className="mt-2.5" gap="gap-2">
              <View className="flex-1">
                <Button size="sm" full variant="g" icon="undo-2" onPress={() => run('callBack', t('tBack', { n: p.number }), i)}>
                  {t('callBack')}
                </Button>
              </View>
              <View className="flex-1">
                <Button size="sm" full variant="r" icon="user-x" onPress={() => run('noShow', t('tNoShow', { n: p.number }), i)}>
                  {t('noShow')}
                </Button>
              </View>
            </Row>
          </Card>
        ))
      ) : (
        <Empty icon="skip-forward" text={t('noSkipped')} />
      )}
      <Alert kind="info" icon="refresh-cw" className="mt-3" text={t('synced')} />
    </SecScreen>
  );
}
