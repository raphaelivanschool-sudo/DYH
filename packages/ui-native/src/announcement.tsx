import { Pressable, View } from 'react-native';
import { MONTH_SHORT, parseISO, type Announcement, type ISODate } from '@dyh/core';
import { common, defineMessages, useLang, useT } from '@dyh/i18n';
import { Icon } from './icon';
import { Dialog } from './overlay';
import { Badge, Button, Gradient, Row } from './primitives';
import { Rich, Txt } from './text';

const m = defineMessages('announcement', {
  readFull: ['Basahin ang buong detalye', 'Read full details'],
  allPatients: ['Lahat ng Pasyente', 'All Patients'],
});

/** Coloured header strip of an announcement. */
export function AnnouncementBanner({ a, tall }: { a: Announcement; tall?: boolean }) {
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
  const t = useT(m);
  return (
    <Pressable onPress={onPress} className="overflow-hidden rounded-2xl border border-line bg-card">
      <AnnouncementBanner a={a} />
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

/** Full announcement. Content is not translated by design (business rule). */
export function AnnouncementDialog({ a, onClose, footer }: { a: Announcement | null; onClose: () => void; footer?: React.ReactNode }) {
  const t = useT(m);
  const tc = useT(common);
  const [lang] = useLang();
  const md = (d: ISODate) => {
    const [, mo, day] = parseISO(d);
    return `${MONTH_SHORT[lang][mo]} ${day}`;
  };
  return (
    <Dialog
      open={!!a}
      onClose={onClose}
      title={tc('announcement')}
      icon="megaphone"
      actions={
        footer ?? (
          <Button className="flex-1" icon="check" onPress={onClose}>
            {tc('close')}
          </Button>
        )
      }
    >
      {a && (
        <>
          <AnnouncementBanner a={a} tall />
          <Row className="mt-3 flex-wrap" gap="gap-1.5">
            <Badge tone="blue" icon="calendar">
              {md(a.from)} – {md(a.to)}
            </Badge>
            <Badge icon="users">{t('allPatients')}</Badge>
            <Badge icon="building-2">Dr. Yanga's Hospital</Badge>
          </Row>
          <View className="mt-4 gap-3">
            {a.body
              .split('\n')
              .filter(Boolean)
              .map((p, i) => (
                <Rich key={i} text={p} size={14.5} />
              ))}
          </View>
        </>
      )}
    </Dialog>
  );
}
