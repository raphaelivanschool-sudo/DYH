import { useState } from 'react';
import { toast } from 'sonner';
import { qk, useAnnouncements, useApiMutation, useSpecializations } from '@dyh/api';
import type { Announcement, SpecializationId } from '@dyh/core';
import { common, defineMessages, useLang, useLoc, useT } from '@dyh/i18n';
import { Button } from '@/components/ui/button';
import { Badge, Loading, Panel, StatusBadge } from '@/components/ui/display';
import { CheckRow, Field, Input, SearchBox, Segmented, Textarea } from '@/components/ui/form';
import { Modal } from '@/components/ui/dialog';
import { ListEmpty } from '@/components/ui/table';
import { usePerms } from '@/lib/admin';
import { Icon } from '@/lib/icon';
import { cn, matches, shortDate, shortSpec } from '@/lib/utils';

const m = defineMessages('admin.announce', {
  new: ['Bagong Anunsyo', 'New Announcement'],
  title: ['Pamagat', 'Title'],
  subtitle: ['Maikling linya', 'Subtitle'],
  desc: ['Paglalarawan', 'Description'],
  image: ['Larawan', 'Picture / Image'],
  upload: ['I-drag dito o pindutin para mag-upload', 'Drag here or click to upload'],
  start: ['Simula', 'Start Date'],
  end: ['Katapusan', 'End Date'],
  audience: ['Para Kanino', 'Target Audience'],
  allPatients: ['Lahat ng Pasyente', 'All Patients'],
  selected: ['Piling Klinika', 'Selected Clinics'],
  searchClinic: ['Hanapin ang klinika...', 'Search clinic...'],
  nSelected: ['{{n}} klinika ang napili', '{{n}} clinic(s) selected'],
  draft: ['I-save bilang Burador', 'Save Draft'],
  publish: ['I-publish', 'Publish'],
  preview: ['Preview', 'Preview'],
  chooseClinics: ['Pumili ng klinika', 'Choose clinics'],
  notTranslated: ['Hindi isinasalin ang nilalaman ng anunsyo.', 'Announcement content is not translated.'],
  active: ['Mga Anunsyo', 'Announcements'],
  search: ['Hanapin ang anunsyo...', 'Search announcements...'],
  confirmTitle: ['I-publish ang anunsyo?', 'Publish announcement?'],
  confirmAll: ['Makikita ito ng lahat ng pasyente mula {{from}} hanggang {{to}}.', 'It will be visible to all patients from {{from}} to {{to}}.'],
  confirmSome: ['Makikita ito ng mga pasyente ng {{n}} klinika mula {{from}} hanggang {{to}}.', 'It will be visible to patients of {{n}} clinic(s) from {{from}} to {{to}}.'],
  published: ['Na-publish ang anunsyo', 'Announcement published'],
  drafted: ['Na-save bilang burador', 'Saved as draft'],
  needTitle: ['Ilagay ang pamagat at petsa.', 'Enter a title and dates.'],
  needClinic: ['Pumili ng kahit isang klinika.', 'Choose at least one clinic.'],
  badDates: ['Dapat mas huli ang katapusan kaysa simula.', 'End date must be after the start date.'],
});

const COLORS: [string, string][] = [
  ['#1f56b0', '#17325f'],
  ['#0d7a86', '#0f4c5c'],
  ['#6a3db5', '#3b1f73'],
  ['#12805a', '#0b4f38'],
  ['#c42f3a', '#7a1a22'],
];

/** Same card the Patient App renders on Home. */
export function AnnouncementCard({ a }: { a: Pick<Announcement, 'icon' | 'colors' | 'title' | 'subtitle' | 'summary'> }) {
  return (
    <div className="relative overflow-hidden rounded-[20px] p-4 text-white" style={{ background: `linear-gradient(150deg, ${a.colors[0]}, ${a.colors[1]})` }}>
      <div className="wdeco" />
      <div className="relative flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-[14px] bg-white/18">
          <Icon name={a.icon} size={22} />
        </span>
        <div className="min-w-0">
          <b className="block text-[16px]">{a.title || '—'}</b>
          <span className="text-[12px] opacity-85">{a.subtitle}</span>
        </div>
      </div>
      <p className="relative mt-3 text-[13px] opacity-95">{a.summary}</p>
    </div>
  );
}

export default function Announce() {
  const t = useT(m);
  const tc = useT(common);
  const loc = useLoc();
  const [lang] = useLang();
  const { canDo } = usePerms();
  const { data: list } = useAnnouncements();
  const { data: specs = [] } = useSpecializations();
  const [title, setTitle] = useState('Libreng Flu Vaccine');
  const [subtitle, setSubtitle] = useState('Para sa Senior Citizens · Nob 3–14');
  const [summary, setSummary] = useState('Para sa Senior Citizens. Pumunta sa OPD Lobby, 8:00 AM – 3:00 PM. Magdala ng Senior Citizen ID.');
  const [from, setFrom] = useState('2026-11-03');
  const [to, setTo] = useState('2026-11-14');
  const [color, setColor] = useState(0);
  const [target, setTarget] = useState<'all' | 'clinic'>('all');
  const [clinics, setClinics] = useState<SpecializationId[]>([]);
  const [cq, setCq] = useState('');
  const [q, setQ] = useState('');
  const [confirm, setConfirm] = useState(false);
  const mut = useApiMutation((api, v: { a: Omit<Announcement, 'id' | 'status'>; draft?: boolean }) => api.publishAnnouncement(v.a, { draft: v.draft }), [qk.announcements]);
  if (!list) return <Loading />;

  const canCreate = canDo('announce', 'c');
  const specName = (id: string) => shortSpec(loc(specs.find((s) => s.id === id)?.name));
  const payload = (): Omit<Announcement, 'id' | 'status'> => ({ icon: 'megaphone', colors: COLORS[color], title, subtitle, summary, body: summary, from, to, audience: target === 'all' ? 'all' : { clinics } });
  const check = () => {
    if (!title.trim() || !from || !to) return toast.error(t('needTitle')), false;
    if (to < from) return toast.error(t('badDates')), false;
    if (target === 'clinic' && !clinics.length) return toast.error(t('needClinic')), false;
    return true;
  };
  const filtered = list.filter((x) => matches([x.title, x.subtitle], q));
  const shownSpecs = specs.filter((s) => matches([s.name.tl, s.name.en], cq));

  return (
    <div className="grid gap-3.5 lg:grid-cols-[1.3fr_1fr]">
      <Panel title={t('new')} icon="square-pen">
        <Field label={t('title')} icon="heading" className="mt-0">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canCreate} />
        </Field>
        <Field label={t('subtitle')} icon="text">
          <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} disabled={!canCreate} />
        </Field>
        <Field label={t('desc')} icon="align-left">
          <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} disabled={!canCreate} />
        </Field>
        <Field label={t('image')} icon="image">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-line bg-sky-2 p-5 text-[13px] text-muted">
            <Icon name="image-up" size={18} />
            {t('upload')}
            <input type="file" accept="image/*" className="hidden" />
          </label>
          <div className="mt-2 flex gap-2">
            {COLORS.map((c, i) => (
              <button key={c[0]} type="button" aria-label={`Color ${i + 1}`} onClick={() => setColor(i)} className={cn('size-8 rounded-full ring-offset-2 ring-offset-card', color === i && 'ring-2 ring-blue-2')} style={{ background: `linear-gradient(150deg, ${c[0]}, ${c[1]})` }} />
            ))}
          </div>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('start')} icon="calendar">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label={t('end')} icon="calendar-x">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <Field label={t('audience')} icon="target">
          <Segmented
            value={target}
            onChange={setTarget}
            options={[
              { value: 'all', label: t('allPatients'), icon: 'users' },
              { value: 'clinic', label: t('selected'), icon: 'building-2' },
            ]}
          />
          {target === 'clinic' && (
            <>
              <SearchBox className="mt-2" value={cq} onChange={setCq} placeholder={t('searchClinic')} />
              <div className="mt-2 grid max-h-[220px] gap-1.5 overflow-y-auto sm:grid-cols-2">
                {shownSpecs.map((s) => (
                  <CheckRow key={s.id} checked={clinics.includes(s.id)} onChange={(on) => setClinics(on ? [...clinics, s.id] : clinics.filter((x) => x !== s.id))}>
                    <Icon name={s.icon} size={16} className="text-blue" />
                    <b className="flex-1 text-[12.5px]">{shortSpec(loc(s.name))}</b>
                  </CheckRow>
                ))}
              </div>
              <ListEmpty show={!shownSpecs.length} />
              <div className="mt-2 text-[12.5px] text-muted">{t('nSelected', { n: clinics.length })}</div>
            </>
          )}
        </Field>
        {canCreate ? (
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="o"
              icon="save"
              disabled={mut.isPending}
              onClick={async () => {
                if (!check()) return;
                await mut.mutateAsync({ a: payload(), draft: true });
                toast.success(t('drafted'));
              }}
            >
              {t('draft')}
            </Button>
            <Button icon="send" onClick={() => check() && setConfirm(true)}>
              {t('publish')}
            </Button>
          </div>
        ) : (
          <div className="mt-4 flex justify-end">
            <Badge icon="eye">{tc('readOnly')}</Badge>
          </div>
        )}
      </Panel>

      <div className="flex flex-col gap-3.5">
        <Panel title={t('preview')} icon="eye" right={<Badge tone="blue" icon="smartphone">Patient App</Badge>}>
          <div className="mx-auto max-w-[340px]">
            <AnnouncementCard a={{ icon: 'megaphone', colors: COLORS[color], title, subtitle, summary }} />
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {target === 'all' ? <Badge icon="users">{t('allPatients')}</Badge> : clinics.length ? clinics.map((c) => <Badge key={c} tone="blue">{specName(c)}</Badge>) : <Badge tone="amber">{t('chooseClinics')}</Badge>}
          </div>
          <p className="mt-2 text-center text-[11.5px] text-muted">{t('notTranslated')}</p>
        </Panel>
        <Panel title={t('active')} icon="list">
          <SearchBox value={q} onChange={setQ} placeholder={t('search')} />
          <div className="mt-2">
            {filtered.map((x) => (
              <div key={x.id} className="flex items-center gap-2.5 border-b border-line py-2.5 last:border-0">
                <Icon name={x.icon} size={18} className="text-blue" />
                <div className="min-w-0 flex-1">
                  <b className="block truncate">{x.title}</b>
                  <div className="text-[12px] text-muted">
                    {x.audience === 'all' ? t('allPatients') : x.audience.clinics.map(specName).join(', ')} · {shortDate(x.from, lang)} – {shortDate(x.to, lang)}
                  </div>
                </div>
                <StatusBadge status={x.status === 'expired' ? 'done' : x.status} />
              </div>
            ))}
            <ListEmpty show={!filtered.length} />
          </div>
        </Panel>
      </div>

      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title={t('confirmTitle')}
        icon="send"
        actions={
          <>
            <Button variant="o" onClick={() => setConfirm(false)}>{tc('back')}</Button>
            <Button
              icon="send"
              disabled={mut.isPending}
              onClick={async () => {
                await mut.mutateAsync({ a: payload() });
                toast.success(t('published'));
                setConfirm(false);
              }}
            >
              {t('publish')}
            </Button>
          </>
        }
      >
        <p className="text-muted">{target === 'all' ? t('confirmAll', { from: shortDate(from, lang), to: shortDate(to, lang) }) : t('confirmSome', { n: clinics.length, from: shortDate(from, lang), to: shortDate(to, lang) })}</p>
        {target === 'clinic' && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {clinics.map((c) => (
              <Badge key={c} tone="blue">{specName(c)}</Badge>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
