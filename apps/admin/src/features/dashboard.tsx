import { useMemo, useState } from 'react';
import { useApi, useDoctors, useLiveStatus, useSpecializations } from '@dyh/api';
import { DASHBOARD_STATS, DAY_LONG, MONTH_SHORT, formatDate, sortDoctorsForToday } from '@dyh/core';
import { common, defineMessages, useLang, useLoc, useT } from '@dyh/i18n';
import { Donut, ForecastChart, GroupedBars, HBars, Legend } from '@/components/charts';
import { Button } from '@/components/ui/button';
import { Avatar, Badge, Delta, Kpi, KpiGrid, Loading, Panel } from '@/components/ui/display';
import { SearchBox } from '@/components/ui/form';
import { EmptyRow, Table, Td, Th } from '@/components/ui/table';
import { Icon } from '@/lib/icon';
import { matches, shortSpec } from '@/lib/utils';
import { downloadCsv, useAm } from './shared';

const m = defineMessages('admin.dashboard', {
  totalWaiting: ['Kabuuang Naghihintay', 'Total Waiting'],
  acrossClinics: ['sa {{n}} na klinika', 'across {{n}} clinics'],
  servedToday: ['Napagsilbihan Ngayon', 'Served Today'],
  avgWait: ['Karaniwang Paghihintay', 'Average Wait'],
  noShows: ['Hindi Sumipot', 'No-shows'],
  onlineToday: ['online ngayon', 'online today'],
  onDuty: ['Doktor na Naka-duty', 'Doctors on Duty'],
  todayL: ['ngayong araw', 'today'],
  satisfaction: ['Kasiyahan', 'Satisfaction'],
  thisWeekL: ['ngayong linggo', 'this week'],
  fuReturn: ['Bumalik sa Follow-up', 'Follow-up Return'],
  thisMonthL: ['ngayong buwan', 'this month'],
  perHour: ['Pasyente bawat Oras', 'Patients per Hour'],
  trend: ['Trend ng Pasyente at Hula (araw ng OPD)', 'Patient Trend & Forecast (OPD days)'],
  pred1: ['Bukas (Sab): ~128 pasyente', 'Tomorrow (Sat): ~128 patients'],
  pred1s: ['± 12 · mas kaunting clinic tuwing Sabado', '± 12 · fewer clinics on Saturdays'],
  pred2: ['Nob 1–2: sarado (Undas)', 'Nov 1–2: closed (Undas)'],
  pred2s: ['Inaasahang dagsa sa Nob 3: ~270', 'Expected surge on Nov 3: ~270'],
  pred3: ['Pinaka-abala: 9–10 AM', 'Peak: 9–10 AM'],
  pred3s: ['Panloob na Medisina at Pediatriya', 'Internal Medicine and Pediatrics'],
  perSpec: ['Pasyente bawat Espesyalisasyon', 'Patients per Specialization'],
  weekVs: ['Ngayong Linggo vs Nakaraang Linggo', 'This Week vs Last Week'],
  metric: ['Sukatan', 'Metric'],
  thisWk: ['Ngayon', 'This wk'],
  lastWk: ['Nakaraan', 'Last wk'],
  change: ['Pagbabago', 'Change'],
  perDoctor: ['Pasyente bawat Doktor', 'Patients per Doctor'],
  doneToday: ['Tapos na', 'Closed'],
});

const hourLabel = (h: string) => `${h}${+h >= 7 && +h < 12 ? 'AM' : +h === 12 ? 'NN' : 'PM'}`;

export default function Dashboard() {
  const t = useT(m);
  const tc = useT(common);
  const a = useAm();
  const loc = useLoc();
  const [lang] = useLang();
  const api = useApi();
  const { today, hour } = api.clock();
  const { data: doctors } = useDoctors();
  const { data: live } = useLiveStatus();
  const { data: specs } = useSpecializations();
  const [q, setQ] = useState('');
  const S = DASHBOARD_STATS;

  const liveBy = useMemo(() => new Map((live ?? []).map((l) => [l.doctorId, l])), [live]);
  const perSpec = useMemo(() => {
    if (!doctors || !specs) return [];
    return specs
      .map((s) => ({ label: shortSpec(loc(s.name)), value: doctors.filter((d) => d.specializationId === s.id).reduce((n, d) => n + (liveBy.get(d.id)?.openToday ? (liveBy.get(d.id)?.servedToday ?? 0) : 0), 0) }))
      .filter((x) => x.value)
      .sort((x, y) => y.value - x.value)
      .slice(0, 8);
  }, [doctors, specs, liveBy, loc]);

  if (!doctors || !live || !specs) return <Loading />;
  const onDuty = live.filter((l) => l.openToday).length;
  const trendLabels = S.trend.labels.map((x, i) => (i === 0 ? `${MONTH_SHORT[lang][9]} 19` : i === 12 ? `${MONTH_SHORT[lang][10]} 3` : x));
  const spec = (id: string) => shortSpec(loc(specs.find((s) => s.id === id)?.name));
  const rows = sortDoctorsForToday(doctors, today, hour).filter((d) => matches([d.name, spec(d.specializationId), d.room], q));

  const exportCsv = () =>
    downloadCsv(`dyh-dashboard-${today}.csv`, [
      ['Doctor', 'Clinic', 'Now serving', 'Waiting', 'Served', 'Avg wait (min)'],
      ...rows.map((d) => {
        const l = liveBy.get(d.id);
        return [d.name, spec(d.specializationId), l?.nowServing ?? '', l?.waiting ?? 0, l?.servedToday ?? 0, l?.avgWaitMinutes ?? ''];
      }),
    ]);

  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tone="green" icon="radio">Live</Badge>
          <span className="text-[12.5px] text-muted">
            {DAY_LONG[lang][5]}, {formatDate(today, lang)} · {a('updated')} {S.updatedAt}
          </span>
        </div>
        <Button variant="o" size="sm" icon="download" onClick={exportCsv}>
          {a('exportBtn')}
        </Button>
      </div>

      <KpiGrid>
        <Kpi icon="users" label={t('totalWaiting')} value={S.kpis.totalWaiting.value} note={t('acrossClinics', { n: S.kpis.totalWaiting.clinics })} color="#2d6cdf" delta={`+${S.kpis.totalWaiting.delta}`} good={false} />
        <Kpi icon="circle-check" label={t('servedToday')} value={S.kpis.servedToday.value} note={a('vsYesterday')} color="#12805a" delta={`${S.kpis.servedToday.deltaPct}%`} good />
        <Kpi icon="timer" label={t('avgWait')} value={`${S.kpis.avgWaitMin.value} min`} note={a('vsYesterday')} color="#d68a00" delta="4 min" good />
        <Kpi icon="user-x" label={t('noShows')} value={S.kpis.noShows.value} note={a('vsYesterday')} color="#e04a55" delta={String(S.kpis.noShows.delta)} good={false} />
        <Kpi icon="smartphone" label="Online / Walk-in" value={`${S.kpis.onlineShare.online}% / ${S.kpis.onlineShare.walkin}%`} note={t('onlineToday')} color="#7c4ddb" delta={`${S.kpis.onlineShare.deltaPt} pt`} good />
        <Kpi icon="stethoscope" label={t('onDuty')} value={`${onDuty} / ${doctors.length}`} note={t('todayL')} color="#0d7a86" />
        <Kpi icon="star" label={t('satisfaction')} value={`${S.kpis.satisfaction.value} / 5`} note={t('thisWeekL')} color="#f5a524" delta={String(S.kpis.satisfaction.delta)} good />
        <Kpi icon="repeat" label={t('fuReturn')} value={`${S.kpis.followUpReturn.value}%`} note={t('thisMonthL')} color="#12a07a" delta={`${S.kpis.followUpReturn.deltaPt} pt`} good />
      </KpiGrid>

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-[1.3fr_1fr]">
        <Panel title={t('perHour')} icon="chart-column" right={<Legend items={[{ label: tc('today'), color: '#2d6cdf' }, { label: a('yesterday'), color: '#b8cdf3' }]} />}>
          <GroupedBars
            data={S.perHour.labels.map((h, i) => ({ label: hourLabel(h), today: S.perHour.today[i], yesterday: S.perHour.yesterday[i] }))}
            series={[
              { key: 'today', name: tc('today'), color: '#2d6cdf' },
              { key: 'yesterday', name: a('yesterday'), color: '#b8cdf3' },
            ]}
          />
        </Panel>
        <Panel title="Online vs Walk-in" icon="chart-pie">
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-5">
            <Donut
              segments={[
                { name: 'Online', value: S.onlineVsWalkin.online, color: '#2d6cdf' },
                { name: tc('walkin'), value: S.onlineVsWalkin.walkin, color: '#9db9e9' },
              ]}
              center={
                <>
                  <b className="text-[22px]">{S.onlineVsWalkin.total}</b>
                  <span className="text-[11px] text-muted">{a('total')}</span>
                </>
              }
            />
            <div className="flex flex-col gap-2 text-[13px]">
              <LegendRow color="#2d6cdf" label="Online" value={`${S.onlineVsWalkin.online} (41%)`} />
              <LegendRow color="#9db9e9" label={tc('walkin')} value={`${S.onlineVsWalkin.walkin} (59%)`} />
              <LegendRow color="#f08a3c" label="Priority" value={String(S.onlineVsWalkin.priority)} />
            </div>
          </div>
        </Panel>
      </div>

      <Panel className="mt-3.5" title={t('trend')} icon="trending-up" right={<Legend items={[{ label: a('actual'), color: '#2d6cdf' }, { label: a('aiForecast'), color: '#7c4ddb', dashed: true }]} />}>
        <ForecastChart labels={trendLabels} actual={S.trend.actual} forecast={S.trend.forecast} band={14} splitIndex={10} domain={[80, 300]} names={[a('actual'), a('aiForecast')]} />
        <div className="mt-3 grid gap-2.5 md:grid-cols-3">
          <Pred icon="calendar-clock" title={t('pred1')} sub={t('pred1s')} />
          <Pred icon="calendar-x" title={t('pred2')} sub={t('pred2s')} />
          <Pred icon="flame" title={t('pred3')} sub={t('pred3s')} />
        </div>
      </Panel>

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-[1.3fr_1fr]">
        <Panel title={t('perSpec')} icon="building-2" right={<span className="text-[12px] text-muted">{tc('today')}</span>}>
          <HBars rows={perSpec} />
        </Panel>
        <Panel title={t('weekVs')} icon="git-compare">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[.05em] text-muted">
                <th className="pb-2">{t('metric')}</th>
                <th className="pb-2">{t('thisWk')}</th>
                <th className="pb-2">{t('lastWk')}</th>
                <th className="pb-2">{t('change')}</th>
              </tr>
            </thead>
            <tbody>
              {S.weekCompare.map((r) => (
                <tr key={r.metric.en} className="border-t border-line">
                  <td className="py-2">{loc(r.metric)}</td>
                  <td className="py-2 font-bold">{r.now}</td>
                  <td className="py-2 text-muted">{r.last}</td>
                  <td className="py-2">
                    <Delta value={r.change} good={r.good} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel flush className="mt-3.5" title={t('perDoctor')} icon="stethoscope" right={<SearchBox className="w-[300px] max-w-full" value={q} onChange={setQ} placeholder={a('searchDoctor')} />}>
        <Table flat className="mt-2.5">
          <thead>
            <tr>
              <Th>{tc('doctor')}</Th>
              <Th>{tc('clinic')}</Th>
              <Th>{tc('nowServing')}</Th>
              <Th num>{tc('waiting')}</Th>
              <Th num>{a('served')}</Th>
              <Th num>{a('avgWait')}</Th>
              <Th>{tc('status')}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const l = liveBy.get(d.id);
              const open = !!l?.openToday;
              return (
                <tr key={d.id}>
                  <Td nowrap>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={d.name} light />
                      <b>{d.name}</b>
                    </div>
                  </Td>
                  <Td nowrap>{spec(d.specializationId)}</Td>
                  <Td>{open && l?.nowServing ? <span className="rounded-lg bg-sky px-2 py-1 text-[12px] font-extrabold text-blue">{l.nowServing}</span> : <span className="text-muted">—</span>}</Td>
                  <Td num>{l?.waiting ?? 0}</Td>
                  <Td num>{open ? l?.servedToday : 0}</Td>
                  <Td num>{open && l?.avgWaitMinutes ? `${l.avgWaitMinutes} min` : '—'}</Td>
                  <Td>
                    {open ? (
                      <Badge tone="green" icon="door-open">{a('open')}</Badge>
                    ) : d.clinicDays.includes(5) ? (
                      <Badge tone="amber">{t('doneToday')}</Badge>
                    ) : (
                      <Badge>{a('noClinic')}</Badge>
                    )}
                  </Td>
                </tr>
              );
            })}
            <EmptyRow cols={7} show={!rows.length} />
          </tbody>
        </Table>
      </Panel>
    </>
  );
}

const LegendRow = ({ color, label, value }: { color: string; label: string; value: string }) => (
  <span className="inline-flex items-center gap-2">
    <i className="block size-2.5 rounded-[3px]" style={{ background: color }} />
    {label} <b>{value}</b>
  </span>
);

export function Pred({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[14px] border border-line bg-sky-2 p-3">
      <Icon name={icon} size={20} className="mt-0.5 text-purple" />
      <div>
        <b className="text-[13px]">{title}</b>
        <div className="text-[11.5px] text-muted">{sub}</div>
      </div>
    </div>
  );
}
