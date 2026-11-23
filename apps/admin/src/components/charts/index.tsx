import type { ReactNode } from 'react';
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';

/* Shared look: dashed grid, muted axis labels, card-coloured tooltip. */
const axis = { tick: { fill: 'var(--muted)', fontSize: 11 }, axisLine: false, tickLine: false } as const;
const grid = <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 4" />;
const tooltip = (
  <Tooltip
    cursor={{ fill: 'var(--sky-2)' }}
    contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12, color: 'var(--ink)' }}
    labelStyle={{ fontWeight: 700, color: 'var(--ink)' }}
  />
);

export function Legend({ items, className }: { items: { label: string; color: string; dashed?: boolean }[]; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3.5 text-[12px] font-medium text-muted', className)}>
      {items.map((x) => (
        <span key={x.label} className="inline-flex items-center gap-1.5">
          <i className="block size-2.5 rounded-[3px]" style={{ background: x.color, opacity: x.dashed ? 0.6 : 1 }} />
          {x.label}
        </span>
      ))}
    </div>
  );
}

export interface Series {
  key: string;
  name: string;
  color: string;
}

export function GroupedBars({ data, series, height = 170 }: { data: Record<string, string | number>[]; series: Series[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barGap={3} margin={{ top: 6, right: 0, left: -24, bottom: 0 }}>
        {grid}
        <XAxis dataKey="label" {...axis} interval={0} />
        <YAxis {...axis} width={44} />
        {tooltip}
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[6, 6, 2, 2]} maxBarSize={22} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Actual vs AI forecast with a shaded confidence band and a "today" split line. */
export function ForecastChart({
  labels,
  actual,
  forecast,
  band,
  splitIndex,
  domain,
  height = 200,
  names,
}: {
  labels: string[];
  actual: (number | null)[];
  forecast: (number | null)[];
  /** ± absolute value, or a fraction when < 1 (e.g. 0.04 = ±4%). */
  band: number;
  splitIndex: number;
  domain: [number, number];
  height?: number;
  names: [string, string];
}) {
  const data = labels.map((label, i) => {
    const f = forecast[i];
    const d = f == null ? null : band < 1 ? f * band : band;
    return { label, actual: actual[i], forecast: f, band: f == null || d == null ? null : [f - d, f + d] };
  });
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
        {grid}
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} domain={domain} width={48} />
        {tooltip}
        <ReferenceLine x={labels[splitIndex]} stroke="var(--muted)" strokeDasharray="4 4" strokeOpacity={0.6} />
        <Area dataKey="band" stroke="none" fill="#7c4ddb" fillOpacity={0.16} isAnimationActive={false} legendType="none" tooltipType="none" />
        <Line isAnimationActive={false} dataKey="actual" name={names[0]} stroke="#2d6cdf" strokeWidth={2.5} dot={{ r: 3, fill: '#2d6cdf' }} connectNulls={false} />
        <Line isAnimationActive={false} dataKey="forecast" name={names[1]} stroke="#7c4ddb" strokeWidth={2.5} strokeDasharray="6 5" dot={{ r: 3, fill: '#7c4ddb' }} connectNulls={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function MultiLine({ labels, series, height = 170, domain }: { labels: string[]; series: { name: string; color: string; data: number[] }[]; height?: number; domain?: [number, number] }) {
  const data = labels.map((label, i) => Object.fromEntries([['label', label], ...series.map((s) => [s.name, s.data[i]])]));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        {grid}
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} domain={domain ?? [0, 'auto']} width={44} />
        {tooltip}
        {series.map((s) => (
          <Line key={s.name} dataKey={s.name} stroke={s.color} strokeWidth={2.5} dot={{ r: 3, fill: s.color }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Two series on independent scales (e.g. rating 1–5 vs % very satisfied). */
export function DualLine({ labels, left, right, height = 170 }: { labels: string[]; left: { name: string; color: string; data: number[]; domain: [number, number] }; right: { name: string; color: string; data: number[]; domain: [number, number] }; height?: number }) {
  const data = labels.map((label, i) => ({ label, [left.name]: left.data[i], [right.name]: right.data[i] }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 0, left: -18, bottom: 0 }}>
        {grid}
        <XAxis dataKey="label" {...axis} />
        <YAxis yAxisId="l" {...axis} domain={left.domain} width={44} />
        <YAxis yAxisId="r" orientation="right" {...axis} domain={right.domain} width={36} unit="%" />
        {tooltip}
        <Line yAxisId="l" dataKey={left.name} stroke={left.color} strokeWidth={2.5} dot={{ r: 3, fill: left.color }} />
        <Line yAxisId="r" dataKey={right.name} stroke={right.color} strokeWidth={2.5} dot={{ r: 3, fill: right.color }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Donut({ segments, center, size = 150 }: { segments: { name: string; value: number; color: string }[]; center: ReactNode; size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={segments} dataKey="value" nameKey="name" innerRadius={size * 0.33} outerRadius={size / 2} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
            {segments.map((s) => (
              <Cell key={s.name} fill={s.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">{center}</div>
    </div>
  );
}

/** Horizontal bars with label + value columns ("hbars"). */
export function HBars({ rows, color = 'var(--blue-2)', labelWidth = 150, valueWidth = 44, max }: { rows: { label: ReactNode; value: number; display?: ReactNode }[]; color?: string; labelWidth?: number; valueWidth?: number; max?: number }) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r, i) => (
        <div key={i} className="grid items-center gap-2.5 text-[13px]" style={{ gridTemplateColumns: `${labelWidth}px 1fr ${valueWidth}px` }}>
          <span className="truncate">{r.label}</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-soft">
            <i className="block h-full rounded-full" style={{ width: `${(r.value / m) * 100}%`, background: color }} />
          </div>
          <b className="text-right">{r.display ?? r.value}</b>
        </div>
      ))}
    </div>
  );
}

/** Day × hour heatmap; values 0–125 map to blue opacity. */
export function Heatmap({ rows, cols }: { rows: { label: string; values: number[] }[]; cols: string[] }) {
  return (
    <div className="grid gap-1 text-[10.5px] text-muted" style={{ gridTemplateColumns: `40px repeat(${cols.length}, minmax(0, 1fr))` }}>
      <span />
      {cols.map((c) => (
        <span key={c} className="text-center">
          {c}
        </span>
      ))}
      {rows.map((r) => (
        <div key={r.label} className="contents">
          <span className="self-center font-semibold">{r.label}</span>
          {r.values.map((v, i) => (
            <i key={i} title={String(v)} className="block h-[26px] rounded-md" style={{ background: `rgba(45,108,223,${(v / 125).toFixed(2)})` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Stacked 100% bar (survey results). */
export function StackBar({ parts, height = 12 }: { parts: { value: number; color: string }[]; height?: number }) {
  return (
    <div className="flex overflow-hidden rounded-full" style={{ height }}>
      {parts.map((p, i) => (
        <i key={i} className="block h-full" style={{ width: `${p.value}%`, background: p.color }} />
      ))}
    </div>
  );
}
