import { useState } from 'react';
import { qk, useApiQuery, useDoctors, useSpecializations } from '@dyh/api';
import { BLOOD_TYPES } from '@dyh/core';
import { common, defineMessages, useLang, useLoc, useT } from '@dyh/i18n';
import { Button } from '@/components/ui/button';
import { Alert, Badge, CredBadges, Empty, Loading, StatusBadge } from '@/components/ui/display';
import { FilterBar, FilterSelect, SearchBox, Segmented, filterOk, type Filters } from '@/components/ui/form';
import { EmptyRow, Table, Td, Th } from '@/components/ui/table';
import { MODULES, roleMsgs, useAdmins, usePerms, useSecretaries } from '@/lib/admin';
import { matches, scheduleLabel, shortSpec } from '@/lib/utils';
import { DAY_LONG } from '@dyh/core';
import { downloadCsv, secretariesOf, useAm, useStatusOptions } from './shared';

const m = defineMessages('admin.master', {
  superOnly: ['Super Admin lamang', 'Super Admin only'],
  superOnlyBody: ['Ang patient masterlist ay para lamang sa Super Admin (hindi ito maibibigay sa Admin).', 'The patient masterlist is for the Super Admin only (cannot be granted to Admins).'],
  demoOnly: ['Demograpikong impormasyon lamang ang makikita. Hindi kasama ang natuklasan at detalyeng medikal.', 'Only demographic information is shown. Consultation findings and medical details are excluded.'],
  search: ['Hanapin ang pangalan, ID, numero o lungsod...', 'Search name, ID, number or city...'],
  showing: ['Ipinapakita ang 1–{{n}} sa 12,408', 'Showing 1–{{n}} of 12,408'],
  clinicDay: ['Araw ng clinic', 'Clinic day'],
  doctorAccount: ['Doctor account', 'Doctor account'],
  all: ['Lahat', 'All'],
  nModules: ['{{n}} modyul', '{{n}} modules'],
});

type Tab = 'pt' | 'dr' | 'sec' | 'adm';

export default function Master() {
  const t = useT(m);
  const tc = useT(common);
  const tr = useT(roleMsgs);
  const a = useAm();
  const loc = useLoc();
  const [lang] = useLang();
  const statusOpts = useStatusOptions();
  const { isSuper } = usePerms();
  const [tab, setTab] = useState<Tab>('pt');
  const [q, setQ] = useState('');
  const [f, setF] = useState<Filters>({});
  const { data: patients } = useApiQuery(qk.masterPatients, (x) => x.getMasterPatients(), { enabled: isSuper });
  const { data: doctors } = useDoctors();
  const { data: specs = [] } = useSpecializations();
  const { data: secs } = useSecretaries();
  const { data: admins } = useAdmins();
  if (!doctors || !secs || !admins) return <Loading />;
  const set = (k: string) => (v: string) => setF({ ...f, [k]: v });
  const spec = (id: string) => shortSpec(loc(specs.find((s) => s.id === id)?.name));
  const docName = (id: string) => doctors.find((d) => d.id === id)?.name ?? id;
  const fmtBday = (d: string) => `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(0, 4)}`;
  const cities = [...new Set((patients ?? []).map((p) => p.city).filter(Boolean) as string[])];

  const pts = (patients ?? []).filter((p) => filterOk(f, 'sx', p.sex) && filterOk(f, 'bl', p.bloodType) && filterOk(f, 'ct', p.city) && matches([p.id, p.displayName, p.mobile, p.city], q));
  const drs = doctors.filter((d) => filterOk(f, 'sp', d.specializationId) && (!f.dy || d.clinicDays.includes(+f.dy)) && matches([d.name, spec(d.specializationId), d.room], q));
  const ss = secs.filter((s) => filterOk(f, 'st', s.status) && (!f.sd || s.doctorIds.includes(f.sd)) && matches([s.name, s.email, s.mobile], q));
  const ads = admins.filter((x) => filterOk(f, 'rl', x.role) && filterOk(f, 'ad', x.doctorId ? 'y' : 'n') && matches([x.name, x.email], q));

  const exportCsv = () => {
    if (tab === 'pt') downloadCsv('dyh-patients.csv', [['Patient ID', 'Name', 'Birthday', 'Sex', 'Blood', 'Mobile', 'City'], ...pts.map((p) => [p.id, p.displayName, p.birthday, p.sex, p.bloodType, p.mobile, p.city ?? ''])]);
    if (tab === 'dr') downloadCsv('dyh-doctors.csv', [['Doctor', 'Specialization', 'Room', 'Schedule'], ...drs.map((d) => [d.name, spec(d.specializationId), d.room, scheduleLabel(d, lang)])]);
    if (tab === 'sec') downloadCsv('dyh-secretaries.csv', [['Secretary', 'Email', 'Mobile', 'Doctors', 'Status'], ...ss.map((s) => [s.name, s.email, s.mobile, s.doctorIds.map(docName).join('; '), s.status])]);
    if (tab === 'adm') downloadCsv('dyh-admins.csv', [['Admin', 'Email', 'Mobile', 'Role'], ...ads.map((x) => [x.name, x.email, x.mobile, x.role])]);
  };
  const locked = tab === 'pt' && !isSuper;

  return (
    <>
      <Segmented
        className="w-[620px] max-w-full"
        value={tab}
        onChange={(v) => {
          setTab(v);
          setF({});
          setQ('');
        }}
        options={[
          { value: 'pt', label: tc('patients'), icon: 'users' },
          { value: 'dr', label: tc('doctors'), icon: 'stethoscope' },
          { value: 'sec', label: a('secretaries'), icon: 'clipboard-list' },
          { value: 'adm', label: a('admins'), icon: 'shield' },
        ]}
      />
      {!locked && (
        <FilterBar active={Object.values(f).some(Boolean)} onClear={() => setF({})}>
          {tab === 'pt' && (
            <>
              <FilterSelect label={tc('sex')} value={f.sx ?? ''} onChange={set('sx')} options={[{ value: 'M', label: tc('male') }, { value: 'F', label: tc('female') }]} />
              <FilterSelect label={a('blood')} value={f.bl ?? ''} onChange={set('bl')} options={BLOOD_TYPES.filter((b) => b.id !== 'unknown').map((b) => ({ value: b.id, label: b.label }))} />
              <FilterSelect label={tc('city')} value={f.ct ?? ''} onChange={set('ct')} options={cities.map((c) => ({ value: c, label: c }))} />
            </>
          )}
          {tab === 'dr' && (
            <>
              <FilterSelect label={tc('specialization')} value={f.sp ?? ''} onChange={set('sp')} options={specs.map((s) => ({ value: s.id, label: shortSpec(loc(s.name)) }))} />
              <FilterSelect label={t('clinicDay')} value={f.dy ?? ''} onChange={set('dy')} options={[1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: String(d), label: DAY_LONG[lang][d] }))} />
            </>
          )}
          {tab === 'sec' && (
            <>
              <FilterSelect label={tc('doctor')} value={f.sd ?? ''} onChange={set('sd')} options={doctors.map((d) => ({ value: d.id, label: d.name }))} />
              <FilterSelect label={tc('status')} value={f.st ?? ''} onChange={set('st')} options={statusOpts} />
            </>
          )}
          {tab === 'adm' && (
            <>
              <FilterSelect label={a('role')} value={f.rl ?? ''} onChange={set('rl')} options={[{ value: 'super', label: tr('super') }, { value: 'admin', label: tr('admin') }]} />
              <FilterSelect label={a('alsoDoctor')} value={f.ad ?? ''} onChange={set('ad')} options={[{ value: 'y', label: a('yes') }, { value: 'n', label: a('no') }]} />
            </>
          )}
        </FilterBar>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <SearchBox className="w-[340px] max-w-full" value={q} onChange={setQ} placeholder={t('search')} />
        {!locked && (
          <Button variant="o" size="sm" icon="download" onClick={exportCsv}>
            {a('exportBtn')}
          </Button>
        )}
      </div>
      {tab === 'pt' && !locked && (
        <Alert icon="shield" className="mt-3">
          {t('demoOnly')}
        </Alert>
      )}

      {locked ? (
        <div className="mt-3 rounded-[14px] border border-line bg-card">
          <Empty icon="lock" title={t('superOnly')}>
            {t('superOnlyBody')}
          </Empty>
        </div>
      ) : (
        <Table className="mt-3">
          {tab === 'pt' && (
            <>
              <thead>
                <tr>
                  <Th>{tc('patientId')}</Th>
                  <Th>{tc('fullName')}</Th>
                  <Th>{tc('birthday')}</Th>
                  <Th>{tc('sex')}</Th>
                  <Th>{a('blood')}</Th>
                  <Th>{a('contact')}</Th>
                  <Th>{tc('address')}</Th>
                </tr>
              </thead>
              <tbody>
                {pts.map((p) => (
                  <tr key={p.id}>
                    <Td nowrap>
                      <b className="text-blue">{p.id}</b>
                    </Td>
                    <Td nowrap>
                      <b>{p.displayName}</b>
                    </Td>
                    <Td>{fmtBday(p.birthday)}</Td>
                    <Td>{p.sex === 'M' ? tc('male') : tc('female')}</Td>
                    <Td>{p.bloodType}</Td>
                    <Td nowrap>{p.mobile}</Td>
                    <Td nowrap>{p.city}</Td>
                  </tr>
                ))}
                <EmptyRow cols={7} show={!!patients && !pts.length} />
              </tbody>
            </>
          )}
          {tab === 'dr' && (
            <>
              <thead>
                <tr>
                  <Th>{tc('doctor')}</Th>
                  <Th>{tc('specialization')}</Th>
                  <Th>{tc('room')}</Th>
                  <Th>{a('schedule')}</Th>
                  <Th>{a('secretary')}</Th>
                </tr>
              </thead>
              <tbody>
                {drs.map((d) => (
                  <tr key={d.id}>
                    <Td nowrap>
                      <b>{d.name}</b>
                      <CredBadges creds={d.credentials} />
                    </Td>
                    <Td>{spec(d.specializationId)}</Td>
                    <Td nowrap>{d.room}</Td>
                    <Td nowrap>{scheduleLabel(d, lang)}</Td>
                    <Td>{secretariesOf(d.id, secs).map((s) => s.name).join(', ') || <span className="text-muted">—</span>}</Td>
                  </tr>
                ))}
                <EmptyRow cols={5} show={!drs.length} />
              </tbody>
            </>
          )}
          {tab === 'sec' && (
            <>
              <thead>
                <tr>
                  <Th>{a('secretary')}</Th>
                  <Th>Email</Th>
                  <Th>{a('contact')}</Th>
                  <Th>{tc('doctors')}</Th>
                  <Th>{tc('status')}</Th>
                </tr>
              </thead>
              <tbody>
                {ss.map((s) => (
                  <tr key={s.id}>
                    <Td nowrap>
                      <b>{s.name}</b>
                    </Td>
                    <Td>{s.email}</Td>
                    <Td nowrap>{s.mobile}</Td>
                    <Td>{s.doctorIds.map(docName).join(', ')}</Td>
                    <Td>
                      <StatusBadge status={s.status} />
                    </Td>
                  </tr>
                ))}
                <EmptyRow cols={5} show={!ss.length} />
              </tbody>
            </>
          )}
          {tab === 'adm' && (
            <>
              <thead>
                <tr>
                  <Th>Admin</Th>
                  <Th>Email</Th>
                  <Th>{a('contact')}</Th>
                  <Th>{a('role')}</Th>
                  <Th>Access</Th>
                  <Th>{t('doctorAccount')}</Th>
                  <Th>{tc('status')}</Th>
                </tr>
              </thead>
              <tbody>
                {ads.map((x) => {
                  const keys = Object.keys(x.permissions);
                  const names = keys.map((k) => loc(MODULES.find((mm) => mm.id === k)!.label));
                  return (
                    <tr key={x.id}>
                      <Td nowrap>
                        <b>{x.name}</b>
                      </Td>
                      <Td>{x.email}</Td>
                      <Td nowrap>{x.mobile}</Td>
                      <Td>
                        <Badge tone={x.role === 'super' ? 'purple' : 'blue'} icon={x.role === 'super' ? 'crown' : 'shield'}>
                          {tr(x.role)}
                        </Badge>
                      </Td>
                      <Td nowrap className="text-[12.5px]" title={names.join(', ')}>
                        {x.role === 'super' ? (
                          t('all')
                        ) : (
                          <>
                            <b>{t('nModules', { n: keys.length })}</b>
                            <div className="text-[11px] text-muted">
                              {names.slice(0, 2).join(', ')}
                              {keys.length > 2 ? ` +${keys.length - 2}` : ''}
                            </div>
                          </>
                        )}
                      </Td>
                      <Td>{x.doctorId ? <Badge tone="teal" icon="stethoscope">{docName(x.doctorId)}</Badge> : <span className="text-muted">—</span>}</Td>
                      <Td>
                        <StatusBadge status={x.status} />
                      </Td>
                    </tr>
                  );
                })}
                <EmptyRow cols={7} show={!ads.length} />
              </tbody>
            </>
          )}
        </Table>
      )}
      {tab === 'pt' && isSuper && (
        <div className="mt-3 flex items-center justify-between text-[12.5px] text-muted">
          <span>{t('showing', { n: pts.length })}</span>
          <div className="flex gap-2">
            <Button variant="o" size="sm" icon="chevron-left" aria-label="Previous" />
            <Button variant="o" size="sm" icon="chevron-right" aria-label="Next" />
          </div>
        </div>
      )}
    </>
  );
}
