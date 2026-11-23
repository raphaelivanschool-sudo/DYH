import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { qk, useApiMutation, useApiQuery, useAvailability, useSettings } from '@dyh/api';
import { RELATION_LABEL, parseISO, scanOpensAtLabel, weekdayOf, type Booking } from '@dyh/core';
import { common, defineMessages, useLoc, useT } from '@dyh/i18n';
import {
  Alert, Avatar, Badge, Bar, Button, Card, Empty, Field, Icon, Input, LinkText, Loading, PriorityBadge, QR, ResultView, Row, Rows, Screen,
  SearchBox, SectionTitle, Stat, Stepper, Txt, cx, matches, toast,
} from '@dyh/ui-native';
import { BookingExplain } from '../../src/components/booking';
import { DoctorCard, TodayBadge, WeekStrip } from '../../src/components/doctor';
import { AppHeader } from '../../src/components/shell';
import { useCatalog, useClock, useDates, useSortedDoctors, useTodayState } from '../../src/lib';
import { pm } from '../../src/msgs';
import { EMPTY_BOOK, useUi, type BookDraft } from '../../src/store';

const m = defineMessages('patient.book', {
  forWho: ['Para kanino?', 'Who is it for?'],
  forWhoQ: ['Para kanino ang konsulta?', 'Who is the consultation for?'],
  whichSpec: ['Anong espesyalisasyon ang kailangan mo?', 'Which specialization do you need?'],
  specPh: ['hal. Puso, Pedia, Balat, Mata...', 'e.g. Cardio, Pedia, Skin, Eye...'],
  review: ['Suriin', 'Review'],
  change: ['Palitan', 'Change'],
  openTop: ['Nasa itaas ang may clinic ngayon', 'Doctors open today are on top'],
  searchDoc: ['Hanapin ang doktor...', 'Search doctor...'],
  backList: ['Bumalik sa listahan', 'Back to list'],
  choose: ['Piliin ang doktor na ito', 'Choose this doctor'],
  pickDate: ['Pumili ng Petsa', 'Choose a Date'],
  availOnly: ['mga bakanteng araw lamang', 'available days only'],
  spots: ['{{n}} bakante pa', '{{n}} spots left'],
  walkSame: ['Walk-in (parehong araw)', 'Walk-in (same day)'],
  onlineBk: ['Online na reserbasyon', 'Online booking'],
  noDays: ['Walang bakanteng araw sa susunod na 7 araw.', 'No available days in the next 7 days.'],
  hiddenNote: ['Hindi ipinapakita ang mga araw na walang clinic o puno na (max {{n}} pasyente bawat araw, itinakda ng doktor).', 'Days with no clinic or already full are hidden (max {{n}} patients per day, set by the doctor).'],
  noShowNote: ['Dahil sa hindi pagsipot, walk-in (parehong araw) lamang ang puwede.', 'Because of a no-show, only same-day walk-in is allowed.'],
  type: ['Uri', 'Type'],
  walkin: ['Personal (Walk-in)', 'Walk-in'],
  online: ['Online na Reserbasyon', 'Online Appointment'],
  cc: ['Pangunahing reklamo', 'Chief complaint'],
  ccPh: ['hal. Ubo at sipon ng 3 araw', 'e.g. Cough and colds for 3 days'],
  ccNote: ['Makikita ito ng sekretarya at doktor.', 'The secretary and doctor will see this.'],
  booked: ['Nakareserba na ang Petsa!', 'Date Booked!'],
  bookedSub: ['Ito ang iyong Booking QR. I-scan ito sa Kiosk pagdating para makuha ang numero sa pila.', 'This is your Booking QR. Scan it at the Kiosk on arrival to get your queue number.'],
});

export default function Book() {
  const t = useT(m);
  const p = useT(pm);
  const tc = useT(common);
  const loc = useLoc();
  const cat = useCatalog();
  const dt = useDates();
  const { today } = useClock();
  const st = useTodayState();
  const b = useUi((s) => s.book);
  const noShow = useUi((s) => s.noShow);
  const set = (patch: Partial<BookDraft>) => useUi.getState().set({ book: { ...useUi.getState().book, ...patch } });
  const { data: family } = useApiQuery(qk.family, (a) => a.getFamily());
  const { data: settings } = useSettings();
  const [qs, setQs] = useState('');
  const [qd, setQd] = useState('');
  const [done, setDone] = useState<Booking | null>(null);
  const d = cat.doctor(b.doctor);
  const { data: avail } = useAvailability(b.step === 4 ? b.doctor : null, noShow);
  const specDoctors = useSortedDoctors(useMemo(() => cat.doctors.filter((x) => x.specializationId === b.spec && x.status === 'active'), [cat.doctors, b.spec]));
  const create = useApiMutation((api, v: { patientId: string; doctorId: string; date: string; chiefComplaint?: string }) => api.createBooking(v), [qk.bookings]);
  const who = family?.find((f) => f.patientId === b.who) ?? family?.[0];
  if (!cat.ready || !family) return <Loading />;

  if (done) {
    const dd = cat.doctor(done.doctorId)!;
    return (
      <Screen header={<AppHeader title={p('book')} icon="calendar-plus" />}>
        <ResultView icon="calendar-check" title={t('booked')} message={t('bookedSub')}>
          <View className="mt-3">
            <QR value={`DYH-BK:${done.id}`} size={190} />
          </View>
          <Txt w="x" className="mt-2" style={{ letterSpacing: 1 }}>
            {done.id}
          </Txt>
          <Card className="mt-4 w-full py-1">
            <Rows
              rows={[
                ['user', tc('patient'), done.patientName],
                ['stethoscope', tc('doctor'), dd.name],
                ['door-open', p('room'), `${dd.room} · ${p('floor')} ${dd.floor}`],
                ['calendar', tc('date'), dt.dayDate(done.date)],
                ['scan-qr-code', p('scanOpens'), scanOpensAtLabel(dd, settings?.scanWindowMinutes ?? 60)],
                ['ticket', p('queueNumber'), p('noneYet')],
              ]}
            />
          </Card>
          <View className="mt-3 w-full">
            <BookingExplain />
          </View>
          <Row className="mt-4 w-full">
            <Button variant="g" className="flex-1" icon="download" onPress={() => toast.success(p('downloaded'))}>
              {p('download')}
            </Button>
            <Button variant="o" className="flex-1" icon="calendar" onPress={() => router.navigate('/calendar')}>
              {p('calendar')}
            </Button>
          </Row>
          <Button
            size="lg"
            full
            icon="house"
            className="mt-2"
            onPress={() => {
              setDone(null);
              useUi.getState().set({ book: EMPTY_BOOK });
              router.navigate('/home');
            }}
          >
            {p('backHome')}
          </Button>
        </ResultView>
      </Screen>
    );
  }

  const labels = [t('forWho'), p('specialization'), tc('doctor'), tc('date'), t('review')];
  const back = () => (b.step === 3 && b.viewDoctor ? set({ viewDoctor: null }) : set({ step: (b.step - 1) as BookDraft['step'] }));
  let body: React.ReactNode = null;
  let foot: React.ReactNode = null;

  if (b.step === 1) {
    body = (
      <>
        <SectionTitle icon="users">{t('forWhoQ')}</SectionTitle>
        <View className="gap-2.5">
          {family.map((f, i) => {
            const on = who?.patientId === f.patientId;
            return (
              <Card key={f.patientId} onPress={() => set({ who: f.patientId })} className={cx('flex-row items-center gap-3 border-[1.5px] p-3.5', on && 'border-blue-2')}>
                <Avatar text={f.displayName.split(' ').map((x) => x[0]).slice(0, 2).join('')} size="sm" light={i > 0} />
                <View className="flex-1">
                  <Txt w="b">{f.displayName}</Txt>
                  <Txt size={12.5} className="text-muted">
                    {f.relation === 'self' ? p('me') : loc(RELATION_LABEL[f.relation])} · {f.patientId}
                  </Txt>
                </View>
                <PriorityBadge p={f.priority} />
                {on && <Icon name="circle-check" size={20} color="blue" />}
              </Card>
            );
          })}
        </View>
      </>
    );
    foot = (
      <Button size="lg" full iconRight="chevron-right" onPress={() => set({ step: 2, who: who?.patientId ?? null })}>
        {tc('next')}
      </Button>
    );
  }

  if (b.step === 2) {
    const specs = cat.specs.filter((s) => cat.doctors.some((x) => x.specializationId === s.id));
    const shown = specs.filter((s) => matches([s.name.tl, s.name.en, ...cat.doctors.filter((x) => x.specializationId === s.id).map((x) => x.name)], qs));
    body = (
      <>
        <SectionTitle icon="search">{t('whichSpec')}</SectionTitle>
        <SearchBox value={qs} onChange={setQs} placeholder={t('specPh')} />
        <View className="mt-3 gap-2">
          {shown.map((s) => {
            const ds = cat.doctors.filter((x) => x.specializationId === s.id);
            const open = ds.filter((x) => st(x) === 'open').length;
            return (
              <Card key={s.id} onPress={() => set({ spec: s.id, viewDoctor: null, step: 3 })} className={cx('flex-row items-center gap-3 border-[1.5px] p-3.5', b.spec === s.id && 'border-blue-2')}>
                <Avatar icon={s.icon} light />
                <View className="flex-1">
                  <Txt w="b">{loc(s.name)}</Txt>
                  <Row gap="gap-1">
                    <Txt size={12.5} className="text-muted">
                      {p('doctorCount', { n: ds.length })}
                    </Txt>
                    {open > 0 && (
                      <Txt w="b" size={12.5} className="text-green">
                        · {p('openNowN', { n: open })}
                      </Txt>
                    )}
                  </Row>
                </View>
                <Icon name="chevron-right" size={18} color="muted" />
              </Card>
            );
          })}
          {!shown.length && <Empty text={tc('noResults')} />}
        </View>
      </>
    );
  }

  if (b.step === 3) {
    const spec = cat.specs.find((s) => s.id === b.spec);
    const vd = cat.doctor(b.viewDoctor);
    if (vd) {
      const live = cat.live(vd.id);
      body = (
        <>
          <View className="mt-3 self-start">
            <LinkText icon="chevron-left" onPress={() => set({ viewDoctor: null })}>
              {t('backList')}
            </LinkText>
          </View>
          <Card className="mt-3 items-center">
            <Avatar icon={cat.specIcon(vd)} size="xl" />
            <Txt w="b" size={18} className="mt-3">
              {vd.name}
            </Txt>
            <Txt className="text-muted">{cat.specName(vd)}</Txt>
            <View className="mt-2">
              <TodayBadge d={vd} />
            </View>
          </Card>
          <Card className="mt-3 py-1">
            <Rows rows={[['door-open', p('room'), vd.room], ['building', p('floor'), String(vd.floor)], ['clock', p('clinicHours'), dt.hours(vd)]]} />
          </Card>
          <SectionTitle icon="calendar-range">{p('weekly')}</SectionTitle>
          <WeekStrip d={vd} />
          {st(vd) === 'open' && live?.nowServing && (
            <Row className="mt-3">
              <Stat icon="megaphone" label={tc('nowServing')} value={live.nowServing} size={20} />
              <Stat icon="users" label={tc('waiting')} value={live.waiting} size={20} />
            </Row>
          )}
        </>
      );
      foot = (
        <Button size="lg" full icon="check" onPress={() => set({ doctor: vd.id, date: null, step: 4 })}>
          {t('choose')}
        </Button>
      );
    } else {
      const shown = specDoctors.filter((x) => matches([x.name, x.room], qd));
      body = (
        <>
          <Card className="mt-3 flex-row items-center gap-3 p-3">
            <Avatar icon={spec?.icon} size="sm" light />
            <Txt w="b" className="flex-1">
              {loc(spec?.name)}
            </Txt>
            <Button variant="o" size="sm" icon="repeat" onPress={() => set({ step: 2 })}>
              {t('change')}
            </Button>
          </Card>
          <SectionTitle icon="stethoscope" right={<Txt size={12} className="text-muted">{t('openTop')}</Txt>}>
            {tc('doctors')}
          </SectionTitle>
          <SearchBox value={qd} onChange={setQd} placeholder={t('searchDoc')} />
          <View className="mt-3 gap-2.5">
            {shown.map((x) => (
              <DoctorCard key={x.id} d={x} onPress={() => set({ viewDoctor: x.id })} />
            ))}
            {!shown.length && <Empty text={tc('noResults')} />}
          </View>
        </>
      );
    }
  }

  if (b.step === 4 && d) {
    const cap = avail?.[0]?.capacity ?? d.maxPatientsPerDay;
    body = (
      <>
        <Card className="mt-3 flex-row items-center gap-3 p-3">
          <Avatar icon={cat.specIcon(d)} size="sm" light />
          <View className="flex-1">
            <Txt w="b">{d.name}</Txt>
            <Txt size={11.5} className="text-muted">
              {cat.specName(d)} · {dt.hours(d)}
            </Txt>
          </View>
        </Card>
        <SectionTitle icon="calendar" right={<Txt size={12} className="text-muted">{t('availOnly')}</Txt>}>
          {t('pickDate')}
        </SectionTitle>
        {!avail ? (
          <Loading className="py-6" />
        ) : avail.length ? (
          <View className="gap-2">
            {avail.map((a) => {
              const on = b.date === a.date;
              const [, mo, day] = parseISO(a.date);
              return (
                <Pressable key={a.date} onPress={() => set({ date: a.date })} className={cx('flex-row items-center gap-3 rounded-2xl border-[1.5px] bg-card p-3', on ? 'border-blue-2' : 'border-line')}>
                  <View className={cx('w-14 items-center rounded-xl py-1.5', on ? 'bg-primary' : 'bg-sky')}>
                    <Txt w="b" size={11} className={on ? 'text-white' : 'text-blue'}>
                      {a.date === today ? tc('today') : dt.day(weekdayOf(a.date))}
                    </Txt>
                    <Txt w="x" size={22} className={on ? 'text-white' : 'text-blue'} style={{ lineHeight: 26 }}>
                      {day}
                    </Txt>
                    <Txt w="b" size={11} className={on ? 'text-white' : 'text-blue'}>
                      {dt.mon(mo)}
                    </Txt>
                  </View>
                  <View className="flex-1">
                    <Row gap="gap-1.5" className="flex-wrap">
                      <Badge tone="blue" icon="users">
                        {a.total}/{a.capacity}
                      </Badge>
                      <Txt size={11.5} className="text-muted">
                        {t('spots', { n: a.left })}
                      </Txt>
                    </Row>
                    <Bar value={(a.total / a.capacity) * 100} className="mt-2" />
                    <Txt size={11.5} className="mt-1 text-muted">
                      {a.date === today ? t('walkSame') : t('onlineBk')}
                    </Txt>
                  </View>
                  {on && <Icon name="circle-check" size={20} color="blue" />}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Empty icon="calendar-off" text={t('noDays')} />
        )}
        <Row gap="gap-1" className="mt-2 items-start">
          <Icon name="info" size={13} color="muted" />
          <Txt size={11.5} className="flex-1 text-muted">
            {t('hiddenNote', { n: cap })}
          </Txt>
        </Row>
        {noShow && <Alert kind="warn" icon="ban" className="mt-3" text={t('noShowNote')} />}
      </>
    );
    foot = (
      <Button size="lg" full disabled={!b.date} iconRight="chevron-right" onPress={() => set({ step: 5 })}>
        {tc('next')}
      </Button>
    );
  }

  if (b.step === 5 && d && b.date && who) {
    const walk = b.date === today;
    body = (
      <>
        <Card className="mt-3 py-1">
          <Rows
            rows={[
              ['user', tc('patient'), who.displayName],
              ['id-card', p('pid'), who.patientId],
              ['stethoscope', tc('doctor'), d.name],
              ['building-2', p('specialization'), cat.specName(d)],
              ['door-open', p('room'), `${d.room} · ${p('floor')} ${d.floor}`],
              ['calendar', tc('date'), dt.dayDate(b.date)],
              ['clock', p('clinicHours'), dt.hours(d)],
              ['tag', t('type'), walk ? t('walkin') : t('online')],
            ]}
          />
        </Card>
        <Field label={t('cc')} icon="message-square" optional hint={t('ccNote')}>
          <Input multiline value={b.complaint} onChangeText={(v) => set({ complaint: v })} placeholder={t('ccPh')} className="min-h-[64px]" />
        </Field>
        <View className="mt-3">
          <BookingExplain compact />
        </View>
      </>
    );
    foot = (
      <Button
        variant="ok"
        size="lg"
        full
        icon="check"
        loading={create.isPending}
        onPress={async () => {
          const r = await create.mutateAsync({ patientId: who.patientId, doctorId: d.id, date: b.date!, chiefComplaint: b.complaint || undefined });
          setDone(r);
        }}
      >
        {tc('confirm')}
      </Button>
    );
  }

  return (
    <Screen header={<AppHeader title={p('book')} icon="calendar-plus" />}>
      <Stepper total={5} current={b.step} label={labels[b.step - 1]} />
      {body}
      <Row className="mt-5">
        {b.step > 1 && <Button variant="o" icon="chevron-left" accessibilityLabel={tc('back')} onPress={back} />}
        <View className="flex-1">{foot}</View>
      </Row>
      <View className="h-12" />
    </Screen>
  );
}
