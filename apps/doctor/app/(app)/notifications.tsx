import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { DOCTOR_NOTIFICATIONS, type AppNotification } from '@dyh/core';
import { common, useLoc, useT } from '@dyh/i18n';
import { Button, Chip, Icon, Row, Screen, TONES, Txt, cx, toast, useColors } from '@dyh/ui-native';
import { DocHeader, go, openRecord } from '../../src/components/shell';
import { dm } from '../../src/msgs';

type Tab = 'all' | 'queue' | 'record';

/** Grouped Today / Yesterday / Earlier. Tapping opens the related screen. */
export default function Notifications() {
  const t = useT(dm);
  const tc = useT(common);
  const loc = useLoc();
  const c = useColors();
  const [tab, setTab] = useState<Tab>('all');
  const [read, setRead] = useState(false);
  const list = DOCTOR_NOTIFICATIONS.filter((n) => tab === 'all' || n.category === tab);
  const groups = [
    ['today', t('gToday')],
    ['yesterday', t('gYesterday')],
    ['earlier', t('gEarlier')],
  ] as const;
  const open = (n: AppNotification) => {
    if (n.category === 'record') openRecord('DYH-2024-000233');
    else if (n.category === 'queue') go('/queue');
    else go('/home');
  };
  return (
    <Screen
      header={
        <DocHeader
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
        />
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
      {groups.map(([g, label]) => {
        const items = list.filter((n) => n.group === g);
        if (!items.length) return null;
        return (
          <View key={g}>
            <Txt w="b" size={12} className="mb-2 mt-5 text-muted" style={{ letterSpacing: 0.5 }}>
              {label.toUpperCase()}
            </Txt>
            {items.map((n) => {
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
            })}
          </View>
        );
      })}
    </Screen>
  );
}
