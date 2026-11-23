import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import type { Doctor } from '@dyh/core';
import { common, useLoc, useT } from '@dyh/i18n';
import { Avatar, Badge, Card, Empty, Icon, Picker, Row, SearchBox, SectionTitle, Txt, cx, matches } from '@dyh/ui-native';
import { useCatalog, useClock, useDates, useSortedDoctors, useTodayState } from '../lib';
import { pm } from '../msgs';

export function TodayBadge({ d }: { d: Doctor }) {
  const t = useT(pm);
  const s = useTodayState()(d);
  if (s === 'no_clinic') return <Badge icon="calendar-off">{t('noClinicToday')}</Badge>;
  if (s === 'open') return <Badge tone="green" icon="door-open">{t('openToday')}</Badge>;
  return <Badge tone="amber" icon="door-closed">{t('doneToday')}</Badge>;
}

/** Doctor row used in lists ("docInner"). */
export function DoctorCard({ d, onPress, on }: { d: Doctor; onPress: () => void; on?: boolean }) {
  const t = useT(pm);
  const cat = useCatalog();
  const dt = useDates();
  return (
    <Card onPress={onPress} className={cx('flex-row items-center gap-3 border-[1.5px] p-3.5', on && 'border-blue-2')}>
      <Avatar icon={cat.specIcon(d)} light />
      <View className="flex-1">
        <Txt w="b">{d.name}</Txt>
        <Txt size={12.5} className="text-muted">
          {cat.specName(d)}
        </Txt>
        <Row gap="gap-1" className="mt-1 flex-wrap">
          <Icon name="door-open" size={13} color="muted" />
          <Txt size={11.5} className="text-muted">
            {t('room')} {d.room}
          </Txt>
          <Txt size={11.5} className="text-muted">
            ·
          </Txt>
          <Icon name="clock" size={13} color="muted" />
          <Txt size={11.5} className="text-muted">
            {dt.days(d)}
          </Txt>
        </Row>
        <View className="mt-1.5">
          <TodayBadge d={d} />
        </View>
      </View>
      <Icon name="chevron-right" size={18} color="muted" />
    </Card>
  );
}

/** Mon–Sun strip highlighting clinic days; today outlined. */
export function WeekStrip({ d, short }: { d: Doctor; short?: boolean }) {
  const dt = useDates();
  const { today } = useClock();
  const todayW = new Date(today).getDay();
  const start = d.hours.start;
  const label = short ? `${start > 12 ? start - 12 : start}${start >= 12 ? 'PM' : 'AM'}` : `${start > 12 ? start - 12 : start}:00`;
  return (
    <View className="flex-row gap-1">
      {[1, 2, 3, 4, 5, 6, 0].map((w) => {
        const on = d.clinicDays.includes(w);
        return (
          <View key={w} className={cx('flex-1 items-center gap-0.5 rounded-[10px] px-0.5 py-2', on ? 'bg-sky' : 'bg-soft', w === todayW && 'border-2 border-blue-2')}>
            <Txt w="b" size={12} className={on ? 'text-blue' : 'text-muted'}>
              {dt.day(w)}
            </Txt>
            <Txt size={10} className={on ? 'text-blue' : 'text-muted'}>
              {on ? label : '—'}
            </Txt>
          </View>
        );
      })}
    </View>
  );
}

/** Specialization filter + search + doctor list (Guest and Doctors screens). */
export function DoctorDirectory({ onOpen }: { onOpen: (id: string) => void }) {
  const t = useT(pm);
  const tc = useT(common);
  const cat = useCatalog();
  const loc = useLoc();
  const [spec, setSpec] = useState('all');
  const [q, setQ] = useState('');
  const list = useSortedDoctors(cat.doctors.filter((d) => d.status === 'active' && (spec === 'all' || d.specializationId === spec)));
  const shown = list.filter((d) => matches([d.name, cat.specName(d), d.room], q));
  return (
    <>
      <SectionTitle icon="stethoscope" right={<Badge>{list.length}</Badge>}>
        {tc('doctors')}
      </SectionTitle>
      <Picker
        title={t('specialization')}
        icon="funnel"
        value={spec}
        onChange={setSpec}
        options={[{ value: 'all', label: t('allSpecs'), icon: 'layers' }, ...cat.specs.map((s) => ({ value: s.id, label: loc(s.name), icon: s.icon }))]}
      />
      <SearchBox className="mt-2" value={q} onChange={setQ} placeholder={t('searchDoctorRoom')} />
      <View className="mt-3 gap-2.5">
        {shown.map((d) => (
          <DoctorCard key={d.id} d={d} onPress={() => onOpen(d.id)} />
        ))}
        {!shown.length && <Empty text={tc('noResults')} />}
      </View>
    </>
  );
}

export const openDoctor = (id: string) => router.push({ pathname: '/doctor/[id]', params: { id } });
