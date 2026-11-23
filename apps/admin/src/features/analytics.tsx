import { useState } from 'react';
import { ANALYTICS, DAY_SHORT, MONTH_SHORT } from '@dyh/core';
import { defineMessages, useLang, useLoc, useT } from '@dyh/i18n';
import { ForecastChart, GroupedBars, Heatmap, Legend, MultiLine } from '@/components/charts';
import { Button } from '@/components/ui/button';
import { Avatar, Badge, Empty, Kpi, KpiGrid, Panel, Rich, Spinner } from '@/components/ui/display';
import { Icon } from '@/lib/icon';
import { Pred } from './dashboard';
import { RangePicker, rangeOf, type DateRange } from './RangePicker';
import { useAm } from './shared';

const m = defineMessages('admin.analytics', {
  generate: ['Gumawa ng AI Analytics', 'Generate AI Analytics'],
  analyzing: ['Sinusuri ang de-identified na data...', 'Analyzing de-identified data...'],
  choose: ['Pumili ng saklaw ng petsa sa itaas, saka pindutin ang "Gumawa ng AI Analytics".', 'Choose a date range above, then press "Generate AI Analytics".'],
  summary: ['Buod ng AI', 'AI Executive Summary'],
  generatedAt: ['Ginawa {{t}}', 'Generated {{t}}'],
  totalPatients: ['Kabuuang Pasyente', 'Total Patients'],
  noShowRate: ['Hindi Sumipot', 'No-show Rate'],
  avgWait: ['Karaniwang Paghihintay', 'Average Wait'],
  fuReturn: ['Bumalik sa Follow-up', 'Follow-up Return'],
  weekly: ['Lingguhang Dami at Hula', 'Weekly Volume & Forecast'],
  forecastBand: ['Hula (±4%)', 'Forecast (±4%)'],
  busiest: ['Pinaka-abalang Araw at Oras', 'Busiest Days & Hours'],
  darker: ['Mas madilim = mas maraming pasyente', 'Darker = more patients'],
  noShowPattern: ['Pattern ng Hindi Pagsipot', 'No-show Patterns'],
  ahead: ['5–7 araw bago: 7.9%', 'Booked 5–7 days ahead: 7.9%'],
  ahead2: ['1–2 araw bago: 2.1%', '1–2 days ahead: 2.1%'],
  seasonal: ['Diyagnosis ayon sa Panahon', 'Seasonal Diagnoses'],
  demand: ['Demand vs Kapasidad', 'Demand vs Capacity'],
  demandL: ['Demand', 'Demand'],
  capacityL: ['Kapasidad', 'Capacity'],
  demandNote: ['Lumampas ang demand sa kapasidad sa IM (+11%) at Pediatriya (+22%).', 'Demand exceeds capacity in IM (+11%) and Pediatrics (+22%).'],
  recs: ['Mga Rekomendasyon ng AI', 'AI Recommendations'],
});

const HEAT_SHAPE = [0.3, 0.75, 1, 0.92, 0.68, 0.3, 0.55, 0.7, 0.45, 0.22];
const dayWeight = (d: number) => (d === 1 || d === 5 ? 1.25 : d === 6 ? 0.55 : 1);

export default function Analytics() {
  const t = useT(m);
  const a = useAm();
  const loc = useLoc();
  const [lang] = useLang();
  const [range, setRange] = useState<DateRange>(rangeOf('month'));
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const A = ANALYTICS;

  const run = () => {
    setState('loading');
    // Replace with api.generateAnalytics(range) once the AI endpoint exists.
    setTimeout(() => setState('done'), 1200);
  };

  const top = (
    <>
      <RangePicker
        value={range}
        onChange={(r) => {
          setRange(r);
          setState('idle');
        }}
        action={
          <Button icon="sparkles" onClick={run} disabled={state === 'loading'}>
            {t('generate')}
          </Button>
        }
      />
      <div className="mt-2 flex items-center gap-1.5 text-[12.5px] text-muted">
        <Icon name="shield-check" size={15} />
        {a('deidentified')}
      </div>
    </>
  );

  if (state === 'loading')
    return (
      <>
        {top}
        <Panel className="mt-3.5 flex flex-col items-center py-16">
          <Spinner className="size-8" />
          <h3 className="mt-3">{t('analyzing')}</h3>
        </Panel>
      </>
    );
  if (state === 'idle')
    return (
      <>
        {top}
        <Panel className="mt-3.5">
          <Empty icon="sparkles" title="AI Analytics">
            {t('choose')}
          </Empty>
        </Panel>
      </>
    );

  const rec = { high: 'red', medium: 'amber', low: 'blue' } as const;
  return (
    <>
      {top}
      <Panel className="aisum mt-3.5 border" title={t('summary')} icon="sparkles" right={<Badge tone="blue">{t('generatedAt', { t: '10:30 AM' })}</Badge>}>
        <p className="leading-[1.7]">
          <Rich text={loc(A.summary)} />
        </p>
      </Panel>
      <KpiGrid className="mt-3.5">
        <Kpi icon="users" label={t('totalPatients')} value="5,284" note={a('vsPrevious')} color="#2d6cdf" delta="10.2%" good />
        <Kpi icon="user-x" label={t('noShowRate')} value="3.6%" note={a('vsPrevious')} color="#e04a55" delta="0.8 pt" good />
        <Kpi icon="timer" label={t('avgWait')} value="23 min" note={a('vsPrevious')} color="#d68a00" delta="4 min" good />
        <Kpi icon="repeat" label={t('fuReturn')} value="78%" note={a('vsPrevious')} color="#12a07a" delta="3 pt" good />
      </KpiGrid>
      <Panel className="mt-3.5" title={t('weekly')} icon="trending-up" right={<Legend items={[{ label: a('actual'), color: '#2d6cdf' }, { label: t('forecastBand'), color: '#7c4ddb', dashed: true }]} />}>
        <ForecastChart labels={A.weekly.labels} actual={A.weekly.actual} forecast={A.weekly.forecast} band={0.04} splitIndex={10} domain={[1100, 1680]} names={[a('actual'), a('aiForecast')]} />
      </Panel>
      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-[1.3fr_1fr]">
        <Panel title={t('busiest')} icon="flame">
          <Heatmap cols={A.heatHours} rows={A.heatDays.map((d) => ({ label: DAY_SHORT[lang][d], values: HEAT_SHAPE.map((v) => Math.round(dayWeight(d) * v * 100)) }))} />
          <div className="mt-2 text-[11.5px] text-muted">{t('darker')}</div>
        </Panel>
        <Panel title={t('noShowPattern')} icon="user-x">
          <GroupedBars height={150} data={A.heatDays.map((d, i) => ({ label: DAY_SHORT[lang][d], rate: A.noShowByDay[i] }))} series={[{ key: 'rate', name: '%', color: '#e04a55' }]} />
          <div className="mt-2 grid grid-cols-2 gap-2.5">
            <Pred icon="smartphone" title="Online 4.4%" sub="Walk-in 0%" />
            <Pred icon="calendar-clock" title={t('ahead')} sub={t('ahead2')} />
          </div>
        </Panel>
      </div>
      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-[1.3fr_1fr]">
        <Panel title={t('seasonal')} icon="thermometer" right={<Legend items={A.seasonal.series.map((s) => ({ label: s.name, color: s.color }))} />}>
          <MultiLine labels={A.seasonal.months.map((x) => MONTH_SHORT[lang][x])} series={A.seasonal.series} domain={[0, 230]} />
        </Panel>
        <Panel title={t('demand')} icon="scale" right={<Legend items={[{ label: t('demandL'), color: '#2d6cdf' }, { label: t('capacityL'), color: '#cfd8e6' }]} />}>
          <GroupedBars
            height={160}
            data={A.demandCapacity.map(([label, d, c]) => ({ label, demand: d, capacity: c }))}
            series={[
              { key: 'demand', name: t('demandL'), color: '#2d6cdf' },
              { key: 'capacity', name: t('capacityL'), color: '#cfd8e6' },
            ]}
          />
          <div className="mt-2 text-[11.5px] text-muted">{t('demandNote')}</div>
        </Panel>
      </div>
      <Panel className="mt-3.5" title={t('recs')} icon="lightbulb">
        <div className="flex flex-col">
          {A.recommendations.map((r) => (
            <div key={r.title.en} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
              <Badge tone={rec[r.level]}>{a(r.level)}</Badge>
              <Avatar icon={r.icon} light />
              <div className="flex-1">
                <b>{loc(r.title)}</b>
                <div className="text-[12.5px] text-muted">{loc(r.impact)}</div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
