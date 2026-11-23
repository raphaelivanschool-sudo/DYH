import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { DOCTOR_REPORT } from '@dyh/core';
import { brand } from '@dyh/tokens';
import { common, useT } from '@dyh/i18n';
import { Avatar, Button, Card, ChartLegend, Chip, Icon, MeterRow, Row, Screen, Txt, VBars, cx, toast, useColors } from '@dyh/ui-native';
import { DocHeader } from '../../src/components/shell';
import { useDates } from '../../src/lib';
import { dm } from '../../src/msgs';
import { useUi } from '../../src/store';

type Range = 'week' | 'month' | 'q' | 'custom';
const R = DOCTOR_REPORT;

export default function Reports() {
  const t = useT(dm);
  const open = useUi((s) => s.reportsOpen);
  if (!open)
    return (
      <Screen header={<DocHeader title={t('myReports')} icon="chart-column" />}>
        <View className="items-center pt-10">
          <Avatar icon="lock" size="xl" light />
          <Txt w="b" size={18} className="mt-4">
            {t('repProtected')}
          </Txt>
          <Txt size={12.5} className="mt-2 text-center text-muted">
            {t('repProtectedSub')}
          </Txt>
          <Button size="lg" full icon="fingerprint" className="mt-6" onPress={() => useUi.getState().set({ verify: { kind: 'reports' } })}>
            {t('verifyBtn')}
          </Button>
        </View>
      </Screen>
    );
  return <ReportBody />;
}

function Box({ icon, title, children, className }: { icon: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cx('mt-3', className)}>
      <Row gap="gap-1.5">
        <Icon name={icon} size={16} color="blue" />
        <Txt w="b" size={14} className="flex-1">
          {title}
        </Txt>
      </Row>
      {children}
    </Card>
  );
}

function StatBox({ icon, label, value, sub, color }: { icon: string; label: string; value: React.ReactNode; sub?: React.ReactNode; color?: 'red' | 'green' }) {
  return (
    <View className="w-[48.5%] rounded-[14px] border border-line bg-card p-3.5">
      <Row gap="gap-1">
        <Icon name={icon} size={13} color="muted" />
        <Txt w="s" size={11.5} className="flex-1 text-muted" numberOfLines={1}>
          {label}
        </Txt>
      </Row>
      <Txt w="x" size={22} className={cx('mt-1', color === 'red' ? 'text-red' : color === 'green' ? 'text-green' : 'text-ink')}>
        {value}
      </Txt>
      {sub}
    </View>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <View className="mt-2 overflow-hidden rounded-xl border border-line">
      <Row className="bg-soft px-2.5 py-2" gap="gap-0">
        {head.map((h, i) => (
          <Txt key={h} w="b" size={11.5} className={cx('text-muted', i ? 'flex-1 text-right' : 'flex-[1.4]')}>
            {h}
          </Txt>
        ))}
      </Row>
      {rows.map((r, j) => (
        <Row key={j} className="border-t border-line px-2.5 py-2" gap="gap-0">
          {r.map((c, i) => (
            <Txt key={i} size={12.5} w={i ? 'm' : 's'} className={i ? 'flex-1 text-right' : 'flex-[1.4]'}>
              {c}
            </Txt>
          ))}
        </Row>
      ))}
    </View>
  );
}

function ReportBody() {
  const t = useT(dm);
  const tc = useT(common);
  const dt = useDates();
  const c = useColors();
  const [range, setRange] = useState<Range>('month');
  const [sec, setSec] = useState<'all' | 'sum' | 'dx'>('all');
  const f = R.rangeFactor[range];
  const n = (x: number) => Math.round(x * f);
  const [from, to] = R.rangeDates[range];
  const tot = n(R.base.total);
  const onl = n(R.base.online);
  const wi = tot - onl;
  const ch = brand.chart;
  const ranges: [Range, string][] = [
    ['week', t('rWeek')],
    ['month', t('rMonth')],
    ['q', t('rQ')],
    ['custom', t('rCustom')],
  ];
  const types: [string, number, string][] = [
    [t('newPt'), n(61), ch.online],
    [t('fuByYou'), n(72), ch.forecast],
    [t('returning'), tot - n(61) - n(72), ch.walkin],
  ];
  return (
    <Screen
      header={
        <DocHeader
          title={t('myReports')}
          icon="chart-column"
          right={<Button size="sm" variant="o" icon="lock" accessibilityLabel={t('closeRec')} onPress={() => useUi.getState().set({ reportsOpen: false })} />}
        />
      }
    >
      <Card>
        <Row gap="gap-1.5">
          <Icon name="calendar-range" size={15} color="blue" />
          <Txt w="b" size={13}>
            {t('range')}
          </Txt>
        </Row>
        <Row className="mt-2 flex-wrap" gap="gap-2">
          {ranges.map(([k, l]) => (
            <Chip key={k} on={range === k} onPress={() => setRange(k)}>
              {l}
            </Chip>
          ))}
        </Row>
        <Row className="mt-2" gap="gap-2">
          {[
            [t('from'), from],
            [t('to'), to],
          ].map(([l, d]) => (
            <View key={l} className="flex-1 rounded-xl border-[1.5px] border-line bg-field px-3 py-2">
              <Row gap="gap-1">
                <Icon name="calendar" size={12} color="muted" />
                <Txt w="b" size={11} className="text-muted">
                  {l}
                </Txt>
              </Row>
              <Txt w="b" size={13.5}>
                {dt.short(d)}
              </Txt>
            </View>
          ))}
        </Row>
      </Card>

      <View className="mt-3 flex-row flex-wrap justify-between gap-y-2.5">
        <StatBox icon="users" label={t('totalPts')} value={tot} sub={<Txt size={11} className="text-green">▲ 8%</Txt>} />
        <StatBox icon="user-plus" label={t('newRet')} value={`${n(61)} / ${tot - n(61)}`} />
        <StatBox icon="user-x" label={t('noShow')} value={n(11)} color="red" sub={<Txt size={11} className="text-muted">4.4%</Txt>} />
        <StatBox icon="repeat" label={t('fuReturn')} value="78%" color="green" />
        <StatBox icon="timer" label={t('avgConsult')} value="12 min" />
        <StatBox icon="file-plus" label="Addendum" value={n(4)} />
      </View>

      <Box icon="chart-column" title={t('perClinicDay')}>
        <View className="mt-2">
          <VBars rows={R.perClinicDay.map(([d, v]) => ({ label: dt.day(d), parts: [{ value: n(v), color: c.blue2 }] }))} height={130} />
        </View>
      </Box>

      <Box icon="git-compare" title="Online vs Walk-in">
        <View className="mt-3 h-3.5 flex-row overflow-hidden rounded-full">
          <View style={{ width: `${(onl / tot) * 100}%`, backgroundColor: ch.online }} />
          <View style={{ flex: 1, backgroundColor: ch.walkin }} />
        </View>
        <Row className="mt-2 justify-between">
          <Txt size={12.5}>Online {onl}</Txt>
          <Txt size={12.5}>Walk-in {wi}</Txt>
        </Row>
      </Box>

      <Box icon="clock" title={t('busiest')}>
        <View className="mt-2">
          <VBars rows={R.busiestHours.map(([h, v]) => ({ label: `${h}${+h < 12 ? 'AM' : 'PM'}`, parts: [{ value: v, color: '#7c4ddb' }] }))} height={110} showTotal={false} />
        </View>
      </Box>

      <Row className="items-stretch" gap="gap-2.5">
        <Box icon="users-round" title={t('ageGroup')} className="flex-1">
          {R.ageGroups.map(([a, v]) => (
            <MeterRow key={a} label={a} value={`${v}%`} pct={(v / 41) * 100} />
          ))}
        </Box>
        <Box icon="users" title={tc('sex')} className="flex-1">
          <View className="mt-2 items-center">
            <Donut pct={R.femalePct} a={ch.online} b={ch.pink} />
          </View>
          <Row className="mt-2 justify-between">
            <Txt size={11}>
              {tc('female')} {R.femalePct}%
            </Txt>
            <Txt size={11}>
              {tc('male')} {100 - R.femalePct}%
            </Txt>
          </Row>
        </Box>
      </Row>

      <Box icon="stethoscope" title={t('commonDx')}>
        {R.diagnoses.map(([d, v]) => (
          <MeterRow key={d} label={d} value={n(v)} pct={(v / 38) * 100} />
        ))}
      </Box>
      <Box icon="pill" title={t('mostRx')}>
        {R.medicines.map(([d, v]) => (
          <MeterRow key={d} label={d} value={n(v)} pct={(v / 41) * 100} color={ch.green} />
        ))}
      </Box>

      <Box icon="trending-up" title={t('trend')}>
        <TrendChart labels={R.trend.months.map((m) => dt.mon(m))} series={[{ name: t('total'), color: ch.online, data: R.trend.total }, { name: 'Online', color: ch.green, data: R.trend.online }]} />
      </Box>

      <Box icon="layers" title={t('consultTypes')}>
        {types.map(([l, v, col]) => (
          <MeterRow key={l} label={l} value={v} pct={(v / tot) * 100} color={col} right={<Txt size={11} className="text-muted">{`  ${Math.round((v / tot) * 100)}%`}</Txt>} />
        ))}
      </Box>

      <Box icon="scan-qr-code" title={t('bookArr')}>
        <Row className="mt-2" gap="gap-1.5">
          {(
            [
              [t('bookedOnl'), onl + n(14), 'text-ink'],
              [t('arrScanned'), onl, 'text-green'],
              [t('noShow'), n(11), 'text-red'],
            ] as const
          ).map(([l, v, cls]) => (
            <View key={l} className="flex-1 rounded-xl border border-line p-2.5">
              <Txt size={11} className="text-muted" numberOfLines={2}>
                {l}
              </Txt>
              <Txt w="x" size={19} className={cls}>
                {v}
              </Txt>
            </View>
          ))}
        </Row>
        <Txt size={11.5} className="mt-2 text-muted">
          {t('arrRate')}:{' '}
          <Txt w="b" size={11.5}>
            {Math.round((onl / (onl + n(14))) * 100)}%
          </Txt>
        </Txt>
      </Box>

      <Box icon="timer" title={t('waitTime')}>
        <Table head={[t('day'), t('wait'), t('consult'), tc('patients')]} rows={R.waitTimes.map(([d, w, k, p]) => [dt.day(d), `${w} min`, `${k} min`, n(p)])} />
      </Box>
      <Box icon="stethoscope" title={t('dxByAge')}>
        <Table head={[tc('diagnosis'), '18–39', '40–59', '60+']} rows={R.dxByAge.map(([d, a, b, x]) => [d, n(a), n(b), n(x)])} />
      </Box>
      <Box icon="flask-conical" title={t('labsTop')}>
        {R.labs.map(([d, v]) => (
          <MeterRow key={d} label={d} value={n(v)} pct={(v / 29) * 100} color={ch.amber} />
        ))}
      </Box>
      <Box icon="repeat" title={t('fuCompliance')}>
        <Row className="mt-2" gap="gap-1.5">
          {(
            [
              [t('booked'), n(72)],
              [t('returned'), n(56)],
              [t('missed'), n(72) - n(56)],
            ] as const
          ).map(([l, v]) => (
            <View key={l} className="flex-1 rounded-xl border border-line p-2.5">
              <Txt size={11} className="text-muted">
                {l}
              </Txt>
              <Txt w="x" size={19}>
                {v}
              </Txt>
            </View>
          ))}
        </Row>
      </Box>

      <Box icon="download" title={t('dlReport')}>
        <Txt size={11.5} className="mt-1 text-muted">
          {t('rangeLbl')}: {from} – {to}
        </Txt>
        <Row className="mt-2 flex-wrap" gap="gap-2">
          {(
            [
              ['all', t('secAll')],
              ['sum', t('secSum')],
              ['dx', t('secDx')],
            ] as const
          ).map(([k, l]) => (
            <Chip key={k} on={sec === k} onPress={() => setSec(k)}>
              {l}
            </Chip>
          ))}
        </Row>
        <Row className="mt-3" gap="gap-2">
          <Button variant="n" className="flex-1" icon="file-down" onPress={() => toast.info(t('downloading'))}>
            PDF
          </Button>
          <Button variant="ok" className="flex-1" icon="sheet" onPress={() => toast.info(t('downloading'))}>
            Excel
          </Button>
        </Row>
        <Row className="mt-2" gap="gap-1">
          <Icon name="shield-check" size={12} color="muted" />
          <Txt size={11} className="flex-1 text-muted">
            {t('noNames')}
          </Txt>
        </Row>
      </Box>
      <Row className="mt-4 justify-center" gap="gap-1">
        <Icon name="eye-off" size={12} color="muted" />
        <Txt size={11} className="text-muted">
          {t('ratingsAdmin')}
        </Txt>
      </Row>
    </Screen>
  );
}

function Donut({ pct, a, b, size = 96 }: { pct: number; a: string; b: string; size?: number }) {
  const c = useColors();
  const r = size / 2 - 9;
  const len = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={b} strokeWidth={18} fill="none" />
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={a} strokeWidth={18} fill="none" strokeDasharray={`${(len * pct) / 100} ${len}`} rotation={-90} origin={`${size / 2}, ${size / 2}`} />
      <SvgText x={size / 2} y={size / 2 + 5} fontSize={15} fontWeight="800" fill={c.ink} textAnchor="middle">
        {pct}%
      </SvgText>
    </Svg>
  );
}

function TrendChart({ labels, series, height = 130 }: { labels: string[]; series: { name: string; color: string; data: number[] }[]; height?: number }) {
  const c = useColors();
  const [w, setW] = useState(300);
  const max = Math.max(...series.flatMap((s) => s.data)) * 1.1;
  const pad = { l: 30, r: 8, t: 8, b: 20 };
  const x = (i: number) => pad.l + (i * (w - pad.l - pad.r)) / (labels.length - 1);
  const y = (v: number) => pad.t + (1 - v / max) * (height - pad.t - pad.b);
  return (
    <View className="mt-2" onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Svg width={w} height={height}>
        {[0, 0.5, 1].map((k) => (
          <Line key={k} x1={pad.l} x2={w - pad.r} y1={y(max * k)} y2={y(max * k)} stroke={c.line} strokeDasharray="3 4" />
        ))}
        {[0, 0.5, 1].map((k) => (
          <SvgText key={`l${k}`} x={pad.l - 6} y={y(max * k) + 4} fontSize={10} fill={c.muted} textAnchor="end">
            {Math.round(max * k)}
          </SvgText>
        ))}
        {labels.map((l, i) => (
          <SvgText key={l} x={x(i)} y={height - 4} fontSize={10} fill={c.muted} textAnchor="middle">
            {l}
          </SvgText>
        ))}
        {series.map((s) => (
          <Polyline key={s.name} points={s.data.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={s.color} strokeWidth={2.5} />
        ))}
        {series.flatMap((s) => s.data.map((v, i) => <Circle key={`${s.name}${i}`} cx={x(i)} cy={y(v)} r={3} fill={s.color} />))}
      </Svg>
      <ChartLegend items={series.map((s) => [s.name, s.color] as [string, string])} />
    </View>
  );
}
