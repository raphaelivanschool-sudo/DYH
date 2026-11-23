import { Command } from 'cmdk';
import { Popover } from 'radix-ui';
import { useState } from 'react';
import { common, useT } from '@dyh/i18n';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { inputCls } from './form';

export interface PickOption {
  value: string;
  label: string;
  sub?: string;
  icon?: string;
  disabled?: boolean;
}

/**
 * Searchable single-select (the prototype's bottom-sheet "picker").
 * Built on cmdk + Radix Popover so it is keyboard and screen-reader friendly.
 */
export function Picker({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  icon,
  className,
  disabled,
}: {
  value: string | null;
  onChange: (v: string) => void;
  options: PickOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  icon?: string;
  className?: string;
  disabled?: boolean;
}) {
  const t = useT(common);
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.value === value);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild disabled={disabled}>
        <button type="button" className={cn(inputCls, 'flex items-center gap-2 text-left', !cur && 'text-muted', className)}>
          <Icon name={cur?.icon ?? icon ?? 'list'} size={17} className="text-muted" />
          <span className="min-w-0 flex-1 truncate">{cur?.label ?? placeholder ?? t('select')}</span>
          <Icon name="chevrons-up-down" size={16} className="text-muted" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className="z-[60] w-[var(--radix-popover-trigger-width)] min-w-[280px] overflow-hidden rounded-2xl border border-line bg-card shadow-lift">
          <Command
            filter={(v, search) => {
              const o = options.find((x) => x.value === v);
              const hay = `${o?.label ?? ''} ${o?.sub ?? ''}`.toLowerCase();
              return search.toLowerCase().split(/\s+/).every((w) => hay.includes(w)) ? 1 : 0;
            }}
          >
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Icon name="search" size={16} className="text-muted" />
              <Command.Input placeholder={searchPlaceholder ?? t('search')} className="w-full bg-transparent py-3 text-[14px] outline-none" />
            </div>
            <Command.List className="max-h-[300px] overflow-y-auto p-1.5">
              <Command.Empty className="py-6 text-center text-[13px] text-muted">{t('noResults')}</Command.Empty>
              {options.map((o) => (
                <Command.Item
                  key={o.value}
                  value={o.value}
                  disabled={o.disabled}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-45 data-[selected=true]:bg-sky-2"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-sky text-blue">
                    <Icon name={o.icon ?? icon ?? 'circle'} size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[13px]">{o.label}</b>
                    {o.sub && <span className="block truncate text-[11.5px] text-muted">{o.sub}</span>}
                  </span>
                  {o.value === value && <Icon name="check" size={16} className="text-blue" />}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
