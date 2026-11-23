import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { qk, useApiMutation, useApiQuery } from '@dyh/api';
import { RELATION_LABEL, type Booking, type RelationKey } from '@dyh/core';
import { common, defineMessages, useLoc, useT } from '@dyh/i18n';
import { Alert, Avatar, Button, Card, DateField, Empty, Field, Icon, Input, Loading, Placeholder, PriorityBadge, Row, Screen, SearchBox, Sheet, Txt, matches, toast } from '@dyh/ui-native';
import { BookingQrDialog } from '../../src/components/booking';
import { BloodPicker, NameFields, RelationPicker, SexField, type NameValue } from '../../src/components/profile-form';
import { AppHeader } from '../../src/components/shell';
import { useCatalog, useClock, useDates } from '../../src/lib';
import { pm } from '../../src/msgs';
import { useUi } from '../../src/store';

const m = defineMessages('patient.family', {
  info: ['Bawat miyembro ay may **sariling ID, QR at rekord**. Hindi pinagsasama ang mga rekord. Ang Simula ay nagpapakita lamang ng iyong sariling impormasyon.', 'Each member has **their own ID, QR and record**. Records are never combined. Home shows only your own information.'],
  search: ['Hanapin ang miyembro...', 'Search member...'],
  add: ['Magdagdag ng Miyembro', 'Add Family Member'],
  linkSoon: ['**Pag-link sa dati nang rekord** — malapit na. Sa ngayon, para sa pagpapareserba lamang ang mga idinadagdag na miyembro.', '**Linking an existing record** — coming soon. For now, members are added for booking only.'],
  ownId: ['Bibigyan ng sariling ID, QR at rekord ang miyembro.', 'The member gets their own ID, QR and record.'],
  added: ['Naidagdag ang miyembro ng pamilya', 'Family member added'],
  addBtn: ['Idagdag', 'Add'],
});

const ageFrom = (iso: string, today: string) => {
  const [y, mo, d] = iso.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return Math.max(0, ty - y - (tm < mo || (tm === mo && td < d) ? 1 : 0));
};

function AddMember({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT(m);
  const p = useT(pm);
  const tc = useT(common);
  const { today } = useClock();
  const [rel, setRel] = useState<string>('child');
  const [name, setName] = useState<NameValue>({ last: 'Dela Cruz', first: '', middle: '', suffix: '' });
  const [bday, setBday] = useState('');
  const [sex, setSex] = useState<'M' | 'F'>('F');
  const [blood, setBlood] = useState('');
  const [allergy, setAllergy] = useState('');
  const add = useApiMutation((api, v: { displayName: string; relation: RelationKey; age: number }) => api.addFamilyMember({ ...v, priority: v.age >= 60 ? 'senior' : null }), [qk.family]);
  const ok = !!name.first && !!name.last && bday.length === 10;
  return (
    <Sheet open={open} onClose={onClose} title={t('add')} icon="user-plus">
      <Field label={p('rel')} icon="users" className="mt-0">
        <RelationPicker value={rel} onChange={setRel} />
      </Field>
      <NameFields value={name} onChange={setName} />
      <Field label={tc('birthday')} icon="cake">
        <DateField label={tc('birthday')} value={bday} onChange={setBday} />
      </Field>
      <SexField value={sex} onChange={setSex} />
      <BloodPicker value={blood} onChange={setBlood} />
      <Field label="Allergy" icon="triangle-alert" optional>
        <Input value={allergy} onChangeText={setAllergy} placeholder="e.g. Penicillin" />
      </Field>
      <View className="mt-3">
        <Placeholder icon="link" text={t('linkSoon')} />
      </View>
      <Txt size={12.5} className="mt-3 text-muted">
        {t('ownId')}
      </Txt>
      <Row className="mt-4">
        <Button variant="o" className="flex-1" onPress={onClose}>
          {tc('cancel')}
        </Button>
        <Button
          className="flex-1"
          icon="check"
          disabled={!ok}
          loading={add.isPending}
          onPress={async () => {
            await add.mutateAsync({ displayName: `${name.first} ${name.last}`.trim(), relation: rel as RelationKey, age: ageFrom(bday, today) });
            toast.success(t('added'));
            onClose();
          }}
        >
          {t('addBtn')}
        </Button>
      </Row>
    </Sheet>
  );
}

export default function Family() {
  const t = useT(m);
  const p = useT(pm);
  const tc = useT(common);
  const loc = useLoc();
  const cat = useCatalog();
  const dt = useDates();
  const { today } = useClock();
  const { data: family } = useApiQuery(qk.family, (a) => a.getFamily());
  const { data: bookings } = useApiQuery(qk.bookings, (a) => a.getMyBookings());
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [qr, setQr] = useState<Booking | null>(null);
  if (!family || !bookings) return <Loading />;
  const members = family.map((f, i) => ({ f, i })).filter(({ f }) => f.relation !== 'self' && matches([f.displayName, f.patientId], q));
  return (
    <Screen header={<AppHeader title={p('family')} icon="users" />}>
      <Alert text={t('info')} />
      <SearchBox className="mt-3" value={q} onChange={setQ} placeholder={t('search')} />
      <View className="mt-3 gap-2.5">
        {members.map(({ f, i }) => {
          const nx = bookings.filter((b) => b.patientId === f.patientId && b.date >= today && b.status !== 'cancelled').sort((a, b) => a.date.localeCompare(b.date))[0];
          return (
            <Card key={f.patientId}>
              <Row gap="gap-3" className="items-start">
                <Avatar text={f.displayName.split(' ').map((x) => x[0]).slice(0, 2).join('')} light />
                <View className="flex-1">
                  <Txt w="b">{f.displayName}</Txt>
                  <Txt size={12.5} className="text-muted">
                    {loc(RELATION_LABEL[f.relation])} · {f.age} {tc('years')}
                  </Txt>
                  <Row gap="gap-1" className="mt-1">
                    <Icon name="id-card" size={13} color="blue" />
                    <Txt w="b" size={11.5} className="text-blue">
                      {f.patientId}
                    </Txt>
                  </Row>
                </View>
                <PriorityBadge p={f.priority} />
              </Row>
              {nx && (
                <Pressable onPress={() => setQr(nx)} className="mt-3 flex-row items-center gap-2.5 rounded-xl border-[1.5px] border-line bg-sky-2 px-3 py-2">
                  <Icon name="calendar-clock" size={17} color="blue" />
                  <View className="flex-1">
                    <Txt w="b" size={13}>
                      {cat.doctor(nx.doctorId)?.name}
                    </Txt>
                    <Txt size={11.5} className="text-muted">
                      {dt.dayDate(nx.date)}
                    </Txt>
                  </View>
                  <Icon name="qr-code" size={17} color="blue" />
                </Pressable>
              )}
              <Row className="mt-3" gap="gap-1.5">
                <Button
                  variant="g"
                  stacked
                  className="flex-1"
                  icon="calendar-plus"
                  onPress={() => {
                    useUi.getState().startBook({ step: 2, who: f.patientId });
                    router.navigate('/book');
                  }}
                >
                  {p('book')}
                </Button>
                <Button
                  variant="o"
                  stacked
                  className="flex-1"
                  icon="calendar"
                  onPress={() => {
                    useUi.getState().set({ calWho: i });
                    router.navigate('/calendar');
                  }}
                >
                  {p('calendar')}
                </Button>
                <Button
                  variant="o"
                  stacked
                  className="flex-1"
                  icon="qr-code"
                  onPress={() => {
                    useUi.getState().set({ qrWho: i, qrUnlocked: false });
                    router.navigate('/qr');
                  }}
                >
                  QR
                </Button>
              </Row>
            </Card>
          );
        })}
        {!members.length && <Empty text={tc('noResults')} />}
      </View>
      <Button variant="o" size="lg" full icon="user-plus" className="mt-4" onPress={() => setAdding(true)}>
        {t('add')}
      </Button>
      <AddMember key={String(adding)} open={adding} onClose={() => setAdding(false)} />
      <BookingQrDialog booking={qr} onClose={() => setQr(null)} />
    </Screen>
  );
}
