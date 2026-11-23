import { useState } from 'react';
import { toast } from 'sonner';
import { qk, useApiMutation, useDoctors, useLiveStatus, useSpecializations } from '@dyh/api';
import type { ClinicConfig, Doctor, Specialization } from '@dyh/core';
import { common, defineMessages, useLang, useLoc, useT } from '@dyh/i18n';
import { Button } from '@/components/ui/button';
import { Avatar, Badge, Card, Loading, Panel } from '@/components/ui/display';
import { Chip, Field, Input, SearchBox, Switch } from '@/components/ui/form';
import { Modal } from '@/components/ui/dialog';
import { ListEmpty } from '@/components/ui/table';
import { useClinics, usePerms } from '@/lib/admin';
import { Icon } from '@/lib/icon';
import { cn, matches, scheduleLabel, shortSpec } from '@/lib/utils';
import { DoctorChecks } from './accounts/parts';
import { useAm } from './shared';

const m = defineMessages('admin.clinics', {
  search: ['Hanapin ang espesyalisasyon, kuwarto o doktor...', 'Search specialization, room or doctor...'],
  add: ['Magdagdag ng Klinika', 'Add Clinic'],
  appear: ['Ang mga klinika rito ang lalabas sa Patient App at Kiosk.', 'Clinics configured here appear in the Patient App and Kiosk.'],
  openToday: ['{{n}} bukas ngayon', '{{n}} open today'],
  noClinicToday: ['Walang clinic ngayon', 'No clinic today'],
  details: ['Tingnan ang Detalye', 'View Details'],
  location: ['Lokasyon', 'Location'],
  locNote: ['Ang lokasyon ay batay sa kuwarto ng bawat doktor.', 'Location follows each doctor’s room.'],
  docSched: ['Mga Doktor at Iskedyul', 'Doctors & Schedules'],
  services: ['Mga Serbisyo', 'Services'],
  showIn: ['Ipakita sa Patient App at Kiosk', 'Show in Patient App & Kiosk'],
  editTitle: ['Baguhin ang Klinika · {{name}}', 'Edit Clinic · {{name}}'],
  docsEdit: ['Mga Doktor (magdagdag o mag-alis)', 'Doctors (add or remove)'],
  noSvc: ['Wala pang serbisyo', 'No services yet'],
  svcPh: ['hal. Joint injection', 'e.g. Joint injection'],
  locAuto: ['Lokasyon (awtomatiko mula sa doktor)', 'Location (automatic from doctors)'],
  pickDocs: ['Pumili ng doktor para makita ang lokasyon.', 'Pick doctors to see the location.'],
  nameTl: ['Pangalan (Tagalog)', 'Name (Tagalog)'],
  nameEn: ['Pangalan (English)', 'Name (English)'],
  icon: ['Icon ng Klinika', 'Clinic Icon'],
  assigned: ['Mga Doktor', 'Assigned Doctors'],
  added: ['Naidagdag ang klinika', 'Clinic added'],
  needName: ['Ilagay ang pangalan sa Tagalog at English.', 'Enter the name in Tagalog and English.'],
});

const ICONS = ['stethoscope', 'heart-pulse', 'baby', 'heart', 'ear', 'bone', 'eye', 'brain', 'wind', 'pill', 'droplets', 'syringe', 'smile', 'scissors', 'activity', 'hand'];

export default function Clinics() {
  const t = useT(m);
  const tc = useT(common);
  const a = useAm();
  const loc = useLoc();
  const { canDo } = usePerms();
  const { data: specs } = useSpecializations();
  const { data: doctors } = useDoctors();
  const { data: clinics } = useClinics();
  const { data: live = [] } = useLiveStatus();
  const [q, setQ] = useState('');
  const [view, setView] = useState<string | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [add, setAdd] = useState(false);
  if (!specs || !doctors || !clinics) return <Loading />;

  const openIds = new Set(live.filter((l) => l.openToday).map((l) => l.doctorId));
  const docsOf = (c: ClinicConfig) => c.doctorIds.map((id) => doctors.find((d) => d.id === id)).filter(Boolean) as Doctor[];
  const list = specs
    .map((s) => ({ s, c: clinics.find((c) => c.specializationId === s.id) ?? { specializationId: s.id, doctorIds: [], services: [], visible: true } }))
    .filter(({ s, c }) => matches([s.name.tl, s.name.en, ...docsOf(c).map((d) => `${d.name} ${d.room}`)], q));
  const cur = list.find((x) => x.s.id === view) ?? null;
  const ed = list.find((x) => x.s.id === edit) ?? null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SearchBox className="w-[340px] max-w-full" value={q} onChange={setQ} placeholder={t('search')} />
        {canDo('clinics', 'c') ? (
          <Button icon="plus" onClick={() => setAdd(true)}>{t('add')}</Button>
        ) : (
          <Badge icon="eye">{tc('readOnly')}</Badge>
        )}
      </div>
      <p className="mt-2 flex items-center gap-1 text-[12.5px] text-muted">
        <Icon name="info" size={14} />
        {t('appear')}
      </p>
      <div className="mt-3 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {list.map(({ s, c }) => {
          const ds = docsOf(c);
          const open = ds.filter((d) => openIds.has(d.id)).length;
          return (
            <Panel key={s.id} className={cn(!c.visible && 'opacity-60')}>
              <div className="flex items-center gap-3">
                <Avatar icon={s.icon} size="md" />
                <div className="min-w-0 flex-1">
                  <b className="block truncate">{shortSpec(loc(s.name))}</b>
                  <div className="flex items-center gap-1 text-[12.5px] text-muted">
                    <Icon name="map-pin" size={13} />
                    {ds.length ? [...new Set(ds.map((d) => d.room))].join(', ') : '—'}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge tone="blue" icon="stethoscope">{a('doctorsN', { n: ds.length })}</Badge>
                {open ? <Badge tone="green" icon="door-open">{t('openToday', { n: open })}</Badge> : <Badge>{t('noClinicToday')}</Badge>}
              </div>
              <Button variant="o" size="sm" icon="eye" className="mt-3 w-full" onClick={() => setView(s.id)}>
                {t('details')}
              </Button>
            </Panel>
          );
        })}
      </div>
      <ListEmpty show={!list.length} />

      {cur && (
        <ClinicView
          spec={cur.s}
          clinic={cur.c}
          doctors={docsOf(cur.c)}
          live={live}
          open
          onOpenChange={(v) => !v && setView(null)}
          onEdit={
            canDo('clinics', 'u')
              ? () => {
                  setView(null);
                  setEdit(cur.s.id);
                }
              : undefined
          }
        />
      )}
      {ed && <ClinicEdit key={ed.s.id} spec={ed.s} clinic={ed.c} allDoctors={doctors} open onOpenChange={(v) => !v && setEdit(null)} />}
      <NewClinic open={add} onOpenChange={setAdd} allDoctors={doctors} />
    </>
  );
}

function ClinicView({ spec, clinic, doctors, live, open, onOpenChange, onEdit }: { spec: Specialization; clinic: ClinicConfig; doctors: Doctor[]; live: { doctorId: string; openToday: boolean; waiting: number }[]; open: boolean; onOpenChange: (v: boolean) => void; onEdit?: () => void }) {
  const t = useT(m);
  const tc = useT(common);
  const a = useAm();
  const loc = useLoc();
  const [lang] = useLang();
  const save = useApiMutation((api, c: ClinicConfig) => api.saveClinic(c), [qk.clinics]);
  const lv = (id: string) => live.find((l) => l.doctorId === id);
  const waiting = doctors.reduce((n, d) => n + (lv(d.id)?.waiting ?? 0), 0);
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={loc(spec.name)}
      icon={spec.icon}
      actions={
        <>
          <Button variant="o" onClick={() => onOpenChange(false)}>{tc('close')}</Button>
          {onEdit && <Button icon="pencil" onClick={onEdit}>{tc('edit')}</Button>}
        </>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        <Stat icon="stethoscope" label={tc('doctors')} value={doctors.length} />
        <Stat icon="users" label={tc('waiting')} value={waiting} />
        <Stat icon="map-pin" label={t('location')} value={[...new Set(doctors.map((d) => d.room))].join(', ') || '—'} small />
      </div>
      <div className="mt-1 flex items-center gap-1 text-[11.5px] text-muted">
        <Icon name="info" size={13} />
        {t('locNote')}
      </div>
      <b className="mt-3 flex items-center gap-1.5 text-[13px]">
        <Icon name="stethoscope" size={16} />
        {t('docSched')}
      </b>
      {doctors.map((d) => (
        <div key={d.id} className="flex items-center gap-2.5 border-b border-line py-2 last:border-0">
          <Avatar name={d.name} light />
          <div className="flex-1">
            <b className="text-[13px]">{d.name}</b>
            <div className="text-[11.5px] text-muted">
              {a('roomN', { n: d.room })} · {scheduleLabel(d, lang)}
            </div>
          </div>
          {lv(d.id)?.openToday ? <Badge tone="green">{a('open')}</Badge> : <Badge>{a('closed')}</Badge>}
        </div>
      ))}
      <b className="mt-3 flex items-center gap-1.5 text-[13px]">
        <Icon name="list-checks" size={16} />
        {t('services')}
      </b>
      <div className="mt-2 flex flex-wrap gap-2">
        {clinic.services.map((s) => (
          <Chip key={s}>{s}</Chip>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2.5 border-t border-line pt-3">
        <Icon name="smartphone" size={17} />
        <b className="flex-1">{t('showIn')}</b>
        <Switch label={t('showIn')} checked={clinic.visible} onChange={(visible) => onEdit && save.mutate({ ...clinic, visible })} />
      </div>
    </Modal>
  );
}

const Stat = ({ icon, label, value, small }: { icon: string; label: string; value: React.ReactNode; small?: boolean }) => (
  <Card className="p-3">
    <div className="flex items-center gap-1 text-[11.5px] font-semibold text-muted">
      <Icon name={icon} size={14} />
      {label}
    </div>
    <div className={cn('mt-1 font-extrabold', small ? 'text-[16px]' : 'text-[22px]')}>{value}</div>
  </Card>
);

function ServicesEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const t = useT(m);
  const tc = useT(common);
  const [txt, setTxt] = useState('');
  const add = () => {
    if (txt.trim()) onChange([...value, txt.trim()]);
    setTxt('');
  };
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {value.length ? (
          value.map((s, i) => (
            <span key={s + i} className="inline-flex items-center gap-1 rounded-full bg-primary py-1.5 pl-3 pr-1.5 text-[13px] font-semibold text-white">
              {s}
              <button type="button" aria-label={tc('remove')} onClick={() => onChange(value.filter((_, j) => j !== i))} className="grid size-5 place-items-center rounded-full hover:bg-white/20">
                <Icon name="x" size={13} />
              </button>
            </span>
          ))
        ) : (
          <span className="text-[12.5px] text-muted">{t('noSvc')}</span>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <Input placeholder={t('svcPh')} value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} />
        <Button variant="g" icon="plus" onClick={add}>{tc('add')}</Button>
      </div>
    </>
  );
}

function LocationPreview({ ids, doctors }: { ids: string[]; doctors: Doctor[] }) {
  const t = useT(m);
  const a = useAm();
  return (
    <Card className="mt-2 px-3 py-2.5 text-[12.5px]">
      <b className="flex items-center gap-1.5">
        <Icon name="map-pin" size={15} />
        {t('locAuto')}
      </b>
      <div className="mt-1 text-muted">
        {ids.length
          ? ids.map((id) => {
              const d = doctors.find((x) => x.id === id)!;
              return <div key={id}>{`${d.name} — ${a('roomN', { n: d.room })}, ${a('floorN', { n: d.floor })}`}</div>;
            })
          : t('pickDocs')}
      </div>
    </Card>
  );
}

function ClinicEdit({ spec, clinic, allDoctors, open, onOpenChange }: { spec: Specialization; clinic: ClinicConfig; allDoctors: Doctor[]; open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useT(m);
  const tc = useT(common);
  const a = useAm();
  const loc = useLoc();
  const [docs, setDocs] = useState(clinic.doctorIds);
  const [svc, setSvc] = useState(clinic.services);
  const save = useApiMutation((api, c: ClinicConfig) => api.saveClinic(c), [qk.clinics]);
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={t('editTitle', { name: shortSpec(loc(spec.name)) })}
      icon="pencil"
      actions={
        <>
          <Button variant="o" onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
          <Button
            icon="save"
            disabled={save.isPending}
            onClick={async () => {
              await save.mutateAsync({ ...clinic, doctorIds: docs, services: svc });
              toast.success(a('saved'));
              onOpenChange(false);
            }}
          >
            {tc('save')}
          </Button>
        </>
      }
    >
      <Field label={t('docsEdit')} icon="stethoscope" className="mt-0">
        <DoctorChecks doctors={allDoctors} value={docs} onChange={setDocs} />
        <LocationPreview ids={docs} doctors={allDoctors} />
      </Field>
      <Field label={t('services')} icon="list-checks">
        <ServicesEditor value={svc} onChange={setSvc} />
      </Field>
    </Modal>
  );
}

function NewClinic({ open, onOpenChange, allDoctors }: { open: boolean; onOpenChange: (v: boolean) => void; allDoctors: Doctor[] }) {
  const t = useT(m);
  const tc = useT(common);
  const [tl, setTl] = useState('');
  const [en, setEn] = useState('');
  const [icon, setIcon] = useState('stethoscope');
  const [docs, setDocs] = useState<string[]>([]);
  const [svc, setSvc] = useState<string[]>([]);
  const save = useApiMutation((api, c: Parameters<typeof api.saveClinic>[0]) => api.saveClinic(c), [qk.clinics, qk.specs]);
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={t('add')}
      icon="building-2"
      actions={
        <>
          <Button variant="o" onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
          <Button
            icon="check"
            disabled={save.isPending}
            onClick={async () => {
              if (!tl.trim() || !en.trim()) return toast.error(t('needName'));
              await save.mutateAsync({ specializationId: en.trim().toLowerCase().replace(/[^a-z]+/g, '-'), name: { tl, en }, icon, doctorIds: docs, services: svc, visible: true });
              toast.success(t('added'));
              onOpenChange(false);
            }}
          >
            {t('add')}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('nameTl')} icon="heading" className="mt-0">
          <Input placeholder="hal. Rheumatolohiya (Kasukasuan)" value={tl} onChange={(e) => setTl(e.target.value)} />
        </Field>
        <Field label={t('nameEn')} icon="heading" className="mt-0">
          <Input placeholder="e.g. Rheumatology" value={en} onChange={(e) => setEn(e.target.value)} />
        </Field>
      </div>
      <Field label={t('icon')} icon="image">
        <div className="grid grid-cols-8 gap-2">
          {ICONS.map((x) => (
            <button key={x} type="button" aria-label={x} aria-pressed={icon === x} onClick={() => setIcon(x)} className={cn('grid h-11 place-items-center rounded-xl border-[1.5px]', icon === x ? 'border-primary bg-primary text-white' : 'border-line bg-card text-blue')}>
              <Icon name={x} size={20} />
            </button>
          ))}
        </div>
      </Field>
      <Field label={t('assigned')} icon="stethoscope">
        <DoctorChecks doctors={allDoctors} value={docs} onChange={setDocs} />
        <LocationPreview ids={docs} doctors={allDoctors} />
      </Field>
      <Field label={t('services')} icon="list-checks">
        <ServicesEditor value={svc} onChange={setSvc} />
      </Field>
    </Modal>
  );
}
