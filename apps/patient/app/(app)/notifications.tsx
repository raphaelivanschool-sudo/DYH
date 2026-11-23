import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useNotifications } from '@dyh/api';
import { TONES, Card, Empty, Icon, Loading, Row, Screen, SearchBox, Txt, useColors } from '@dyh/ui-native';
import { common, defineMessages, useLoc, useT } from '@dyh/i18n';
import { matches } from '@dyh/ui-native';
import { AppHeader } from '../../src/components/shell';
import { pm } from '../../src/msgs';

const m = defineMessages('patient.notif', {
  search: ['Hanapin ang abiso...', 'Search notifications...'],
});

/** Tapping a notification opens the related screen where there is one. */
const TARGET: Record<string, string> = { pn1: '/queue', pn2: '/confirm', pn3: '/more', pn4: '/calendar' };

export default function Notifications() {
  const t = useT(m);
  const p = useT(pm);
  const tc = useT(common);
  const loc = useLoc();
  const c = useColors();
  const { data } = useNotifications('patient');
  const [q, setQ] = useState('');
  if (!data) return <Loading />;
  const list = data.filter((n) => matches([loc(n.title), loc(n.body)], q));
  return (
    <Screen header={<AppHeader title={p('notifs')} icon="bell" />}>
      <SearchBox value={q} onChange={setQ} placeholder={t('search')} />
      <View className="mt-3 gap-2">
        {list.map((n) => {
          const [bg, fg] = TONES[n.tone];
          return (
            <Card key={n.id} onPress={TARGET[n.id] ? () => router.navigate(TARGET[n.id] as never) : undefined} className="flex-row items-start gap-3">
              <View className="rounded-xl p-[9px]" style={{ backgroundColor: c[bg] }}>
                <Icon name={n.icon} size={18} color={fg} />
              </View>
              <View className="flex-1">
                <Row className="justify-between" gap="gap-2">
                  <Txt w="b" className="flex-1">
                    {loc(n.title)}
                  </Txt>
                  <Txt size={11} className="text-muted">
                    {loc(n.when)}
                  </Txt>
                </Row>
                <Txt size={12.5} className="mt-1 text-muted">
                  {loc(n.body)}
                </Txt>
              </View>
              {n.unread && <View className="mt-1.5 h-2 w-2 rounded-full bg-red" />}
            </Card>
          );
        })}
        {!list.length && <Empty text={tc('noResults')} />}
      </View>
    </Screen>
  );
}
