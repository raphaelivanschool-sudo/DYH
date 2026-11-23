import { useState } from 'react';
import { toast } from 'sonner';
import { qk, useApiMutation, useDoctors } from '@dyh/api';
import { roomConflicts, roomPeak, roomStatus, roomUsers, type Doctor, type Room } from '@dyh/core';
import { common, defineMessages, useLang, useT } from '@dyh/i18n';
import { Button } from '@/components/ui/button';
import { Alert, Badge, Card, Kpi, KpiGrid, Loading, Rich, SlotBar } from '@/components/ui/display';
import { Field, FilterBar, FilterSelect, Input, SearchBox, filterOk, type Filters } from '@/components/ui/form';
import { Modal } from '@/components/ui/dialog';
import { Picker } from '@/components/ui/picker';
import { EmptyRow, Table, Td, Th } from '@/components/ui/table';
import { usePerms, useRooms } from '@/lib/admin';
import { Icon } from '@/lib/icon';
import { inputCls } from '@/components/ui/form';
import { matches, scheduleLabel } from '@/lib/utils';
import { ConflictBox, isRoomBlocked, useRoomOptions } from './roomsLib';
import { useAm } from './shared';

const m = defineMessages('admin.rooms', {
  total: ['Kabuuang Kuwarto', 'Total Rooms'],
  fromDb: ['mula sa database', 'from the database'],
  inUse: ['Ginagamit', 'In Use'],
  withDoc: ['may naka-assign na doktor', 'with an assigned doctor'],
  vacant: ['Bakante', 'Vacant'],
  ready: ['handang i-assign', 'ready to assign'],
  over: ['Lampas sa Slot', 'Over Capacity'],
  should0: ['dapat ay 0', 'should be 0'],
  overAlert: ['**{{n}} kuwarto ang lampas sa slot.** Mas marami ang sabay na doktor kaysa sa kapasidad:', '**{{n}} room(s) are over capacity.** More doctors at the same time than the room allows:'],
  capacity: ['Kapasidad', 'Capacity'],
  one: ['1 doktor', '1 doctor'],
  shared: ['Hati (2+)', 'Shared (2+)'],
  search: ['Hanapin ang kuwarto o doktor...', 'Search room or doctor...'],
  addRoom: ['Magdagdag ng Kuwarto', 'Add Room'],
  assignRoom: ['I-assign ang Kuwarto', 'Assign Room'],
  assign: ['I-assign', 'Assign'],
  assigned: ['Naka-assign na Doktor at Iskedyul', 'Assigned Doctors & Schedule'],
  maxAtOnce: ['Pinakamaraming sabay: {{p}}/{{c}}', 'Max at once: {{p}}/{{c}}'],
  conflict: ['Conflict', 'Conflict'],
  capNote: ['Ang **kapasidad** ay ilang doktor ang puwedeng sabay sa kuwarto (hal. may harang sa loob). Kapag napuno na ang slot sa parehong araw at oras, naka-block na ang kuwarto — bawal ang lampas.', '**Capacity** is how many doctors can use the room at the same time (e.g. partitioned inside). Once the slots are full for the same days and hours, the room is blocked — no overbooking.'],
  pickDoc: ['Pumili ng doktor', 'Select a doctor'],
  roomDb: ['Kuwarto (mula sa database)', 'Room (from the database)'],
  pickRoom: ['Pumili ng kuwarto', 'Select a room'],
  docFirst: ['Pumili muna ng doktor', 'Choose a doctor first'],
  roomHint: ['Makikita ang bakanteng slot ng bawat kuwarto batay sa iskedyul ng doktor. Naka-lock ang puno.', 'Each room shows free slots for the doctor’s schedule. Full rooms are locked.'],
  docSched: ['Iskedyul ng doktor', 'Doctor schedule'],
  roomBad: ['Pumili ng doktor at kuwartong may bakanteng slot.', 'Pick a doctor and a room with a free slot.'],
  roomNo: ['Numero ng Kuwarto', 'Room Number'],
  howMany: ['Ilang doktor ang puwedeng sabay?', 'How many doctors at the same time?'],
  howManyHint: ['Hal. 3 kung may harang sa loob at tatlong doktor ang sabay na nagkoklinika.', 'E.g. 3 if the room is partitioned and three doctors hold clinic at the same time.'],
  notePh: ['hal. May ECG machine', 'e.g. Has ECG machine'],
  needNo: ['Ilagay ang numero ng kuwarto.', 'Enter the room number.'],
  exists: ['Mayroon nang kuwartong ganito.', 'That room already exists.'],
});

export default function Rooms() {
  const t = useT(m);
  const tc = useT(common);
  const a = useAm();
  const [lang] = useLang();
  const { canDo } = usePerms();
  const { data: rooms } = useRooms();
  const { data: doctors } = useDoctors();
  const [q, setQ] = useState('');
  const [f, setF] = useState<Filters>({});
  const [assign, setAssign] = useState<{ doctor: string | null; room: string | null } | null>(null);
  const [add, setAdd] = useState(false);
  if (!rooms || !doctors) return <Loading />;

  const used = rooms.filter((r) => roomUsers(r.number, doctors).length).length;
  const over = rooms.filter((r) => roomConflicts(r, doctors).length);
  const ro = !canDo('rooms', 'u');
  const rows = rooms.filter(
    (r) => filterOk(f, 'fl', r.floor) && filterOk(f, 'st', roomStatus(r, doctors)) && filterOk(f, 'cp', r.capacity > 1 ? 'm' : '1') && matches([r.number, ...roomUsers(r.number, doctors).map((d) => d.name)], q),
  );

  return (
    <>
      <KpiGrid>
        <Kpi icon="door-open" label={t('total')} value={rooms.length} note={t('fromDb')} color="#2d6cdf" />
        <Kpi icon="user-check" label={t('inUse')} value={used} note={t('withDoc')} color="#12805a" />
        <Kpi icon="door-closed" label={t('vacant')} value={rooms.length - used} note={t('ready')} color="#6b7a90" />
        <Kpi icon="triangle-alert" label={t('over')} value={over.length} note={t('should0')} color="#e04a55" />
      </KpiGrid>
      {over.length > 0 && (
        <Alert kind="danger" icon="triangle-alert" className="mt-3.5">
          <Rich text={t('overAlert', { n: over.length })} />{' '}
          {over.map((r, i) => (
            <span key={r.number}>
              {i > 0 && ', '}
              <b>{r.number}</b> ({roomConflicts(r, doctors).map((d) => d.name).join(' & ')})
            </span>
          ))}
        </Alert>
      )}
      <FilterBar active={Object.values(f).some(Boolean)} onClear={() => setF({})}>
        <FilterSelect label={tc('floor')} value={f.fl ?? ''} onChange={(v) => setF({ ...f, fl: v })} options={['1', '2', '3'].map((x) => ({ value: x, label: x }))} />
        <FilterSelect label={tc('status')} value={f.st ?? ''} onChange={(v) => setF({ ...f, st: v })} options={[{ value: 'in_use', label: t('inUse') }, { value: 'vacant', label: t('vacant') }, { value: 'over', label: t('over') }]} />
        <FilterSelect label={t('capacity')} value={f.cp ?? ''} onChange={(v) => setF({ ...f, cp: v })} options={[{ value: '1', label: t('one') }, { value: 'm', label: t('shared') }]} />
      </FilterBar>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <SearchBox className="w-[340px] max-w-full" value={q} onChange={setQ} placeholder={t('search')} />
        <div className="flex gap-2">
          {canDo('rooms', 'c') && (
            <Button variant="o" icon="plus" onClick={() => setAdd(true)}>
              {t('addRoom')}
            </Button>
          )}
          {!ro && (
            <Button icon="user-cog" onClick={() => setAssign({ doctor: null, room: null })}>
              {t('assignRoom')}
            </Button>
          )}
          {ro && !canDo('rooms', 'c') && <Badge icon="eye">{tc('readOnly')}</Badge>}
        </div>
      </div>
      <Table className="mt-3">
        <thead>
          <tr>
            <Th>{tc('room')}</Th>
            <Th>{tc('floor')}</Th>
            <Th>{t('capacity')}</Th>
            <Th>{t('assigned')}</Th>
            <Th>{tc('status')}</Th>
            <Th className="text-right">{tc('actions')}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const users = roomUsers(r.number, doctors);
            const conf = roomConflicts(r, doctors);
            const pk = roomPeak(r, doctors);
            return (
              <tr key={r.number}>
                <Td nowrap>
                  <b className="inline-flex items-center gap-1">
                    <Icon name="door-open" size={15} /> {r.number}
                  </b>
                </Td>
                <Td>{r.floor}</Td>
                <Td nowrap>
                  <span className="inline-flex items-center gap-1">
                    <Icon name="users" size={15} /> {a('doctorsN', { n: r.capacity })}
                  </span>
                  <div className="mt-1">
                    <SlotBar cap={r.capacity} used={pk} />
                  </div>
                  <div className="text-[11px] text-muted">{t('maxAtOnce', { p: pk, c: r.capacity })}</div>
                </Td>
                <Td>
                  {users.length ? (
                    users.map((d) => (
                      <div key={d.id} className="flex flex-wrap items-center gap-1.5 py-0.5">
                        <b className="text-[12.5px]">{d.name}</b>
                        <span className="text-[11px] text-muted">{scheduleLabel(d, lang)}</span>
                        {conf.includes(d) && <Badge tone="red" icon="triangle-alert">{t('conflict')}</Badge>}
                      </div>
                    ))
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </Td>
                <Td>
                  {conf.length ? <Badge tone="red" icon="triangle-alert">{t('over')}</Badge> : users.length ? <Badge tone="green" icon="calendar-check">{t('inUse')}</Badge> : <Badge>{t('vacant')}</Badge>}
                </Td>
                <Td className="text-right">
                  {!ro && (
                    <Button variant="o" size="sm" icon="user-cog" onClick={() => setAssign({ doctor: (conf[1] ?? users[0])?.id ?? null, room: r.number })}>
                      {t('assign')}
                    </Button>
                  )}
                </Td>
              </tr>
            );
          })}
          <EmptyRow cols={6} show={!rows.length} />
        </tbody>
      </Table>
      <p className="mt-3 flex items-start gap-1.5 text-[12.5px] text-muted">
        <Icon name="info" size={15} className="mt-0.5" />
        <Rich text={t('capNote')} />
      </p>
      {assign && <AssignDialog key={`${assign.doctor}-${assign.room}`} init={assign} rooms={rooms} doctors={doctors} onClose={() => setAssign(null)} />}
      <AddRoomDialog open={add} onOpenChange={setAdd} rooms={rooms} />
    </>
  );
}

function AssignDialog({ init, rooms, doctors, onClose }: { init: { doctor: string | null; room: string | null }; rooms: Room[]; doctors: Doctor[]; onClose: () => void }) {
  const t = useT(m);
  const tc = useT(common);
  const a = useAm();
  const [lang] = useLang();
  const roomOpts = useRoomOptions();
  const [docId, setDocId] = useState(init.doctor);
  const [room, setRoom] = useState(init.room);
  const d = doctors.find((x) => x.id === docId);
  const r = rooms.find((x) => x.number === room);
  const bad = !d || !r || (r.number !== d.room && isRoomBlocked(r, d, doctors));
  const mut = useApiMutation((api, v: { id: string; room: string }) => api.assignRoom(v.id, v.room), [qk.doctors, qk.rooms, qk.audit]);
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={t('assignRoom')}
      icon="door-open"
      actions={
        <>
          <Button variant="o" onClick={onClose}>{tc('cancel')}</Button>
          <Button
            variant={bad ? 'o' : 'p'}
            icon="check"
            disabled={mut.isPending}
            onClick={async () => {
              if (bad) return toast.error(t('roomBad'));
              await mut.mutateAsync({ id: d.id, room: r.number });
              toast.success(a('saved'));
              onClose();
            }}
          >
            {t('assign')}
          </Button>
        </>
      }
    >
      <Field label={tc('doctor')} icon="stethoscope" className="mt-0">
        <Picker value={docId} onChange={setDocId} icon="stethoscope" placeholder={t('pickDoc')} searchPlaceholder={a('searchDoctor')} options={doctors.map((x) => ({ value: x.id, label: x.name, sub: `${scheduleLabel(x, lang)} · ${a('roomN', { n: x.room })}`, icon: 'stethoscope' }))} />
      </Field>
      <Field label={t('roomDb')} icon="door-open" hint={t('roomHint')}>
        {d ? (
          <Picker value={room} onChange={setRoom} icon="door-open" placeholder={t('pickRoom')} options={roomOpts(rooms, doctors, d)} />
        ) : (
          <div className={`${inputCls} flex items-center gap-2 text-muted opacity-60`}>
            <Icon name="door-open" size={17} />
            {t('docFirst')}
          </div>
        )}
      </Field>
      {d && (
        <Card className="mt-3 flex items-center gap-2 p-2.5 text-[12.5px]">
          <Icon name="calendar" size={16} />
          <span>
            {t('docSched')}: <b>{scheduleLabel(d, lang)}</b>
          </span>
        </Card>
      )}
      <ConflictBox room={r} doctor={d} doctors={doctors} />
    </Modal>
  );
}

function AddRoomDialog({ open, onOpenChange, rooms }: { open: boolean; onOpenChange: (v: boolean) => void; rooms: Room[] }) {
  const t = useT(m);
  const tc = useT(common);
  const a = useAm();
  const [no, setNo] = useState('');
  const [fl, setFl] = useState('');
  const [cap, setCap] = useState(1);
  const [note, setNote] = useState('');
  const mut = useApiMutation((api, r: Room & { note?: string }) => api.addRoom(r), [qk.rooms]);
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('addRoom')}
      icon="door-open"
      actions={
        <>
          <Button variant="o" onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
          <Button
            icon="check"
            disabled={mut.isPending}
            onClick={async () => {
              if (!no.trim()) return toast.error(t('needNo'));
              if (rooms.some((r) => r.number === no.trim())) return toast.error(t('exists'));
              await mut.mutateAsync({ number: no.trim(), floor: Number(fl) || Number(no[0]) || 1, capacity: cap, note });
              toast.success(a('saved'));
              setNo('');
              setFl('');
              setCap(1);
              setNote('');
              onOpenChange(false);
            }}
          >
            {tc('add')}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('roomNo')} icon="hash" className="mt-0">
          <Input inputMode="numeric" placeholder="127" value={no} onChange={(e) => setNo(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label={tc('floor')} icon="building" className="mt-0">
          <Input inputMode="numeric" placeholder="1" value={fl} onChange={(e) => setFl(e.target.value.replace(/\D/g, ''))} />
        </Field>
      </div>
      <Field label={t('howMany')} icon="users" hint={t('howManyHint')}>
        <div className="flex items-center gap-2.5">
          <Button variant="o" icon="minus" aria-label="-" onClick={() => setCap(Math.max(1, cap - 1))} />
          <b className="min-w-10 text-center text-[24px]">{cap}</b>
          <Button variant="o" icon="plus" aria-label="+" onClick={() => setCap(Math.min(6, cap + 1))} />
          <SlotBar cap={cap} used={0} />
        </div>
      </Field>
      <Field label={tc('notes')} icon="notebook-pen" optional>
        <Input placeholder={t('notePh')} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  );
}
