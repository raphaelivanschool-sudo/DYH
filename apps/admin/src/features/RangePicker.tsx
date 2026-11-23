import type { ReactNode } from 'react';
import { Panel } from '@/components/ui/display';
import { Chip, DateInput } from '@/components/ui/form';
import { useAm } from './shared';

export type RangePreset = 'week' | 'month' | 'q' | 'year' | 'custom';
export interface DateRange {
  preset: RangePreset;
  from: string;
  to: string;
}

export const PRESET_DATES: Record<Exclude<RangePreset, 'custom'>, [string, string]> = {
  week: ['2026-10-26', '2026-10-31'],
  month: ['2026-10-01', '2026-10-31'],
  q: ['2026-08-01', '2026-10-31'],
  year: ['2026-01-01', '2026-10-31'],
};

export const rangeOf = (p: Exclude<RangePreset, 'custom'>): DateRange => ({ preset: p, from: PRESET_DATES[p][0], to: PRESET_DATES[p][1] });

export function RangePicker({ value, onChange, action }: { value: DateRange; onChange: (r: DateRange) => void; action?: ReactNode }) {
  const a = useAm();
  const presets: [Exclude<RangePreset, 'custom'>, string][] = [
    ['week', a('thisWeek')],
    ['month', a('thisMonth')],
    ['q', a('last3')],
    ['year', a('thisYear')],
  ];
  return (
    <Panel>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h4 className="text-[15px]">{a('dateRange')}</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {presets.map(([k, l]) => (
              <Chip key={k} on={value.preset === k} onClick={() => onChange(rangeOf(k))}>
                {l}
              </Chip>
            ))}
            <Chip on={value.preset === 'custom'} onClick={() => onChange({ ...value, preset: 'custom' })}>
              {a('custom')}
            </Chip>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2.5">
          <DateInput className="w-[160px]" label={a('from')} value={value.from} onChange={(from) => onChange({ ...value, preset: 'custom', from })} />
          <DateInput className="w-[160px]" label={a('to')} value={value.to} onChange={(to) => onChange({ ...value, preset: 'custom', to })} />
          {action}
        </div>
      </div>
    </Panel>
  );
}
