import { View } from 'react-native';
import { useSettings } from '@dyh/api';
import { initials } from '@dyh/core';
import { common, useT } from '@dyh/i18n';
import { Avatar, Button, Card, DisplaySettings, Icon, ListRow, Row, Screen, SectionTitle, Toggle, Txt, toast } from '@dyh/ui-native';
import { DocHeader, logout } from '../../src/components/shell';
import { useMe } from '../../src/lib';
import { dm } from '../../src/msgs';
import { useSession } from '../../src/store';

export default function Settings() {
  const t = useT(dm);
  const tc = useT(common);
  const { doctor, spec } = useMe();
  const { data: settings } = useSettings();
  const s = useSession();
  return (
    <Screen header={<DocHeader title={tc('settings')} icon="settings" right={null} />}>
      <Card className="flex-row items-center gap-3">
        <Avatar text={initials(doctor?.name.replace('Dr. ', '') ?? '')} size="lg" />
        <View className="flex-1">
          <Txt w="b" size={17}>
            {doctor?.name}
          </Txt>
          <Txt size={12.5} className="text-muted">
            {spec}
          </Txt>
          <Row gap="gap-1">
            <Icon name="mail" size={12} color="muted" />
            <Txt size={12.5} className="text-muted">
              {doctor?.email}
            </Txt>
          </Row>
        </View>
      </Card>

      <SectionTitle icon="palette">{t('display')}</SectionTitle>
      <DisplaySettings />

      <SectionTitle icon="shield">{t('security')}</SectionTitle>
      <Card className="px-4 py-1">
        <ListRow icon="fingerprint">
          <Txt w="b" className="flex-1">
            {t('bioLogin')}
          </Txt>
          <Toggle label={t('bioLogin')} value={s.bioOn} onChange={(v) => s.set({ bioOn: v })} />
        </ListRow>
        <ListRow icon="key-round" onPress={() => toast.info(t('pinSoon'))}>
          <Txt w="b" className="flex-1">
            {t('changePin')}
          </Txt>
          <Icon name="chevron-right" size={18} color="muted" />
        </ListRow>
        <ListRow icon="timer" last>
          <View className="flex-1">
            <Txt w="b">{t('autoLogout')}</Txt>
            <Txt size={12.5} className="text-muted">
              {t('autoLogoutSub', { n: settings?.autoLogoutMinutes.doctor ?? 10 })}
            </Txt>
          </View>
          <Icon name="lock" size={16} color="muted" />
        </ListRow>
      </Card>

      <SectionTitle icon="bell">{t('notifs')}</SectionTitle>
      <Card className="px-4 py-1">
        <ListRow icon="user-plus">
          <Txt w="b" className="flex-1">
            {t('nNewPt')}
          </Txt>
          <Toggle label={t('nNewPt')} value={s.notif.queue} onChange={(v) => s.set({ notif: { ...s.notif, queue: v } })} />
        </ListRow>
        <ListRow icon="file-clock" last>
          <Txt w="b" className="flex-1">
            {t('nDrafts')}
          </Txt>
          <Toggle label={t('nDrafts')} value={s.notif.drafts} onChange={(v) => s.set({ notif: { ...s.notif, drafts: v } })} />
        </ListRow>
      </Card>

      <Button variant="r" full icon="log-out" className="mt-4" onPress={() => logout()}>
        {tc('logout')}
      </Button>
    </Screen>
  );
}
