import { View } from 'react-native';
import { useSettings } from '@dyh/api';
import { common, useT } from '@dyh/i18n';
import { Avatar, Button, Card, DisplaySettings, Icon, ListRow, Row, SectionTitle, Toggle, Txt } from '@dyh/ui-native';
import { SecScreen, logout } from '../../src/components/shell';
import { useAssigned } from '../../src/lib';
import { sm } from '../../src/msgs';
import { useSession } from '../../src/store';

export default function Settings() {
  const t = useT(sm);
  const tc = useT(common);
  const { list, specName, specIcon } = useAssigned();
  const { data: settings } = useSettings();
  const s = useSession();
  return (
    <SecScreen title={tc('settings')} icon="settings">
      <Card className="flex-row items-center gap-3">
        <Avatar text="CR" size="lg" />
        <View className="flex-1">
          <Txt w="b" size={17}>
            Carla Ramos
          </Txt>
          <Txt size={12.5} className="text-muted">
            {t('secretary')}
          </Txt>
          <Row gap="gap-1">
            <Icon name="mail" size={12} color="muted" />
            <Txt size={12.5} className="text-muted">
              c.ramos@dyh.ph
            </Txt>
          </Row>
        </View>
      </Card>

      <SectionTitle icon="palette">{t('display')}</SectionTitle>
      <DisplaySettings />

      <SectionTitle icon="stethoscope">{t('assigned')}</SectionTitle>
      <Card className="px-4 py-1">
        {list.map((d, i) => (
          <ListRow key={d.id} last={i === list.length - 1}>
            <Avatar icon={specIcon(d)} size="sm" light />
            <View className="flex-1">
              <Txt w="b">{d.name}</Txt>
              <Txt size={12} className="text-muted" numberOfLines={1}>
                {specName(d)}
              </Txt>
            </View>
            <Icon name="lock" size={16} color="muted" />
          </ListRow>
        ))}
      </Card>
      <Row className="mt-2" gap="gap-1">
        <Icon name="info" size={12} color="muted" />
        <Txt size={11.5} className="flex-1 text-muted">
          {t('adminOnly')}
        </Txt>
      </Row>

      <SectionTitle icon="shield">{t('security')}</SectionTitle>
      <Card className="px-4 py-1">
        <ListRow icon="fingerprint">
          <Txt w="b" className="flex-1">
            {t('bioLogin')}
          </Txt>
          <Toggle label={t('bioLogin')} value={s.bioOn} onChange={(v) => s.set({ bioOn: v })} />
        </ListRow>
        <ListRow icon="timer" last>
          <View className="flex-1">
            <Txt w="b">{t('autoLogout')}</Txt>
            <Txt size={12.5} className="text-muted">
              {t('autoLogoutSub', { n: settings?.autoLogoutMinutes.secretary ?? 10 })}
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
        <ListRow icon="volume-2" last>
          <Txt w="b" className="flex-1">
            {t('nSound')}
          </Txt>
          <Toggle label={t('nSound')} value={s.notif.sound} onChange={(v) => s.set({ notif: { ...s.notif, sound: v } })} />
        </ListRow>
      </Card>

      <Button variant="r" full icon="log-out" className="mt-4" onPress={() => logout()}>
        {tc('logout')}
      </Button>
    </SecScreen>
  );
}
