import { Checkbox as RCheckbox, Switch as RSwitch } from 'radix-ui';
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { common, useT } from '@dyh/i18n';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';

export const inputCls =
  'w-full rounded-xl border-[1.5px] border-line bg-field px-3.5 py-[11px] text-[14px] text-ink outline-none transition placeholder:text-muted/70 focus:border-blue-2 focus:ring-4 focus:ring-blue-2/15 disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(inputCls, className)} {...p} />
));
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn(inputCls, 'min-h-[96px] resize-y', className)} {...p} />
));
Textarea.displayName = 'Textarea';

/** Label + control + optional hint. Pass `htmlFor` through `id` to link the label. */
export function Field({ label, icon, optional, hint, children, className, id }: { label: string; icon?: string; optional?: boolean; hint?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  const t = useT(common);
  return (
    <div className={cn('mt-3.5', className)}>
      <label htmlFor={id} className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold">
        {icon && <Icon name={icon} size={15} className="text-muted" />}
        {label}
        {optional && <span className="font-medium text-muted">({t('optional')})</span>}
      </label>
      {children}
      {hint && <div className="mt-1 text-[11.5px] text-muted">{hint}</div>}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 rounded-xl border-[1.5px] border-line bg-field px-3 focus-within:border-blue-2', className)}>
      <Icon name="search" size={17} className="text-muted" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="w-full bg-transparent py-2.5 text-[14px] outline-none placeholder:text-muted/70" />
      {value && (
        <button type="button" aria-label="Clear" onClick={() => onChange('')} className="text-muted hover:text-ink">
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}

export type Opt = { value: string; label: string };

/** Compact labelled <select> used in table filter bars ("fsel" in the prototype). */
export function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Opt[] }) {
  const t = useT(common);
  return (
    <label className={cn('inline-flex items-center gap-1.5 rounded-[10px] border-[1.5px] py-1 pl-2.5 pr-1 text-[12px] font-semibold', value ? 'border-blue-2 bg-sky-2 text-blue' : 'border-line bg-field text-muted')}>
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="max-w-[170px] bg-transparent px-0.5 py-1 text-[12.5px] font-bold text-ink outline-none">
        <option value="">{t('all')}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterBar({ children, active, onClear, className }: { children: ReactNode; active: boolean; onClear: () => void; className?: string }) {
  const t = useT(common);
  return (
    <div className={cn('mt-3 flex flex-wrap items-center gap-2', className)}>
      <span className="flex items-center gap-1 text-[12px] font-bold text-muted">
        <Icon name="filter" size={14} />
        {t('filter')}
      </span>
      {children}
      {active && (
        <button type="button" onClick={onClear} className="inline-flex items-center gap-1 text-[12px] font-bold text-blue hover:underline">
          <Icon name="x" size={14} />
          {t('clear')}
        </button>
      )}
    </div>
  );
}

/** Small helper for filter state: const f = useFilters(); f.get('sp'); f.set('sp', v). */
export type Filters = Record<string, string>;
export const filterOk = (f: Filters, k: string, v: string | number | undefined) => !f[k] || f[k] === String(v);

export function Segmented<T extends string>({ value, onChange, options, className, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; icon?: string }[]; className?: string; size?: 'sm' | 'md' }) {
  return (
    <div role="tablist" className={cn('flex gap-1 rounded-xl bg-soft p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-[9px] font-semibold transition',
            size === 'sm' ? 'px-2 py-1.5 text-[12px]' : 'px-2.5 py-2.5 text-[13px]',
            value === o.value ? 'bg-card text-ink shadow-seg' : 'text-muted hover:text-ink',
          )}
        >
          {o.icon && <Icon name={o.icon} size={16} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ on, onClick, children, icon, className }: { on?: boolean; onClick?: () => void; children: ReactNode; icon?: string; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn('inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-[13px] py-2 text-[13px] font-semibold transition', on ? 'border-primary bg-primary text-white' : 'border-line bg-card text-ink hover:bg-sky-2', className)}
    >
      {icon && <Icon name={icon} size={15} />}
      {children}
    </button>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <RSwitch.Root
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
      className="relative h-7 w-12 shrink-0 rounded-full bg-tog transition data-[state=checked]:bg-primary"
    >
      <RSwitch.Thumb className="block size-[22px] translate-x-[3px] rounded-full bg-white shadow transition data-[state=checked]:translate-x-[23px]" />
    </RSwitch.Root>
  );
}

export function Checkbox({ checked, onChange, disabled, label }: { checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <RCheckbox.Root
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onCheckedChange={(v) => onChange?.(v === true)}
      className="grid size-[18px] shrink-0 place-items-center rounded-[5px] border-[1.5px] border-line bg-field transition data-[state=checked]:border-primary data-[state=checked]:bg-primary disabled:opacity-40"
    >
      <RCheckbox.Indicator>
        <Icon name="check" size={13} className="text-white" strokeWidth={3} />
      </RCheckbox.Indicator>
    </RCheckbox.Root>
  );
}

/** Row with a checkbox, used for doctor / clinic multi-select lists ("pi" in the prototype). */
export function CheckRow({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn('flex cursor-pointer items-center gap-2.5 rounded-xl border-[1.5px] px-3 py-2 transition', checked ? 'border-blue-2 bg-sky-2' : 'border-line bg-card hover:bg-sky-2')}>
      <RCheckbox.Root
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="grid size-[18px] shrink-0 place-items-center rounded-[5px] border-[1.5px] border-line bg-field data-[state=checked]:border-primary data-[state=checked]:bg-primary"
      >
        <RCheckbox.Indicator>
          <Icon name="check" size={13} className="text-white" strokeWidth={3} />
        </RCheckbox.Indicator>
      </RCheckbox.Root>
      {children}
    </label>
  );
}

export function NumberInput({ value, onChange, min, max, label }: { value: number; onChange: (v: number) => void; min: number; max: number; label: string }) {
  return (
    <input
      type="number"
      aria-label={label}
      min={min}
      max={max}
      value={value}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
      }}
      className={cn(inputCls, 'w-[90px] text-center font-extrabold')}
    />
  );
}

export function DateInput({ label, value, onChange, className }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-1 text-[12px] font-bold text-muted', className)}>
      <span className="flex items-center gap-1">
        <Icon name="calendar" size={14} />
        {label}
      </span>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputCls, 'py-2')} />
    </label>
  );
}

/** Mobile-number input that only accepts digits (11 max, PH format). */
export function MobileInput(props: { value: string; onChange: (v: string) => void; id?: string }) {
  return <Input id={props.id} inputMode="numeric" maxLength={11} placeholder="09171234567" value={props.value} onChange={(e) => props.onChange(e.target.value.replace(/\D/g, ''))} />;
}
