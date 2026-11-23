import { router, usePathname } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueue, useSchedule, useTodayVitals } from '@dyh/api';
import { common, useT } from '@dyh/i18n';
import { Avatar, Badge, Button, Drawer, DrawerGroup, DrawerItem, Gradient, Header, Icon, Mark, Row, SearchBox, Segmented, SheetBody, ThemeScope, Txt, cx, matches, usePrefs } from '@dyh/ui-native';
import { useAssigned, useCurrent, useDoctorId } from '../lib';
import { sm } from '../msgs';
import { useSession, useUi } from '../store';

export const go = (path: string) => router.navigate(path as never);

/** Navy header with menu, bell and the selected-doctor switcher ("docsel"). */
export function SecHeader() {
  const t = useT(sm);
  const tc = useT(common);
  const { doctor, spec, icon } = useCurrent();
  return (
    <View className="bg-navy px-4 pb-3.5 pt-1">
      <Row className="justify-between">
        <Row gap="gap-2.5">
          <Pressable accessibilityRole="button" accessibilityLabel={tc('menu')} onPress={() => useUi.getState().set({ drawer: true })} className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
            <Icon name="menu" size={20} color="#ffffff" />
          </Pressable>
          <Mark height={22} color="#ffffff" />
          <Txt w="b" size={12} className="text-white" style={{ letterSpacing: 1 }}>
            SECRETARY
          </Txt>
        </Row>
        <Row gap="gap-2">
          <Pressable accessibilityRole="button" accessibilityLabel={t('notifs')} onPress={() => go('/notifications')} className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
            <Icon name="bell" size={19} color="#ffffff" />
            <View className="absolute right-2 top-2 h-2 w-2 rounded-full" style={{ backgroundColor: '#ff6b78' }} />
          </Pressable>
          <Avatar text="CR" size="sm" color="rgba(255,255,255,0.18)" />
        </Row>
      </Row>
      <Pressable accessibilityRole="button" accessibilityLabel={t('chooseDoctor')} onPress={() => useUi.getState().set({ doctorSheet: true })} className="mt-3 flex-row items-center gap-3 rounded-2xl px-3 py-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-white">
          <Icon name={icon} size={18} color="#17325f" />
        </View>
        <View className="flex-1">
          <Txt size={11} className="text-white" style={{ opacity: 0.75 }}>
            {t('selDoctor')}
          </Txt>
          <Txt w="b" className="text-white">
            {doctor?.name}
          </Txt>
          <Txt size={11} className="text-white" style={{ opacity: 0.8 }} numberOfLines={1}>
            {spec} · {tc('room')} {doctor?.room}
          </Txt>
        </View>
        <Icon name="chevrons-up-down" size={18} color="#ffffff" />
      </Pressable>
    </View>
  );
}

/** Secretary screen: navy header + optional page title row + scroll body. */
export function SecScreen({ children, title, icon, right, footer }: { children: ReactNode; title?: string; icon?: string; right?: ReactNode; footer?: ReactNode }) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-navy">
      <View className="flex-1 bg-scr">
        <ScrollView stickyHeaderIndices={[0]} contentContainerClassName="pb-14" keyboardShouldPersistTaps="handled">
          <SecHeader />
          {title ? <Header title={title} icon={icon} right={right} className="pt-3" /> : <View className="h-3.5" />}
          <View className="px-[18px]">{children}</View>
        </ScrollView>
        {footer}
      </View>
    </SafeAreaView>
  );
}

export function DoctorSheet() {
  const t = useT(sm);
  const tc = useT(common);
  const open = useUi((s) => s.doctorSheet);
  const cur = useDoctorId();
  const { list, specName, specIcon } = useAssigned();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const close = () => useUi.getState().set({ doctorSheet: false });
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
      <ThemeScope>
        <Pressable className="flex-1 bg-black/40" onPress={close} />
        <SheetBody title={t('chooseDoctor')} icon="stethoscope" onClose={close} bottomInset={insets.bottom}>
          <Txt size={12.5} className="text-muted">
            {t('assignedOnly')}
          </Txt>
          <SearchBox value={q} onChange={setQ} placeholder={t('searchDoctor')} className="mt-3" />
          <View className="mt-3 gap-2">
            {list
              .filter((d) => matches([d.name, specName(d), d.room], q))
              .map((d) => (
                <DoctorRow
                  key={d.id}
                  id={d.id}
                  name={d.name}
                  sub={`${specName(d)} · ${tc('room')} ${d.room}`}
                  icon={specIcon(d)}
                  on={cur === d.id}
                  onPress={() => {
                    useSession.getState().set({ doctorId: d.id });
                    close();
                  }}
                />
              ))}
          </View>
        </SheetBody>
      </ThemeScope>
    </Modal>
  );
}

function DoctorRow({ id, name, sub, icon, on, onPress }: { id: string; name: string; sub: string; icon: string; on: boolean; onPress: () => void }) {
  const tc = useT(common);
  const { data: q } = useQueue(id);
  return (
    <Pressable onPress={onPress} className={cx('flex-row items-center gap-3 rounded-2xl border-[1.5px] p-3', on ? 'border-blue-2 bg-sky-2' : 'border-line bg-card')}>
      <Avatar icon={icon} light />
      <View className="flex-1">
        <Txt w="b">{name}</Txt>
        <Txt size={12} className="text-muted" numberOfLines={1}>
          {sub}
        </Txt>
      </View>
      <View className="items-center">
        <Txt w="x" size={16}>
          {q?.waiting.length ?? '–'}
        </Txt>
        <Txt size={10.5} className="text-muted">
          {tc('waiting')}
        </Txt>
      </View>
    </Pressable>
  );
}

type Item = [path: string, icon: string, label: string, badge?: number];

export function SecretaryDrawer() {
  const t = useT(sm);
  const tc = useT(common);
  const open = useUi((s) => s.drawer);
  const path = usePathname();
  const cur = useDoctorId();
  const { list, specName, specIcon } = useAssigned();
  const { data: q } = useQueue(cur);
  const { data: vit } = useTodayVitals();
  const { data: sched } = useSchedule('d1');
  const { lang, setLang } = usePrefs((p) => p);
  const close = () => useUi.getState().set({ drawer: false });
  const nav = (p: string) => {
    close();
    if (p !== path) go(p);
  };
  const noVit = q ? [q.serving, ...q.waiting].filter((p) => p && !vit?.[p.number]).length : 0;
  const pend = cur === 'd1' ? (sched?.blocked.filter((b) => b.status === 'pending').length ?? 0) : 0;
  const groups: [string, Item[]][] = [
    [t('grpMain'), [['/home', 'house', tc('home')], ['/notifications', 'bell', t('notifs'), 4]]],
    [t('grpQueue'), [['/queue', 'list-ordered', t('queueMgmt'), q?.waiting.length], ['/vitals', 'heart-pulse', t('vitals'), noVit || undefined]]],
    [t('grpConsult'), [['/draft', 'file-pen', t('draft')], ['/sms', 'megaphone', t('sms'), pend || undefined]]],
    [t('grpAccount'), [['/settings', 'settings', tc('settings')]]],
  ];
  return (
    <Drawer
      open={open}
      onClose={close}
      top={
        <Gradient className="px-[18px] pb-[18px] pt-[54px]">
          <Mark color="#ffffff" height={26} />
          <Row className="mt-4" gap="gap-3">
            <Avatar text="CR" size="lg" color="rgba(255,255,255,0.18)" />
            <View className="flex-1">
              <Txt w="b" size={16} className="text-white">
                Carla Ramos
              </Txt>
              <Row gap="gap-1">
                <Icon name="clipboard-list" size={13} color="#ffffffcc" />
                <Txt size={12} className="text-white" style={{ opacity: 0.8 }}>
                  {t('secN', { n: list.length })}
                </Txt>
              </Row>
            </View>
          </Row>
        </Gradient>
      }
      footer={
        <>
          <Segmented size="sm" value={lang} onChange={setLang} options={[{ value: 'tl', label: 'Tagalog' }, { value: 'en', label: 'English' }]} />
          <Button variant="r" full icon="log-out" className="mt-2.5" onPress={() => logout(close)}>
            {tc('logout')}
          </Button>
        </>
      }
    >
      <DrawerGroup label={t('assigned')} />
      {list.map((d) => (
        <Pressable
          key={d.id}
          onPress={() => {
            useSession.getState().set({ doctorId: d.id });
            close();
          }}
          className={cx('mx-2 flex-row items-center gap-3 rounded-xl px-3 py-2.5', cur === d.id && 'bg-sky')}
        >
          <Icon name={specIcon(d)} size={18} color={cur === d.id ? 'blue' : 'muted'} />
          <View className="flex-1">
            <Txt w="b" size={13.5} className={cur === d.id ? 'text-blue' : 'text-ink'}>
              {d.name}
            </Txt>
            <Txt size={11} className="text-muted" numberOfLines={1}>
              {specName(d).split(' (')[0]}
            </Txt>
          </View>
          <QueueCount id={d.id} />
        </Pressable>
      ))}
      {groups.map(([g, items]) => (
        <View key={g}>
          <DrawerGroup label={g} />
          {items.map(([p, i, l, b]) => (
            <DrawerItem key={p} icon={i} label={l} on={path === p} badge={b} onPress={() => nav(p)} />
          ))}
        </View>
      ))}
    </Drawer>
  );
}

function QueueCount({ id }: { id: string }) {
  const { data: q } = useQueue(id);
  return <Badge tone="blue">{q?.waiting.length ?? 0}</Badge>;
}

export function logout(before?: () => void) {
  before?.();
  useSession.getState().signOut();
  router.replace('/login');
}

