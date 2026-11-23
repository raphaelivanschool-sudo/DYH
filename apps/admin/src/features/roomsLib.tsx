import { roomFreeSlots, roomOverlaps, roomPeak, roomUsers, type Doctor, type Room } from '@dyh/core';
import { defineMessages, useLang, useT } from '@dyh/i18n';
import { Alert, SlotBar } from '@/components/ui/display';
import type { PickOption } from '@/components/ui/picker';
import { scheduleLabel } from '@/lib/utils';

export const rm = defineMessages('admin.rooms.lib', {
  full: ['PUNO', 'FULL'],
  slotsFree: ['{{n}}/{{cap}} slot bakante', '{{n}}/{{cap}} slots free'],
  free: ['{{n}}/{{cap}} bakante', '{{n}}/{{cap}} free'],
  nobody: ['Walang naka-assign', 'No one assigned'],
  slotsFor: ['Slot sa iskedyul ni {{name}}:', 'Slots for {{name}}:'],
  blocked: ['**Naka-block ang Kuwarto {{r}}.** Puno na ang {{cap}} slot sa parehong araw at oras: {{who}}. Pumili ng ibang kuwarto.', '**Room {{r}} is blocked.** All {{cap}} slot(s) are taken on the same days and hours: {{who}}. Choose another room.'],
  sharing: ['May bakanteng slot. Kasabay sa kuwarto: {{who}}', 'Slot available. Sharing the room at the same time with: {{who}}'],
  alone: ['Walang kasabay sa Kuwarto {{r}} sa iskedyul na ito.', 'No one else uses Room {{r}} at this schedule.'],
});

/** Room choices for a doctor, with free slots computed from overlapping schedules. */
export function useRoomOptions() {
  const t = useT(rm);
  const [lang] = useLang();
  return (rooms: Room[], doctors: Doctor[], d?: Doctor | null): PickOption[] =>
    rooms.map((r) => {
      const users = roomUsers(r.number, doctors).filter((y) => !d || y.id !== d.id);
      const free = d ? roomFreeSlots(r, d, doctors) : r.capacity - roomPeak(r, doctors);
      const full = !!d && free <= 0;
      return {
        value: r.number,
        label: `${lang === 'tl' ? 'Kuwarto' : 'Room'} ${r.number} · ${full ? t('full') : t('slotsFree', { n: free, cap: r.capacity })}`,
        sub: `${lang === 'tl' ? 'Palapag' : 'Floor'} ${r.floor} · ${users.length ? users.map((y) => `${y.name} (${scheduleLabel(y, lang)})`).join(', ') : t('nobody')}`,
        icon: full ? 'lock' : 'door-open',
        disabled: full,
      };
    });
}

export const isRoomBlocked = (room: Room | undefined, d: Doctor | undefined, doctors: Doctor[]) => !!room && !!d && roomFreeSlots(room, d, doctors) <= 0;

/** Conflict / availability box shown under a room picker. */
export function ConflictBox({ room, doctor, doctors }: { room?: Room; doctor?: Doctor; doctors: Doctor[] }) {
  const t = useT(rm);
  const [lang] = useLang();
  if (!room || !doctor) return null;
  const ov = roomOverlaps(room.number, doctor, doctors);
  const free = room.capacity - ov.length;
  const who = ov.map((x) => `${x.name} (${scheduleLabel(x, lang)})`).join(', ');
  const slots = (
    <div className="mt-2 flex items-center gap-1.5">
      <span className="text-[12px] font-bold">{t('slotsFor', { name: doctor.name.split(' ').slice(0, 2).join(' ') })}</span>
      <SlotBar cap={room.capacity} used={ov.length} />
      <span className="text-[12px] font-bold" style={{ color: free > 0 ? 'var(--green)' : 'var(--red)' }}>
        {free > 0 ? t('free', { n: free, cap: room.capacity }) : t('full')}
      </span>
    </div>
  );
  const rich = (s: string) => s.split(/\*\*(.+?)\*\*/).map((p, i) => (i % 2 ? <b key={i}>{p}</b> : p));
  if (free <= 0)
    return (
      <Alert kind="danger" icon="lock" className="mt-3">
        {rich(t('blocked', { r: room.number, cap: room.capacity, who }))}
        {slots}
      </Alert>
    );
  if (ov.length)
    return (
      <Alert icon="calendar-check" className="mt-3">
        {t('sharing', { who })}
        {slots}
      </Alert>
    );
  return (
    <Alert kind="ok" icon="circle-check" className="mt-3">
      {t('alone', { r: room.number })}
      {slots}
    </Alert>
  );
}
