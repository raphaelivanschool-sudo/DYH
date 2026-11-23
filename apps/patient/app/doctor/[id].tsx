import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useAvailability } from '@dyh/api';
import { parseISO, weekdayOf } from '@dyh/core';
import { common, useT } from '@dyh/i18n';
import { Avatar, Button, Card, Empty, Header, Icon, Loading, Row, Rows, Screen, SectionTitle, Stat, Txt } from '@dyh/ui-native';
import { NeedAccountDialog } from '../../src/components/auth';
import { TodayBadge, WeekStrip } from '../../src/components/doctor';
import { useCatalog, useClock, useDates, useTodayState } from '../../src/lib';
import { pm } from '../../src/msgs';
import { useSession, useUi } from '../../src/store';

export default function DoctorInfo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT(pm);
  const tc = useT(common);
  const cat = useCatalog();
  const dt = useDates();
  const { today } = useClock();
  const state = useTodayState();
  const signedIn = useSession((s) => !!s.token);
  const [need, setNeed] = useState<string | null>(null);
  const d = cat.doctor(id);
  const { data: avail } = useAvailability(d?.id ?? null);
  if (!cat.ready || !d) return <Loading />;
  const live = cat.live(d.id);
  const book = () => {
    if (!signedIn) return setNeed(d.id);
    useUi.getState().startBook({ step: 4, doctor: d.id, spec: d.specializationId });
    router.push('/book');
  };
  return (
    <Screen header={<Header title={t('doctorDetails')} icon="stethoscope" onBack={() => router.back()} />}>
      <Card className="items-center">
        <Avatar icon={cat.specIcon(d)} size="xl" />
        <Txt w="b" size={18} className="mt-3 text-center">
          {d.name}
        </Txt>
        <Txt className="text-muted">{cat.specName(d)}</Txt>
        <View className="mt-2">
          <TodayBadge d={d} />
        </View>
      </Card>
      <Card className="mt-3 py-1">
        <Rows rows={[['door-open', t('room'), d.room], ['building', t('floor'), String(d.floor)], ['calendar', t('clinicDays'), dt.days(d)], ['clock', t('clinicHours'), dt.hours(d)]]} />
      </Card>
      <SectionTitle icon="calendar-range">{t('weekly')}</SectionTitle>
      <WeekStrip d={d} short />
      <SectionTitle icon="calendar-check" right={<Txt size={12} className="text-muted">{t('next7')}</Txt>}>
        {t('availDates')}
      </SectionTitle>
      {!avail ? (
        <Loading className="py-4" />
      ) : avail.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {avail.map((a) => {
            const [, mo, day] = parseISO(a.date);
            return (
              <View key={a.date} className="min-w-[76px] items-center rounded-[14px] border border-line bg-card px-3 py-2.5">
                <Txt w="b" size={12.5} className="text-blue">
                  {a.date === today ? tc('today') : dt.day(weekdayOf(a.date))}
                </Txt>
                <Txt w="x" size={15}>
                  {dt.mon(mo)} {day}
                </Txt>
                <Txt size={11} className="text-muted">
                  {t('left', { n: a.left })}
                </Txt>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <Empty icon="calendar-off" text={t('noAvail')} />
      )}
      {state(d) === 'open' && live?.nowServing && (
        <Row className="mt-3">
          <Stat icon="megaphone" label={tc('nowServing')} value={live.nowServing} size={20} />
          <Stat icon="users" label={tc('waiting')} value={live.waiting} size={20} />
        </Row>
      )}
      <Button size="lg" full icon="calendar-plus" className="mt-4" disabled={!avail?.length} onPress={book}>
        {t('bookThis')}
      </Button>
      {!signedIn && (
        <Row gap="gap-1" className="mt-2 justify-center">
          <Icon name="log-in" size={13} color="muted" />
          <Txt size={11.5} className="text-muted">
            {t('needLoginNote')}
          </Txt>
        </Row>
      )}
      <NeedAccountDialog doctorId={need} onClose={() => setNeed(null)} />
    </Screen>
  );
}
