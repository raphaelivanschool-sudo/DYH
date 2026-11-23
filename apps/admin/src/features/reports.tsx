import { useState } from 'react';
import { toast } from 'sonner';
import { qk, useApiQuery, useDoctors, useSpecializations } from '@dyh/api';
import { DIAGNOSES, MONTH_LONG, MONTH_SHORT, REPORT_SECTIONS, formatDate } from '@dyh/core';
import { common, defineMessages, useLang, useLoc, useT } from '@dyh/i18n';
import { MultiLine, StackBar } from '@/components/charts';
import { Button } from '@/components/ui/button';
import { Badge, Kpi, KpiGrid, Loading, Logo, Panel } from '@/components/ui/display';
import { CheckRow, DateInput, Field, FilterBar, FilterSelect, SearchBox, Segmented, filterOk, type Filters } from '@/components/ui/form';
import { Modal } from '@/components/ui/dialog';
import { Picker } from '@/components/ui/picker';
import { EmptyRow, Table, Td, Th } from '@/components/ui/table';
import { usePerms } from '@/lib/admin';
import { Icon } from '@/lib/icon';
import { matches, shortDate, shortSpec } from '@/lib/utils';
import { downloadCsv, useAm } from './shared';

const m = defineMessages('admin.reports', {
  filters: ['Mga Filter ng Ulat', 'Report Filters'],
  apptType: ['Uri ng Iskedyul', 'Appointment Type'],
  walkin: ['Personal (Walk-in)', 'Walk-in'],
  total: ['Kabuuang Pasyente', 'Total Patients'],
  served: ['Napagsilbihan', 'Patients Served'],
  noShows: ['Hindi Sumipot', 'No-shows'],
  generated: ['Mga Nagawang Ulat', 'Generated Reports'],
  search: ['Hanapin ang ulat...', 'Search reports...'],
  build: ['Gumawa ng Ulat', 'Build Report'],
  scope: ['Saklaw', 'Scope'],
  monthGen: ['Buwan ginawa', 'Month generated'],
  title: ['Pamagat', 'Title'],
  dataRange: ['Petsa ng Datos', 'Data Range'],
  genOn: ['Nagawa', 'Generated'],
  doctorsOwn: ['Ang mga doktor ay may sariling detalyadong ulat at download sa Doctor App; hindi na kailangang mag-request sa Admin.', 'Doctors have their own detailed reports with download in the Doctor App; they no longer need to request from the Admin.'],
  whole: ['Buong OPD', 'Whole OPD'],
  reportScope: ['Saklaw ng ulat', 'Report scope'],
  include: ['Isasama sa ulat', 'Include in report'],
  format: ['Format', 'Format'],
  preview: ['Preview ng Ulat', 'Report Preview'],
  reportOf: ['Ulat: {{name}}', 'Report: {{name}}'],
  wholeReport: ['Ulat ng Buong OPD', 'Whole OPD Report'],
  noSection: ['Walang napiling seksyon', 'No sections selected'],
  preparedBy: ['Ginawa ni {{name}} · {{date}}', 'Prepared by {{name}} · {{date}}'],
  downloaded: ['Na-download ang ulat', 'Report downloaded'],
  generatedToast: ['Na-update ang buod para sa napiling filter', 'Summary updated for the selected filters'],
});

export default function Reports() {
  const t = useT(m);
  const tc = useT(common);
  const a = useAm();
  const loc = useLoc();
  const [lang] = useLang();
  const { canDo } = usePerms();
  const { data: reports } = useApiQuery(qk.reports, (x) => x.getGeneratedReports());
  const { data: doctors = [] } = useDoctors();
  const { data: specs = [] } = useSpecializations();
  const [flt, setFlt] = useState({ clinic: 'all', doc: 'all', dx: 'all', type: 'all', from: '2026-10-01', to: '2026-10-31' });
  const [q, setQ] = useState('');
  const [f, setF] = useState<Filters>({});
  const [build, setBuild] = useState(false);
  if (!reports) return <Loading />;
  const all = { value: 'all', label: tc('all'), icon: 'layers' };
  const rows = reports.filter((r) => filterOk(f, 'sc', r.scope) && filterOk(f, 'mo', Number(r.generatedOn.slice(5, 7)) - 1) && matches([r.scope, loc(r.title)], q));
  const dl = (kind: 'pdf' | 'xls', title: string) => {
    if (kind === 'xls') downloadCsv(`${title}.csv`, [['Metric', 'Value'], ['Total patients', 5284], ['Online', 2166], ['Walk-in', 3118], ['Served', 5031], ['No-shows', 187]]);
    toast.success(t('downloaded'));
  };

  return (
    <>
      <Panel title={t('filters')} icon="filter">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Field label={tc('specialization')} icon="building-2" className="mt-0">
            <Picker value={flt.clinic} onChange={(clinic) => setFlt({ ...flt, clinic })} icon="building-2" options={[all, ...specs.map((s) => ({ value: s.id, label: loc(s.name), icon: s.icon }))]} />
          </Field>
          <Field label={tc('doctor')} icon="stethoscope" className="mt-0">
            <Picker value={flt.doc} onChange={(doc) => setFlt({ ...flt, doc })} icon="stethoscope" options={[all, ...doctors.map((d) => ({ value: d.id, label: d.name, icon: 'stethoscope' }))]} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <DateInput label={a('from')} value={flt.from} onChange={(from) => setFlt({ ...flt, from })} />
            <DateInput label={a('to')} value={flt.to} onChange={(to) => setFlt({ ...flt, to })} />
          </div>
          <Field label={tc('diagnosis')} icon="stethoscope" className="mt-0">
            <Picker value={flt.dx} onChange={(dx) => setFlt({ ...flt, dx })} icon="search" options={[all, ...DIAGNOSES.map((d) => ({ value: d.id, label: d.label, icon: 'stethoscope' }))]} />
          </Field>
          <Field label={t('apptType')} icon="tag" className="mt-0">
            <Picker value={flt.type} onChange={(type) => setFlt({ ...flt, type })} icon="tag" options={[all, { value: 'online', label: 'Online', icon: 'smartphone' }, { value: 'walkin', label: t('walkin'), icon: 'footprints' }]} />
          </Field>
          <div className="flex items-end gap-2">
            <Button variant="o" size="sm" icon="file-down" onClick={() => dl('pdf', 'dyh-report')}>PDF</Button>
            <Button variant="o" size="sm" icon="sheet" onClick={() => dl('xls', 'dyh-report')}>Excel</Button>
            <Button size="sm" icon="play" className="flex-1" onClick={() => toast.success(t('generatedToast'))}>
              {a('generate')}
            </Button>
          </div>
        </div>
      </Panel>
      <KpiGrid className="mt-4">
        <Kpi icon="users" label={t('total')} value="5,284" note={`${MONTH_LONG[lang][9]} 2026`} color="#2d6cdf" delta="10%" good />
        <Kpi icon="git-compare" label="Online / Walk-in" value="2,166 / 3,118" note="41% / 59%" color="#7c4ddb" />
        <Kpi icon="circle-check" label={t('served')} value="5,031" note="95.2%" color="#12805a" />
        <Kpi icon="user-x" label={t('noShows')} value="187" note="3.5%" color="#e04a55" delta="0.8 pt" good />
      </KpiGrid>
      <Panel
        flush
        className="mt-4"
        title={t('generated')}
        icon="history"
        right={
          <div className="flex flex-wrap gap-2">
            <SearchBox className="w-[280px] max-w-full" value={q} onChange={setQ} placeholder={t('search')} />
            {canDo('reports', 'c') && (
              <Button size="sm" icon="file-cog" onClick={() => setBuild(true)}>
                {t('build')}
              </Button>
            )}
          </div>
        }
      >
        <div className="px-[18px] pb-2.5">
          <FilterBar active={Object.values(f).some(Boolean)} onClear={() => setF({})}>
            <FilterSelect label={t('scope')} value={f.sc ?? ''} onChange={(v) => setF({ ...f, sc: v })} options={[...new Set(reports.map((r) => r.scope))].map((s) => ({ value: s, label: s }))} />
            <FilterSelect label={t('monthGen')} value={f.mo ?? ''} onChange={(v) => setF({ ...f, mo: v })} options={[...new Set(reports.map((r) => Number(r.generatedOn.slice(5, 7)) - 1))].map((x) => ({ value: String(x), label: MONTH_LONG[lang][x] }))} />
          </FilterBar>
        </div>
        <Table flat>
          <thead>
            <tr>
              <Th>{t('scope')}</Th>
              <Th>{t('title')}</Th>
              <Th>{t('dataRange')}</Th>
              <Th>{t('genOn')}</Th>
              <Th className="text-right">{tc('actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td nowrap>
                  <b>{r.scope}</b>
                </Td>
                <Td className="min-w-[220px]">{loc(r.title)}</Td>
                <Td nowrap>
                  {shortDate(r.from, lang)} – {shortDate(r.to, lang)}
                </Td>
                <Td nowrap>{shortDate(r.generatedOn, lang)}</Td>
                <Td>
                  <div className="flex justify-end gap-1.5">
                    <Button variant="o" size="sm" icon="file-down" title="PDF" aria-label="PDF" onClick={() => dl('pdf', r.id)} />
                    <Button variant="o" size="sm" icon="sheet" title="Excel" aria-label="Excel" onClick={() => dl('xls', r.id)} />
                  </div>
                </Td>
              </tr>
            ))}
            <EmptyRow cols={5} show={!rows.length} />
          </tbody>
        </Table>
        <div className="flex items-center gap-1 px-[18px] py-2.5 text-[11.5px] text-muted">
          <Icon name="info" size={13} />
          {t('doctorsOwn')}
        </div>
      </Panel>
      {build && <BuildReport onClose={() => setBuild(false)} />}
    </>
  );
}

function BuildReport({ onClose }: { onClose: () => void }) {
  const t = useT(m);
  const tc = useT(common);
  const a = useAm();
  const loc = useLoc();
  const [lang] = useLang();
  const { me } = usePerms();
  const { data: doctors = [] } = useDoctors();
  const { data: specs = [] } = useSpecializations();
  const [scope, setScope] = useState('all');
  const [from, setFrom] = useState('2026-05-01');
  const [to, setTo] = useState('2026-10-31');
  const [inc, setInc] = useState<Record<string, boolean>>({ tot: true, type: true, dx: true });
  const [fmt, setFmt] = useState<'pdf' | 'xls'>('pdf');
  const [preview, setPreview] = useState(false);
  const doc = doctors.find((d) => d.id === scope);
  const m0 = Number(from.slice(5, 7)) - 1;

  if (preview) {
    const sec = (title: string, body: React.ReactNode) => (
      <div className="rounded-xl border border-line p-3">
        <b>{title}</b>
        {body}
      </div>
    );
    const label = (id: string) => loc(REPORT_SECTIONS.find((s) => s.id === id)!.label);
    return (
      <Modal
        open
        onOpenChange={(v) => !v && onClose()}
        wide
        title={t('preview')}
        icon="eye"
        actions={
          <>
            <Button variant="o" icon="chevron-left" onClick={() => setPreview(false)}>{tc('back')}</Button>
            <Button
              icon="download"
              onClick={() => {
                if (fmt === 'xls') downloadCsv('dyh-report.csv', [['Section', 'Value'], ['Total patients', 1236], ['Online', 519], ['Walk-in', 717]]);
                toast.success(t('downloaded'));
                onClose();
              }}
            >
              {tc('download')}
            </Button>
          </>
        }
      >
        <div className="rounded-2xl border border-line bg-white p-5 text-[#14213d]">
          <div className="flex items-center justify-between">
            <Logo height={36} />
            <Badge>{fmt === 'pdf' ? 'PDF' : 'Excel'}</Badge>
          </div>
          <h3 className="mt-3 text-[18px]">{doc ? t('reportOf', { name: doc.name }) : t('wholeReport')}</h3>
          <div className="text-[12.5px] text-[#5b6b85]">
            {doc ? `${shortSpec(loc(specs.find((s) => s.id === doc.specializationId)?.name))} · ` : ''}
            {shortDate(from, lang)} – {shortDate(to, lang)}
          </div>
          <div className="mt-3 flex flex-col gap-2.5">
            {inc.tot &&
              sec(
                label('tot'),
                <div className="mt-2 flex items-center gap-4">
                  <div className="text-[28px] font-extrabold">1,236</div>
                  <div className="flex-1">
                    <MultiLine height={90} labels={Array.from({ length: 6 }, (_, i) => MONTH_SHORT[lang][(m0 + i) % 12])} series={[{ name: tc('patients'), color: '#2d6cdf', data: [198, 206, 214, 201, 207, 210] }]} domain={[150, 240]} />
                  </div>
                </div>,
              )}
            {inc.type &&
              sec(
                label('type'),
                <>
                  <div className="mt-2">
                    <StackBar parts={[{ value: 42, color: '#2d6cdf' }, { value: 58, color: '#9db9e9' }]} />
                  </div>
                  <div className="mt-1 flex justify-between text-[11.5px]">
                    <span>Online 519 (42%)</span>
                    <span>Walk-in 717 (58%)</span>
                  </div>
                </>,
              )}
            {inc.dx &&
              sec(
                label('dx'),
                ([['Hypertension', 212], ['Type 2 DM', 148], ['URTI', 121], ['Dyslipidemia', 66]] as const).map(([n, v]) => (
                  <div key={n} className="mt-1 flex justify-between text-[12.5px]">
                    <span>{n}</span>
                    <b>{v}</b>
                  </div>
                )),
              )}
            {inc.ns && sec(label('ns'), <div className="mt-1 text-[12.5px]">54 (4.4%)</div>)}
            {inc.fu && sec(label('fu'), <div className="mt-1 text-[12.5px]">78% (281 / 360)</div>)}
            {inc.demo && sec(label('demo'), <div className="mt-1 text-[12.5px]">60+: 31% · 40–59: 41% · {tc('female')} 57%</div>)}
            {inc.rx && sec(label('rx'), <div className="mt-1 text-[12.5px]">Amlodipine 5 mg (201), Metformin 500 mg (162)</div>)}
            {!Object.values(inc).some(Boolean) && <div className="py-6 text-center text-[12.5px] text-[#5b6b85]">{t('noSection')}</div>}
          </div>
          <div className="mt-3 text-[11px] text-[#5b6b85]">{t('preparedBy', { name: me?.name ?? '', date: formatDate('2026-10-30', lang, false) })}</div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={t('build')}
      icon="file-cog"
      actions={
        <>
          <Button variant="o" onClick={onClose}>{tc('cancel')}</Button>
          <Button icon="eye" onClick={() => setPreview(true)}>Preview</Button>
        </>
      }
    >
      <Field label={t('scope')} icon="stethoscope" className="mt-0">
        <Picker value={scope} onChange={setScope} icon="stethoscope" placeholder={t('whole')} searchPlaceholder={t('reportScope')} options={[{ value: 'all', label: t('whole'), icon: 'building-2' }, ...doctors.map((d) => ({ value: d.id, label: d.name, sub: shortSpec(loc(specs.find((s) => s.id === d.specializationId)?.name)), icon: 'stethoscope' }))]} />
      </Field>
      <Field label={a('dateRange')} icon="calendar-range">
        <div className="grid grid-cols-2 gap-2">
          <DateInput label={a('from')} value={from} onChange={setFrom} />
          <DateInput label={a('to')} value={to} onChange={setTo} />
        </div>
      </Field>
      <Field label={t('include')} icon="list-checks">
        <div className="flex flex-col gap-1.5">
          {REPORT_SECTIONS.map((s) => (
            <CheckRow key={s.id} checked={!!inc[s.id]} onChange={(v) => setInc({ ...inc, [s.id]: v })}>
              <Icon name={s.icon} size={16} className="text-blue" />
              <b className="flex-1 text-[13px]">{loc(s.label)}</b>
            </CheckRow>
          ))}
        </div>
      </Field>
      <Field label={t('format')} icon="file">
        <Segmented className="w-[220px]" value={fmt} onChange={setFmt} options={[{ value: 'pdf', label: 'PDF' }, { value: 'xls', label: 'Excel' }]} />
      </Field>
    </Modal>
  );
}
