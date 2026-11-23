import { router, usePathname } from 'expo-router';
import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi, useNotifications } from '@dyh/api';
import { AI_GUIDE, ME, type AiGuideKey } from '@dyh/core';
import { common, useLoc, useT } from '@dyh/i18n';
import { Alert, Avatar, Button, Chip, Drawer, DrawerGroup, DrawerItem, Gradient, Header, Icon, Mark, Rich, Row, Segmented, ThemeScope, Txt, cx, useColors, usePrefs } from '@dyh/ui-native';
import { useSession, useUi } from '../store';
import { pm } from '../msgs';

/** Header for signed-in screens: menu button opens the drawer. */
export function AppHeader({ title, icon, right, back }: { title: string; icon?: string; right?: React.ReactNode; back?: boolean }) {
  return <Header title={title} icon={icon} right={right} onMenu={back ? undefined : () => useUi.getState().set({ drawer: true })} onBack={back ? () => (router.canGoBack() ? router.back() : router.replace('/home')) : undefined} />;
}

type Item = [path: string, icon: string, label: string, badge?: number];

export function PatientDrawer() {
  const t = useT(pm);
  const tc = useT(common);
  const open = useUi((s) => s.drawer);
  const path = usePathname();
  const { lang, setLang } = usePrefs((p) => p);
  const { data: notifs } = useNotifications('patient');
  const unread = notifs?.filter((n) => n.unread).length ?? 0;
  const close = () => useUi.getState().set({ drawer: false });
  const go = (p: string) => {
    close();
    if (p !== path) router.navigate(p as never);
  };
  const groups: [string, Item[]][] = [
    [t('grpMain'), [['/home', 'house', tc('home')], ['/book', 'calendar-plus', t('book')], ['/queue', 'list-ordered', t('liveQueue')], ['/qr', 'qr-code', t('myQr')]]],
    [t('grpHealth'), [['/record', 'file-text', t('records')], ['/calendar', 'calendar', t('calendar')], ['/family', 'users', t('family')], ['/doctors', 'stethoscope', tc('doctors')]]],
    [t('grpAccount'), [['/notifications', 'bell', t('notifs'), unread], ['/more', 'circle-user-round', t('profile')]]],
  ];
  return (
    <Drawer
      open={open}
      onClose={close}
      top={
        <Gradient className="px-[18px] pb-[18px] pt-[54px]">
          <Mark color="#ffffff" height={26} />
          <Row className="mt-4" gap="gap-3">
            <Avatar text="JD" size="lg" color="rgba(255,255,255,0.18)" />
            <View className="flex-1">
              <Txt w="b" size={16} className="text-white">
                {ME.displayName}
              </Txt>
              <Row gap="gap-1">
                <Icon name="id-card" size={13} color="#ffffffcc" />
                <Txt size={12} className="text-white" style={{ opacity: 0.8 }}>
                  {ME.id}
                </Txt>
              </Row>
            </View>
          </Row>
        </Gradient>
      }
      footer={
        <>
          <Segmented size="sm" value={lang} onChange={setLang} options={[{ value: 'tl', label: 'Tagalog' }, { value: 'en', label: 'English' }]} />
          <Button
            variant="r"
            full
            icon="log-out"
            className="mt-2.5"
            onPress={() => {
              close();
              useSession.getState().signOut();
              useUi.getState().set({ recordUnlocked: false, qrUnlocked: false });
              router.replace('/welcome');
            }}
          >
            {tc('logout')}
          </Button>
        </>
      }
    >
      {groups.map(([g, items]) => (
        <View key={g}>
          <DrawerGroup label={g} />
          {items.map(([p, i, l, b]) => (
            <DrawerItem key={p} icon={i} label={l} on={path === p} badge={b} onPress={() => go(p)} />
          ))}
        </View>
      ))}
    </Drawer>
  );
}

type Msg = { me: true; text: string } | { me?: false; key: AiGuideKey; text: string };

/** AI Guide chat: directions, clinics and schedules only. Emergencies route to the ER. */
export function AiGuide() {
  const t = useT(pm);
  const tc = useT(common);
  const loc = useLoc();
  const api = useApi();
  const c = useColors();
  const open = useUi((s) => s.chat);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const scroll = useRef<ScrollViewInstance>(null);
  const close = () => useUi.getState().set({ chat: false });
  const ask = async (text: string, key?: string) => {
    const v = text.trim();
    if (!v) return;
    setQ('');
    setMsgs((m) => [...m, { me: true, text: v }]);
    const r = await api.askGuide(v, key);
    setMsgs((m) => [...m, { key: r.key as AiGuideKey, text: loc(r.answer) }]);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  };
  const all: Msg[] = [{ key: 'hi', text: loc(AI_GUIDE.answers.hi) }, ...msgs];
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
      <ThemeScope>
      <Pressable className="flex-1 bg-black/40" onPress={close} />
      <View className="overflow-hidden rounded-t-[26px] bg-scr" style={{ height: height * 0.78 }}>
        <Gradient className="flex-row items-center gap-3 px-4 py-3.5">
          <Avatar icon="bot" size="sm" color="rgba(255,255,255,0.18)" />
          <View className="flex-1">
            <Txt w="b" className="text-white">
              DYH {t('aiGuide')}
            </Txt>
            <Txt size={11.5} className="text-white" style={{ opacity: 0.8 }}>
              {t('aiSub')}
            </Txt>
          </View>
          <Pressable accessibilityLabel={tc('close')} onPress={close} className="h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
            <Icon name="x" size={18} color="#ffffff" />
          </Pressable>
        </Gradient>
        <ScrollView ref={scroll} className="flex-1" contentContainerClassName="gap-2.5 p-4">
          <Alert kind="warn" icon="shield-alert" text={t('aiWarn')} />
          {all.map((m, i) =>
            m.me ? (
              <View key={i} className="max-w-[82%] self-end rounded-[18px] rounded-br-md bg-primary px-3.5 py-2.5">
                <Txt className="text-white">{m.text}</Txt>
              </View>
            ) : (
              <View key={i} className={cx('max-w-[82%] self-start rounded-[18px] rounded-bl-md px-3.5 py-2.5', m.key === 'em' ? 'bg-red' : 'border border-line bg-card')}>
                <Row gap="gap-1.5" className="items-start">
                  {m.key === 'em' && <Icon name="siren" size={17} color="#ffffff" />}
                  <Rich text={m.text} w={m.key === 'em' ? 'b' : 'm'} className={m.key === 'em' ? 'flex-1 text-white' : 'flex-1 text-ink'} />
                </Row>
              </View>
            ),
          )}
        </ScrollView>
        <View className="border-t border-line bg-card px-3.5 pt-2.5" style={{ paddingBottom: 12 + insets.bottom }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {AI_GUIDE.quick.map((x) => (
              <Chip key={x.key} icon={x.key === 'em' ? 'siren' : 'circle-help'} onPress={() => ask(loc(x.q), x.key)}>
                {loc(x.q)}
              </Chip>
            ))}
          </ScrollView>
          <Row className="mt-2">
            <TextInput
              value={q}
              onChangeText={setQ}
              onSubmitEditing={() => ask(q)}
              placeholder={t('ask')}
              placeholderTextColor={c.muted}
              returnKeyType="send"
              className="flex-1 rounded-xl border-[1.5px] border-line bg-field px-3 py-2.5 text-ink"
              style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14 }}
            />
            <Button icon="send" accessibilityLabel={t('send')} onPress={() => ask(q)} />
          </Row>
        </View>
      </View>
      </ThemeScope>
    </Modal>
  );
}
