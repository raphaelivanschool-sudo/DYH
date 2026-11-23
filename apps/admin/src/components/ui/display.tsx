import type { ReactNode } from 'react';
import type { Tone } from '@dyh/core';
import { common, parseRich, statusIcon, statusLabel, statusTone, useT, type StatusKey } from '@dyh/i18n';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';

const TONE: Record<Tone, string> = {
  blue: 'bg-sky text-blue',
  green: 'bg-green-bg text-green',
  amber: 'bg-amber-bg text-amber',
  red: 'bg-red-bg text-red',
  purple: 'bg-purple-bg text-purple',
  teal: 'bg-teal-bg text-teal',
  gray: 'bg-gray-bg text-gray',
  prio: 'bg-prio-bg text-prio',
};

export function Badge({ tone = 'gray', icon, children, className }: { tone?: Tone; icon?: string; children?: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-[9px] py-[3px] text-[11px] font-bold', TONE[tone], className)}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: StatusKey }) {
  const t = useT(common);
  return (
    <Badge tone={statusTone[status]} icon={statusIcon[status]}>
      {t(statusLabel(status))}
    </Badge>
  );
}

/** Renders "**bold**" markup from translated strings and AI summaries. */
export function Rich({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {parseRich(text).map((p, i) => (p.bold ? <b key={i}>{p.text}</b> : <span key={i}>{p.text}</span>))}
    </span>
  );
}

type AlertKind = 'info' | 'warn' | 'danger' | 'ok';
const ALERT: Record<AlertKind, string> = { info: 'bg-sky text-blue', warn: 'bg-amber-bg text-amber', danger: 'bg-red-bg text-red', ok: 'bg-green-bg text-green' };

export function Alert({ kind = 'info', icon, children, className }: { kind?: AlertKind; icon: string; children: ReactNode; className?: string }) {
  return (
    <div role={kind === 'danger' ? 'alert' : undefined} className={cn('flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-left text-[13px]', ALERT[kind], className)}>
      <Icon name={icon} size={18} className="mt-px" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Panel({ title, icon, right, children, className, flush }: { title?: ReactNode; icon?: string; right?: ReactNode; children?: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={cn('rounded-2xl border border-line bg-card', flush ? 'overflow-hidden p-0' : 'p-[18px]', className)}>
      {title && (
        <h4 className={cn('mb-3 flex flex-wrap items-center gap-2 text-[15px]', flush && 'mb-0 px-[18px] pb-2.5 pt-4')}>
          {icon && <Icon name={icon} size={18} className="text-blue" />}
          {title}
          {right && <span className="ml-auto font-normal">{right}</span>}
        </h4>
      )}
      {children}
    </section>
  );
}

export function Kpi({ icon, label, value, note, color, delta, good }: { icon: string; label: string; value: ReactNode; note: string; color: string; delta?: string; good?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center gap-2 text-[12.5px] font-semibold text-muted">
        <i className="grid size-[30px] place-items-center rounded-[9px]" style={{ background: `${color}22`, color }}>
          <Icon name={icon} size={17} />
        </i>
        {label}
      </div>
      <div className="mt-2.5 text-[27px] font-extrabold tracking-[-.5px]">{value}</div>
      <div className={cn('mt-0.5 flex items-center gap-1 text-[12px] font-bold', delta ? (good ? 'text-green' : 'text-red') : 'text-muted')}>
        {delta && (
          <>
            <Icon name={good ? 'trending-up' : 'trending-down'} size={14} />
            {delta}
          </>
        )}
        <span className="font-medium text-muted">{note}</span>
      </div>
    </div>
  );
}

export const KpiGrid = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('grid grid-cols-2 gap-3.5 xl:grid-cols-4', className)}>{children}</div>
);

export function Avatar({ name, icon, size = 'sm', light, className }: { name?: string; icon?: string; size?: 'sm' | 'md' | 'lg' | 'xl'; light?: boolean; className?: string }) {
  const s = { sm: 'size-9 text-[12px] rounded-xl', md: 'size-[46px] text-[15px] rounded-[14px]', lg: 'size-[54px] text-[17px] rounded-[18px]', xl: 'size-[72px] text-[22px] rounded-[22px]' }[size];
  const ini = name ? name.replace(/^Dr\.\s/, '').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() : '';
  return (
    <div className={cn('grid shrink-0 place-items-center font-extrabold', s, light ? 'bg-sky text-blue' : 'bg-primary text-white', className)}>
      {icon ? <Icon name={icon} size={size === 'xl' ? 30 : size === 'sm' ? 17 : 22} /> : ini}
    </div>
  );
}

export function Empty({ icon = 'search-x', title, children, className }: { icon?: string; title: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center px-5 py-12 text-center text-muted', className)}>
      <Avatar icon={icon} size="xl" light />
      <h3 className="mt-3 text-[17px] text-ink">{title}</h3>
      {children && <div className="mt-1 max-w-md text-[13px]">{children}</div>}
    </div>
  );
}

export function Row({ icon, label, children }: { icon: string; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-line py-2.5 last:border-0">
      <Icon name={icon} size={17} className="text-muted" />
      <span className="flex-1 text-muted">{label}</span>
      <b className="text-right">{children}</b>
    </div>
  );
}

export const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('rounded-[18px] border border-line bg-card', className)}>{children}</div>
);

export function Spinner({ className }: { className?: string }) {
  return <Icon name="loader-circle" className={cn('animate-spin text-blue', className)} />;
}

export function Loading({ label }: { label?: string }) {
  const t = useT(common);
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-muted">
      <Spinner />
      {label ?? t('loading')}
    </div>
  );
}

/** The DYH wordmark (vector port of the prototype logo). */
export function Logo({ height = 44, light }: { height?: number; light?: boolean }) {
  const c = light ? '#ffffff' : '#1b3a6b';
  const tc = light ? '#1b3a6b' : '#ffffff';
  return (
    <svg viewBox="0 0 214 90" height={height} role="img" aria-label="Dr. Yanga's Hospital Inc.">
      <path d="M30 8H52V22H68V44H52V58H30V44H14V22H30Z" fill="none" stroke={c} strokeWidth="3.2" strokeLinejoin="round" />
      <rect x="29" y="25" width="25" height="16" rx="6" fill="none" stroke={c} strokeWidth="3.2" />
      <text x="70" y="58" fontFamily="Arial Black,Arial,Helvetica,sans-serif" fontWeight="900" fontSize="57" fill={c} letterSpacing="-1">
        DYH
      </text>
      <rect x="8" y="66" width="198" height="19" fill={c} />
      <text x="107" y="80" textAnchor="middle" fontFamily="Arial,Helvetica,sans-serif" fontWeight="700" fontSize="11.6" fill={tc} letterSpacing="1.1">
        DR. YANGA'S HOSPITAL INC.
      </text>
    </svg>
  );
}

/** Slot indicator: how many of a room's parallel slots are taken. */
export function SlotBar({ cap, used }: { cap: number; used: number }) {
  return (
    <span className="inline-flex gap-[3px]" aria-label={`${used}/${cap}`}>
      {Array.from({ length: cap }, (_, k) => (
        <i key={k} className={cn('block h-2 w-3.5 rounded-[3px]', k < used ? 'bg-blue' : 'bg-line')} />
      ))}
    </span>
  );
}

export function Delta({ value, good }: { value: string; good: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[12px] font-bold', good ? 'text-green' : 'text-red')}>
      <Icon name={good ? 'arrow-up-right' : 'arrow-down-right'} size={14} />
      {value}
    </span>
  );
}

export function CredBadges({ creds }: { creds: string[] }) {
  return (
    <span className="mt-0.5 flex flex-wrap gap-[3px]">
      {creds.map((c) => (
        <Badge key={c} tone="teal" className="px-1.5 py-px text-[10px]">
          {c}
        </Badge>
      ))}
    </span>
  );
}
