import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useAnnouncements } from '@dyh/api';
import type { Announcement } from '@dyh/core';
import { common, useT } from '@dyh/i18n';
import { AnnouncementCard, AnnouncementDialog, Button, Txt } from '@dyh/ui-native';

/** Active announcements for all patients. Content is not translated (business rule). */
export function usePatientAnnouncements() {
  const { data } = useAnnouncements();
  return useMemo(() => (data ?? []).filter((a) => a.status === 'active' && a.audience === 'all'), [data]);
}

export { AnnouncementCard, AnnouncementDialog };

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
