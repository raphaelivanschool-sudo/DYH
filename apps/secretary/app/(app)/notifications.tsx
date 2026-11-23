import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNotifications } from '@dyh/api';
import { type AppNotification } from '@dyh/core';
import { common, useLoc, useT } from '@dyh/i18n';
import { Button, Chip, Empty, Icon, Loading, Row, TONES, Txt, cx, toast, useColors } from '@dyh/ui-native';
import { SecScreen, go } from '../../src/components/shell';
import { sm } from '../../src/msgs';

type Tab = 'all' | 'queue' | 'record';

/** Tapping a notice opens the related screen (queue, drafts or SMS). */
export default function Notifications() {
  const t = useT(sm);
  const tc = useT(common);
  const loc = useLoc();
  const c = useColors();
  const { data } = useNotifications('secretary');
  const [tab, setTab] = useState<Tab>('all');
  const [read, setRead] = useState(false);
  if (!data) return <Loading />;
  const list = data.filter((n) => tab === 'all' || n.category === tab);
  const open = (n: AppNotification) => {
    if (n.icon === 'calendar-x') go('/sms');
    else if (n.category === 'record') go('/draft');
    else if (n.category === 'queue') go('/queue');
  };
  return (
    <SecScreen
      title={t('notifs')}
      icon="bell"
      right={
        <Button
          variant="link"
          size="sm"
          icon="check-check"
          onPress={() => {
            setRead(true);
            toast.success(t('marked'));
          }}
        >
          {t('markRead')}
        </Button>
      }
    >
      <Row gap="gap-2">
        {(
          [
            ['all', tc('all')],
            ['queue', tc('queue')],
            ['record', t('records')],
          ] as const
        ).map(([k, l]) => (
          <Chip key={k} on={tab === k} onPress={() => setTab(k)}>
            {l}
          </Chip>
        ))}
      </Row>
      <View className="mt-3">
        {list.length ? (
          list.map((n) => {
            const unread = n.unread && !read;
            const [bg, fg] = TONES[n.tone];
            return (
              <Pressable key={n.id} onPress={() => open(n)} className={cx('mb-2 flex-row items-start gap-3 rounded-2xl border p-3.5', unread ? 'border-blue-2 bg-sky-2' : 'border-line bg-card')}>
                <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: c[bg] }}>
                  <Icon name={n.icon} size={18} color={fg} />
                </View>
                <View className="flex-1">
                  <Row className="justify-between">
                    <Txt w="b" size={13} className="flex-1">
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
                {unread && <View className="mt-1 h-2 w-2 rounded-full bg-blue" />}
              </Pressable>
            );
          })
        ) : (
          <Empty icon="bell-off" text={tc('none')} />
        )}
      </View>
    </SecScreen>
  );
}
