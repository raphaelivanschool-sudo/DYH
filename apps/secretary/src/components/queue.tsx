import { Pressable, View } from 'react-native';
import { type QueueEntry } from '@dyh/core';
import { useT } from '@dyh/i18n';
import { Badge, PriorityBadge, Row, Txt, TypeBadge, cx } from '@dyh/ui-native';
import { sm } from '../msgs';
import { useUi } from '../store';
import { go } from './shell';

/** Open the vitals form for a queue number. */
export const openVitals = (n: string) => {
  useUi.getState().set({ vitalsFor: n });
  go('/vitals');
};

export function PRow({ p, hasVitals, right, onPress }: { p: QueueEntry; hasVitals: boolean; right?: React.ReactNode; onPress?: () => void }) {
  const t = useT(sm);
  return (
    <Pressable onPress={onPress} className="mb-2 flex-row items-center gap-3 rounded-2xl border border-line bg-card p-3">
      <View className={cx('min-w-[62px] items-center rounded-xl px-2 py-2', p.priority ? 'bg-prio-bg' : 'bg-sky')}>
        <Txt w="x" size={13.5} className={p.priority ? 'text-prio' : 'text-blue'}>
          {p.number}
        </Txt>
      </View>
      <View className="flex-1">
        <Txt w="b" numberOfLines={1}>
          {p.patientName}
        </Txt>
        <Row className="mt-1 flex-wrap" gap="gap-1">
          <TypeBadge type={p.type} />
          <PriorityBadge p={p.priority} />
          {hasVitals ? (
            <Badge tone="green" icon="heart-pulse">
              {t('vitalsDone')}
            </Badge>
          ) : (
            <Pressable onPress={() => openVitals(p.number)}>
              <Badge tone="red" icon="heart-pulse">
                {t('noVitals')}
              </Badge>
            </Pressable>
          )}
          {p.type === 'online' && p.arrivedAt && (
            <Badge tone="teal" icon="map-pin-check">
              {t('arrivedAt', { t: p.arrivedAt })}
            </Badge>
          )}
        </Row>
      </View>
      {right}
    </Pressable>
  );
}
