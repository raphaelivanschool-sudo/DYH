import { useState } from 'react';
import { qk, useApiQuery, useDoctors } from '@dyh/api';
import { MONTH_SHORT, RATINGS_STATS, seededInt } from '@dyh/core';
import { defineMessages, useLang, useLoc, useT } from '@dyh/i18n';
import { DualLine, HBars, Legend, StackBar } from '@/components/charts';
import { Alert, Badge, Kpi, KpiGrid, Loading, Panel, Rich } from '@/components/ui/display';
import { SearchBox } from '@/components/ui/form';
import { ListEmpty } from '@/components/ui/table';
import { Icon } from '@/lib/icon';
import { matches, shortDate } from '@/lib/utils';
import { useAm } from './shared';

const m = defineMessages('admin.ratings', {
  adminOnly: ['Ang average na marka ay **Admin lamang** ang nakakakita — hindi ito ipinapakita sa profile ng doktor. Hindi na mababago ng pasyente ang marka kapag naipost.', 'The average rating is visible to **Admin only** — it is not shown on the doctor profile. Patients cannot edit a rating once posted.'],
  avg: ['Karaniwang Marka', 'Avg Consultation Rating'],
  nRatings: ['{{n}} marka', '{{n}} ratings'],
  very: ['Lubos na Kasiya-siya', 'Very Satisfactory'],
  ok: ['Kasiya-siya', 'Satisfactory'],
  bad: ['Hindi Kasiya-siya', 'Unsatisfactory'],
  dist: ['Distribusyon ng Marka', 'Rating Distribution'],
  trend: ['Trend ng Kasiyahan', 'Satisfaction Trend'],
  consRating: ['Marka sa konsulta', 'Consultation rating'],
  pctVery: ['% Lubos na kasiya-siya', '% Very satisfied (Kiosk)'],
  survey: ['Survey sa Kiosk', 'Kiosk Hospital Survey'],
  perDoctor: ['Marka bawat Doktor', 'Ratings per Doctor'],
  hidden: ['Hindi nakikita ng doktor', 'Hidden from doctors'],
  ai: ['AI Analytics at Rekomendasyon', 'AI Analysis & Recommendations'],
  basedOn: ['Batay sa {{r}} marka at {{s}} survey', 'Based on {{r}} ratings & {{s}} surveys'],
  findings: ['Mga Natuklasan', 'Key Findings'],
  recs: ['Mga Rekomendasyon', 'Recommendations'],
  comments: ['Mga Komento', 'Comments'],
  searchC: ['Hanapin ang komento o doktor...', 'Search comments or doctor...'],
});

export default function Ratings() {
  const t = useT(m);
  const a = useAm();
  const loc = useLoc();
  const [lang] = useLang();
  const { data: comments } = useApiQuery(qk.ratingComments, (x) => x.getRatingComments());
  const { data: doctors = [] } = useDoctors();
  const [q, setQ] = useState('');
  if (!comments) return <Loading />;
  const R = RATINGS_STATS;
  const total = R.distribution.reduce((n, [, c]) => n + c, 0);
  const perDoc = [...doctors]
    .map((d) => ({ d, r: 4 + seededInt(d.id + 'r', 2, 9) / 10 }))
    .sort((x, y) => y.r - x.r)
    .slice(0, 10);
  const lvl = { high: 'red', medium: 'amber', low: 'blue' } as const;
  const shown = comments.filter((c) => matches([loc(c.text), c.doctorName], q));
  const fmt = (n: number) => n.toLocaleString('en-US');

  return (
    <>
      <Alert icon="eye-off" className="mb-3.5">
        <Rich text={t('adminOnly')} />
      </Alert>
      <KpiGrid>
        <Kpi icon="star" label={t('avg')} value={`${R.average} / 5`} note={t('nRatings', { n: fmt(R.count) })} color="#d68a00" delta="0.1" good />
        <Kpi icon="smile" label={t('very')} value={`${R.kiosk.very}%`} note="Kiosk survey" color="#12805a" delta="3 pt" good />
        <Kpi icon="meh" label={t('ok')} value={`${R.kiosk.ok}%`} note="Kiosk survey" color="#2d6cdf" />
        <Kpi icon="frown" label={t('bad')} value={`${R.kiosk.bad}%`} note="Kiosk survey" color="#e04a55" delta="1 pt" good />
      </KpiGrid>
      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-[1.3fr_1fr]">
        <Panel title={t('dist')} icon="star">
          <HBars
            labelWidth={44}
            valueWidth={76}
            color="#f5a524"
            rows={R.distribution.map(([s, c]) => ({
              label: (
                <span className="inline-flex items-center gap-1">
                  {s} <Icon name="star" size={13} />
                </span>
              ),
              value: c,
              display: (
                <>
                  {c} <span className="text-[11px] font-normal text-muted">{Math.round((c / total) * 100)}%</span>
                </>
              ),
            }))}
          />
        </Panel>
        <Panel title={t('trend')} icon="trending-up" right={<Legend items={[{ label: t('consRating'), color: '#f5a524' }, { label: t('pctVery'), color: '#12a07a' }]} />}>
          <DualLine labels={R.trend.months.map((x) => MONTH_SHORT[lang][x])} left={{ name: t('consRating'), color: '#f5a524', data: R.trend.rating, domain: [4, 5] }} right={{ name: t('pctVery'), color: '#12a07a', data: R.trend.verySatisfied, domain: [50, 80] }} />
        </Panel>
      </div>
      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-[1.3fr_1fr]">
        <Panel title={t('survey')} icon="tablet">
          {R.survey.map((s) => (
            <div key={s.label.en} className="mt-3 first:mt-0">
              <div className="flex justify-between text-[12.5px]">
                <b>{loc(s.label)}</b>
                <span className="text-muted">
                  {s.very}% · {s.ok}% · {s.bad}%
                </span>
              </div>
              <div className="mt-1">
                <StackBar parts={[{ value: s.very, color: '#12805a' }, { value: s.ok, color: '#2d6cdf' }, { value: s.bad, color: '#e04a55' }]} />
              </div>
            </div>
          ))}
          <Legend className="mt-3" items={[{ label: t('very'), color: '#12805a' }, { label: t('ok'), color: '#2d6cdf' }, { label: t('bad'), color: '#e04a55' }]} />
        </Panel>
        <Panel title={t('perDoctor')} icon="stethoscope" right={<Badge icon="eye-off">{t('hidden')}</Badge>}>
          <div className="max-h-[240px] overflow-y-auto">
            <HBars
              labelWidth={150}
              valueWidth={60}
              color="#f5a524"
              max={1.5}
              rows={perDoc.map(({ d, r }) => ({ label: <span className="text-[12.5px]">{d.name}</span>, value: r - 3.5, display: <span className="text-[12.5px]">{r.toFixed(1)} ★</span> }))}
            />
          </div>
        </Panel>
      </div>
      <Panel className="aisum mt-3.5 border" title={t('ai')} icon="sparkles" right={<Badge tone="blue">{t('basedOn', { r: fmt(R.count), s: fmt(R.surveys) })}</Badge>}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <b className="flex items-center gap-1.5 text-[13px]">
              <Icon name="search" size={15} />
              {t('findings')}
            </b>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13px]">
              {R.findings.map((f) => (
                <li key={f.en}>
                  <Rich text={loc(f)} />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <b className="flex items-center gap-1.5 text-[13px]">
              <Icon name="lightbulb" size={15} />
              {t('recs')}
            </b>
            {R.recommendations.map((r) => (
              <div key={r.text.en} className="flex items-center gap-2.5 border-b border-line py-2.5 last:border-0">
                <Badge tone={lvl[r.level]}>{a(r.level)}</Badge>
                <b className="flex-1 text-[12.5px]">{loc(r.text)}</b>
              </div>
            ))}
          </div>
        </div>
      </Panel>
      <Panel className="mt-3.5" title={t('comments')} icon="message-square">
        <SearchBox value={q} onChange={setQ} placeholder={t('searchC')} />
        <div className="mt-2">
          {shown.map((c, i) => (
            <div key={i} className="flex items-start gap-2.5 border-b border-line py-2.5 last:border-0">
              <Badge tone="amber" icon="star">{c.stars}</Badge>
              <div className="flex-1">
                {loc(c.text)}
                <div className="text-[11.5px] text-muted">
                  {c.doctorName} · {shortDate(c.date, lang)}
                </div>
              </div>
            </div>
          ))}
          <ListEmpty show={!shown.length} />
        </div>
      </Panel>
    </>
  );
}
