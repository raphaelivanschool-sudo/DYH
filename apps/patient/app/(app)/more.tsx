import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { qk, useApiMutation, useApiQuery, useSettings } from '@dyh/api';
import { ME, canRate, maskMobile } from '@dyh/core';
import { common, defineMessages, useT } from '@dyh/i18n';
import {
  Alert, Avatar, Badge, Button, Card, Dialog, Field, Icon, IconButton, Input, ListRow, Loading, Row, Screen, SectionTitle, Segmented, Toggle, TypeBadge, Txt, cx, toast, usePrefs,
} from '@dyh/ui-native';
import { AppHeader } from '../../src/components/shell';
import { useCatalog, useDates } from '../../src/lib';
import { pm } from '../../src/msgs';
import { useSession, useUi } from '../../src/store';

const m = defineMessages('patient.more', {
  locked: ['Naka-lock', 'Locked'],
  mobileNote: ['Hindi mapapalitan sa app ang nakarehistrong mobile number. Pumunta sa front desk na may valid ID.', 'The registered mobile number cannot be changed in the app. Visit the front desk with a valid ID.'],
  rate: ['Markahan ang Konsulta', 'Rate a Consultation'],
  notYet: ['Hindi pa', 'Not yet'],
  posted: ['Naipadala', 'Posted'],
  rateBtn: ['Markahan', 'Rate'],
  rateNote: ['Mga doktor lamang na nakonsulta mo (online o walk-in) ang puwedeng markahan, at pagkatapos lamang ng konsulta.', 'Only doctors you consulted (online or walk-in) can be rated, and only after the consultation.'],
  shortcuts: ['Mga Shortcut', 'Shortcuts'],
  confirmDemo: ['Pagkumpirma (demo)', 'Confirmation (demo)'],
  noShowDemo: ['Patakaran sa hindi pagsipot (demo)', 'No-show policy (demo)'],
  bigText: ['Mas Malaking Text', 'Larger Text'],
  bigTextSub: ['Para mas madaling basahin', 'Easier to read'],
  appNotif: ['Mga Abiso ng App', 'App Notifications'],
  on: ['Naka-on', 'On'],
  off: ['Naka-off — walang matatanggap na abiso', 'Off — you will not receive alerts'],
  nQueue: ['Update sa pila', 'Queue updates'],
  nAppt: ['Paalala sa iskedyul', 'Appointment reminders'],
  nAnn: ['Mga anunsyo ng ospital', 'Hospital announcements'],
  changePin: ['Palitan ang PIN', 'Change PIN'],
  autoLock: ['Awtomatikong Pag-lock', 'Auto Lock'],
  autoLockSub: ['{{n}} minutong walang galaw (itinakda ng ospital)', '{{n}} minutes of inactivity (set by the hospital)'],
  how: ['Kumusta ang iyong konsulta?', 'How was your consultation?'],
  comment: ['Komento', 'Comment'],
  commentPh: ['Ibahagi ang iyong karanasan...', 'Share your experience...'],
  noEdit: ['**Hindi na mababago** kapag naipadala. Admin lamang ang makakakita; hindi ito ipinapakita sa profile ng doktor.', 'It **cannot be edited** once posted. Only the Admin can see it; it is not shown on the doctor’s profile.'],
  rated: ['Salamat! Naipadala ang iyong marka.', 'Thank you! Your rating was posted.'],
  s1: ['Hindi maganda', 'Poor'],
  s2: ['Kulang', 'Fair'],
  s3: ['Katamtaman', 'Good'],
  s4: ['Maganda', 'Very good'],
  s5: ['Napakaganda!', 'Excellent!'],
});

function Stars({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <Row gap="gap-px">
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name="star" size={size} color={i <= n ? '#f5a524' : 'line'} fill={i <= n ? '#f5a524' : 'transparent'} />
      ))}
    </Row>
  );
}

function RateDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useT(m);
  const p = useT(pm);
  const cat = useCatalog();
  const dt = useDates();
  const { data: cons } = useApiQuery(qk.consultations, (a) => a.getMyConsultations());
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const rate = useApiMutation((api, v: { id: string; stars: number; comment?: string }) => api.rateConsultation(v.id, v.stars, v.comment), [qk.consultations]);
  const c = cons?.find((x) => x.id === id);
  const d = cat.doctor(c?.doctorId);
  return (
    <Dialog
      open={!!id}
      onClose={onClose}
      title={t('rate')}
      icon="star"
      actions={
        <>
          <Button variant="o" className="flex-1" onPress={onClose}>
            {p('later')}
          </Button>
          <Button
            className="flex-1"
            icon="send"
            disabled={!stars}
            loading={rate.isPending}
            onPress={async () => {
              await rate.mutateAsync({ id: id!, stars, comment: comment || undefined });
              toast.success(t('rated'));
              onClose();
            }}
          >
            {p('send')}
          </Button>
        </>
      }
    >
      {c && d && (
        <>
          <Card className="flex-row items-center gap-3 p-3">
            <Avatar icon={cat.specIcon(d)} light />
            <View className="flex-1">
              <Txt w="b">{d.name}</Txt>
              <Txt size={12.5} className="text-muted">
                {cat.specName(d)} · {dt.short(c.date)}
              </Txt>
            </View>
            <TypeBadge type={c.type} />
          </Card>
          <View className="mt-4 items-center">
            <Txt w="b">{t('how')}</Txt>
            <Row className="mt-3" gap="gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} accessibilityLabel={`${n}`} onPress={() => setStars(n)} className="p-1">
                  <Icon name="star" size={34} color={n <= stars ? '#f5a524' : 'line'} fill={n <= stars ? '#f5a524' : 'transparent'} />
                </Pressable>
              ))}
            </Row>
            <Txt w="b" className="mt-2 min-h-[20px] text-amber">
              {stars ? t(`s${stars}` as 's1') : ''}
            </Txt>
          </View>
          <Field label={t('comment')} icon="message-square" optional>
            <Input multiline value={comment} onChangeText={setComment} placeholder={t('commentPh')} />
          </Field>
          <Alert kind="warn" icon="lock" className="mt-2" text={t('noEdit')} />
        </>
      )}
    </Dialog>
  );
}

export default function More() {
  const t = useT(m);
  const p = useT(pm);
  const tc = useT(common);
  const cat = useCatalog();
  const dt = useDates();
  const prefs = usePrefs((s) => s);
  const s = useSession();
  const noShow = useUi((x) => x.noShow);
  const { data: settings } = useSettings();
  const { data: cons } = useApiQuery(qk.consultations, (a) => a.getMyConsultations());
  const [rating, setRating] = useState<string | null>(null);
  if (!cons) return <Loading />;
  const sub = (icon: string, label: string, k: 'queue' | 'appt' | 'ann') => (
    <ListRow icon={icon}>
      <View className={cx('flex-1 flex-row items-center pl-7', !s.notif.on && 'opacity-40')}>
        <Txt className="flex-1">{label}</Txt>
        <Toggle label={label} disabled={!s.notif.on} value={s.notif.on && s.notif[k]} onChange={(v) => s.set({ notif: { ...s.notif, [k]: v } })} />
      </View>
    </ListRow>
  );
  return (
    <Screen header={<AppHeader title={p('profile')} icon="circle-user-round" />}>
      <Card className="flex-row items-center gap-3">
        <Avatar text="JD" size="lg" />
        <View className="flex-1">
          <Txt w="b" size={17}>
            {ME.displayName}
          </Txt>
          <Row gap="gap-1">
            <Icon name="id-card" size={13} color="muted" />
            <Txt size={12.5} className="text-muted">
              {ME.id}
            </Txt>
          </Row>
          <Row gap="gap-1" className="mt-0.5">
            <Icon name="smartphone" size={13} color="muted" />
            <Txt size={12.5} className="text-muted">
              {maskMobile(ME.mobile)}
            </Txt>
            <Badge icon="lock">{t('locked')}</Badge>
          </Row>
        </View>
        <IconButton size="sm" icon="pencil" label={tc('edit')} />
      </Card>
      <Row gap="gap-1" className="mt-2 items-start">
        <Icon name="info" size={13} color="muted" />
        <Txt size={11.5} className="flex-1 text-muted">
          {t('mobileNote')}
        </Txt>
      </Row>

      <SectionTitle icon="star">{t('rate')}</SectionTitle>
      <Card className="px-4 py-1">
        {cons.map((c, i) => {
          const d = cat.doctor(c.doctorId);
          return (
            <ListRow key={c.id} last={i === cons.length - 1}>
              <Avatar icon={cat.specIcon(d)} size="sm" light />
              <View className="flex-1">
                <Txt w="b" size={13}>
                  {d?.name}
                </Txt>
                <Row gap="gap-1">
                  <Txt size={11.5} className="text-muted">
                    {dt.short(c.date)} ·
                  </Txt>
                  <TypeBadge type={c.type} />
                </Row>
              </View>
              {c.status !== 'done' ? (
                <Badge icon="lock">{t('notYet')}</Badge>
              ) : c.rating ? (
                <View className="items-end gap-0.5">
                  <Stars n={c.rating} />
                  <Row gap="gap-0.5">
                    <Icon name="lock" size={11} color="muted" />
                    <Txt size={11} className="text-muted">
                      {t('posted')}
                    </Txt>
                  </Row>
                </View>
              ) : canRate(c.status, false) ? (
                <Button variant="g" size="sm" icon="star" onPress={() => setRating(c.id)}>
                  {t('rateBtn')}
                </Button>
              ) : null}
            </ListRow>
          );
        })}
      </Card>
      <Row gap="gap-1" className="mt-2 items-start">
        <Icon name="info" size={13} color="muted" />
        <Txt size={11.5} className="flex-1 text-muted">
          {t('rateNote')}
        </Txt>
      </Row>

      <SectionTitle icon="layout-grid">{t('shortcuts')}</SectionTitle>
      <Card className="px-4 py-1">
        {(
          [
            ['users', p('family'), '/family'],
            ['calendar', p('calendar'), '/calendar'],
            ['qr-code', p('myQr'), '/qr'],
            ['calendar-check', t('confirmDemo'), '/confirm'],
          ] as const
        ).map(([i, l, path], k) => (
          <ListRow key={path} icon={i} last={k === 3} onPress={() => router.navigate(path)}>
            <Txt w="b" className="flex-1">
              {l}
            </Txt>
            <Icon name="chevron-right" size={18} color="muted" />
          </ListRow>
        ))}
      </Card>

      <SectionTitle icon="settings">{tc('settings')}</SectionTitle>
      <Card className="px-4 py-1">
        <ListRow icon="languages">
          <View className="flex-1">
            <Txt w="b">{tc('language')}</Txt>
          </View>
          <Segmented size="sm" className="w-[170px]" value={prefs.lang} onChange={prefs.setLang} options={[{ value: 'tl', label: 'Tagalog' }, { value: 'en', label: 'English' }]} />
        </ListRow>
        <ListRow icon="moon">
          <Txt w="b" className="flex-1">
            {tc('darkMode')}
          </Txt>
          <Toggle label={tc('darkMode')} value={prefs.theme === 'dark'} onChange={(v) => prefs.setTheme(v ? 'dark' : 'light')} />
        </ListRow>
        <ListRow icon="a-large-small">
          <View className="flex-1">
            <Txt w="b">{t('bigText')}</Txt>
            <Txt size={12.5} className="text-muted">
              {t('bigTextSub')}
            </Txt>
          </View>
          <Toggle label={t('bigText')} value={prefs.bigText} onChange={prefs.setBigText} />
        </ListRow>
        <ListRow icon={s.notif.on ? 'bell-ring' : 'bell-off'}>
          <View className="flex-1">
            <Txt w="b">{t('appNotif')}</Txt>
            <Txt size={12.5} className="text-muted">
              {s.notif.on ? t('on') : t('off')}
            </Txt>
          </View>
          <Toggle label={t('appNotif')} value={s.notif.on} onChange={(v) => s.set({ notif: { ...s.notif, on: v } })} />
        </ListRow>
        {sub('list-ordered', t('nQueue'), 'queue')}
        {sub('calendar-clock', t('nAppt'), 'appt')}
        {sub('megaphone', t('nAnn'), 'ann')}
        <ListRow icon="fingerprint">
          <Txt w="b" className="flex-1">
            Fingerprint / Face ID
          </Txt>
          <Toggle label="Fingerprint" value={s.bioOn} onChange={(v) => s.set({ bioOn: v })} />
        </ListRow>
        <ListRow icon="key-round" onPress={() => toast.info(p('otpSent'))}>
          <Txt w="b" className="flex-1">
            {t('changePin')}
          </Txt>
          <Icon name="chevron-right" size={18} color="muted" />
        </ListRow>
        <ListRow icon="timer">
          <View className="flex-1">
            <Txt w="b">{t('autoLock')}</Txt>
            <Txt size={12.5} className="text-muted">
              {t('autoLockSub', { n: settings?.autoLogoutMinutes.patient ?? 5 })}
            </Txt>
          </View>
          <Icon name="lock" size={16} color="muted" />
        </ListRow>
        <ListRow icon="user-x">
          <Txt w="b" className="flex-1">
            {t('noShowDemo')}
          </Txt>
          <Toggle label={t('noShowDemo')} value={noShow} onChange={(v) => useUi.getState().set({ noShow: v })} />
        </ListRow>
        <ListRow icon="shield-check" last>
          <Txt w="b" className="flex-1">
            {tc('privacy')}
          </Txt>
          <Icon name="chevron-right" size={18} color="muted" />
        </ListRow>
      </Card>
      <Button
        variant="r"
        full
        icon="log-out"
        className="mt-4"
        onPress={() => {
          s.signOut();
          useUi.getState().set({ recordUnlocked: false, qrUnlocked: false });
          router.replace('/welcome');
        }}
      >
        {tc('logout')}
      </Button>
      <RateDialog key={rating ?? ''} id={rating} onClose={() => setRating(null)} />
    </Screen>
  );
}
