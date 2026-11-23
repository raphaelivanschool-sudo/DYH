import { router, usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useQueue } from '@dyh/api';
import { initials } from '@dyh/core';
import { common, useT } from '@dyh/i18n';
import { Alert, Avatar, Button, Card, Drawer, DrawerGroup, DrawerItem, Gradient, Header, Icon, IconButton, Mark, Row, ScanQrDialog, Segmented, Txt, VerifyDialog, usePrefs } from '@dyh/ui-native';
import { useDoctorId, useMe, usePatient } from '../lib';
import { dm } from '../msgs';
import { useSession, useUi } from '../store';

/** Ask for PIN / fingerprint, then open the patient's record. */
export const openRecord = (patientId: string) => useUi.getState().set({ verify: { kind: 'record', patientId } });

export const go = (path: string) => router.navigate(path as never);

/** Bell button with unread dot (top-right on most screens). */
export function Bell() {
  const t = useT(dm);
  return <IconButton icon="bell" dot label={t('notifs')} onPress={() => go('/notifications')} />;
}

/** App bar: menu opens the drawer; `back` shows a back button instead. */
export function DocHeader({ title, icon, right, back }: { title: string; icon?: string; right?: ReactNode; back?: string }) {
  return (
    <Header
      title={title}
      icon={icon}
      right={right === undefined ? <Bell /> : right}
      onMenu={back ? undefined : () => useUi.getState().set({ drawer: true })}
      onBack={back ? () => router.navigate(back as never) : undefined}
    />
  );
}

type Item = [path: string, icon: string, label: string, badge?: number];

export function DoctorDrawer() {
  const t = useT(dm);
  const tc = useT(common);
  const open = useUi((s) => s.drawer);
  const path = usePathname();
  const id = useDoctorId();
  const { doctor, spec } = useMe();
  const { data: q } = useQueue(id);
  const { lang, setLang } = usePrefs((p) => p);
  const close = () => useUi.getState().set({ drawer: false });
  const cur = ['/consult', '/followup'].includes(path) ? '/record' : path;
  const nav = (p: string) => {
    close();
    if (p !== path) go(p);
  };
  const groups: [string, Item[]][] = [
    [t('grpMain'), [['/home', 'house', tc('home')], ['/queue', 'list-ordered', t('liveQueue'), q?.waiting.length], ['/record', 'folder-heart', t('record')]]],
    [t('grpManage'), [['/schedule', 'calendar-cog', t('schedule')], ['/reports', 'chart-column', t('reports')]]],
    [t('grpAccount'), [['/notifications', 'bell', t('notifs'), 3], ['/settings', 'settings', tc('settings')]]],
  ];
  return (
    <Drawer
      open={open}
      onClose={close}
      top={
        <Gradient className="px-[18px] pb-[18px] pt-[54px]">
          <Mark color="#ffffff" height={26} />
          <Row className="mt-4" gap="gap-3">
            <Avatar text={initials(doctor?.name.replace('Dr. ', '') ?? 'MS')} size="lg" color="rgba(255,255,255,0.18)" />
            <View className="flex-1">
              <Txt w="b" size={16} className="text-white">
                {doctor?.name}
              </Txt>
              <Row gap="gap-1">
                <Icon name="stethoscope" size={13} color="#ffffffcc" />
                <Txt size={12} className="flex-1 text-white" style={{ opacity: 0.8 }} numberOfLines={1}>
                  {spec} · {tc('room')} {doctor?.room}
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
      {groups.map(([g, items]) => (
        <View key={g}>
          <DrawerGroup label={g} />
          {items.map(([p, i, l, b]) => (
            <DrawerItem key={p} icon={i} label={l} on={cur === p} badge={b} onPress={() => nav(p)} />
          ))}
        </View>
      ))}
    </Drawer>
  );
}

export function logout(before?: () => void) {
  before?.();
  useSession.getState().signOut();
  useUi.getState().set({ recordOpen: false, reportsOpen: false, patientId: null });
  router.replace('/login');
}

/** Global identity check + QR scan dialogs (opened from any screen). */
export function SecurityHost() {
  const t = useT(dm);
  const verify = useUi((s) => s.verify);
  const scan = useUi((s) => s.scan);
  const p = usePatient(verify?.kind === 'record' ? verify.patientId : null);
  const close = () => useUi.getState().set({ verify: null });
  const ok = () => {
    if (!verify) return;
    if (verify.kind === 'record') {
      useUi.getState().set({ verify: null, patientId: verify.patientId, recordOpen: true });
      go('/record');
    } else useUi.getState().set({ verify: null, reportsOpen: true });
  };
  return (
    <>
      <VerifyDialog open={!!verify} onClose={close} onOk={ok}>
        {verify?.kind === 'record' && p ? (
          <Card className="flex-row items-center gap-3 p-3">
            <Avatar text={initials(p.displayName)} size="sm" light />
            <View className="flex-1">
              <Txt w="b">{p.displayName}</Txt>
              <Txt size={12} className="text-muted">
                {p.id}
              </Txt>
            </View>
            <Icon name="lock" size={16} color="muted" />
          </Card>
        ) : (
          <Alert kind="info" icon="chart-column" text={t('reportsProtected')} />
        )}
      </VerifyDialog>
      <ScanQrDialog
        open={scan}
        onClose={() => useUi.getState().set({ scan: false })}
        onScan={() => {
          useUi.getState().set({ scan: false, patientId: 'DYH-2024-000233', recordOpen: true });
          go('/record');
        }}
      />
    </>
  );
}

