import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAnnouncements } from '@dyh/api';
import type { Announcement } from '@dyh/core';
import { common, useT } from '@dyh/i18n';
import { Badge, Button, Dialog, Gradient, Icon, Rich, Row, Txt } from '@dyh/ui-native';
import { useDates } from '../lib';
import { pm } from '../msgs';

/** Active announcements for all patients. Content is not translated (business rule). */
export function usePatientAnnouncements() {
  const { data } = useAnnouncements();
  return useMemo(() => (data ?? []).filter((a) => a.status === 'active' && a.audience === 'all'), [data]);
}

function Banner({ a, tall }: { a: Announcement; tall?: boolean }) {
  return (
    <Gradient colors={a.colors} className="flex-row items-center gap-3 overflow-hidden px-4" style={{ height: tall ? 120 : 92, borderRadius: tall ? 16 : 0 }}>
      <View className="absolute -right-6 -top-8 h-28 w-28 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
      <View className="h-11 w-11 items-center justify-center rounded-[14px]" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}>
        <Icon name={a.icon} size={22} color="#ffffff" />
      </View>
      <View className="flex-1">
        <Txt w="b" size={tall ? 18 : 16} className="text-white">
          {a.title}
        </Txt>
        <Txt size={12.5} className="text-white" style={{ opacity: 0.85 }}>
          {a.subtitle}
        </Txt>
      </View>
    </Gradient>
  );
}

export function AnnouncementCard({ a, onPress }: { a: Announcement; onPress?: () => void }) {
  const t = useT(pm);
  return (
    <Pressable onPress={onPress} className="overflow-hidden rounded-2xl border border-line bg-card">
      <Banner a={a} />
      <View className="px-4 py-3">
        <Txt size={13} className="text-muted">
          {a.summary}
        </Txt>
        {onPress && (
          <Row gap="gap-0.5" className="mt-2">
            <Txt w="b" size={13} className="text-blue">
              {t('readFull')}
            </Txt>
            <Icon name="chevron-right" size={15} color="blue" />
          </Row>
        )}
      </View>
    </Pressable>
  );
}

export function AnnouncementDialog({ a, onClose, footer }: { a: Announcement | null; onClose: () => void; footer?: React.ReactNode }) {
  const t = useT(pm);
  const tc = useT(common);
  const dt = useDates();
  return (
    <Dialog open={!!a} onClose={onClose} title={tc('announcement')} icon="megaphone" actions={footer ?? <Button className="flex-1" icon="check" onPress={onClose}>{tc('close')}</Button>}>
      {a && (
        <>
          <Banner a={a} tall />
          <Row className="mt-3 flex-wrap" gap="gap-1.5">
            <Badge tone="blue" icon="calendar">
              {dt.short(a.from).replace(/, \d{4}$/, '')} – {dt.short(a.to).replace(/, \d{4}$/, '')}
            </Badge>
            <Badge icon="users">{t('allPatients')}</Badge>
            <Badge icon="building-2">Dr. Yanga's Hospital</Badge>
          </Row>
          <View className="mt-4 gap-3">
            {a.body.split('\n').filter(Boolean).map((p, i) => (
              <Rich key={i} text={p} size={14.5} />
            ))}
          </View>
        </>
      )}
    </Dialog>
  );
}

export function AnnouncementList() {
  const list = usePatientAnnouncements();
  const [open, setOpen] = useState<Announcement | null>(null);
  return (
    <View className="gap-2.5">
      {list.map((a) => (
        <AnnouncementCard key={a.id} a={a} onPress={() => setOpen(a)} />
      ))}
      <AnnouncementDialog a={open} onClose={() => setOpen(null)} />
    </View>
  );
}

/** Pop-up shown once after log in, stepping through active announcements. */
export function AnnouncementPopup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const list = usePatientAnnouncements();
  const tc = useT(common);
  const [i, setI] = useState(0);
  const a = open ? list[i] ?? null : null;
  const last = i >= list.length - 1;
  return (
    <AnnouncementDialog
      a={a}
      onClose={onClose}
      footer={
        <>
          <Txt w="b" size={12} className="self-center text-muted">
            {i + 1}/{list.length}
          </Txt>
          <View className="flex-1" />
          <Button variant="o" onPress={onClose}>
            {tc('close')}
          </Button>
          {!last && (
            <Button iconRight="chevron-right" onPress={() => setI(i + 1)}>
              {tc('next')}
            </Button>
          )}
        </>
      }
    />
  );
}
