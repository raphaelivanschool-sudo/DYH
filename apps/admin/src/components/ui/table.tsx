import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { common, useT } from '@dyh/i18n';
import { cn } from '@/lib/utils';

/** Styled table shell. Columns are plain <Th>/<Td> so pages stay readable. */
export function Table({ children, flat, className }: { children: ReactNode; flat?: boolean; className?: string }) {
  return (
    <div className={cn('overflow-x-auto bg-card', flat ? 'border-t border-line' : 'rounded-[14px] border border-line', className)}>
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  );
}

export function Th({ className, num, ...p }: ThHTMLAttributes<HTMLTableCellElement> & { num?: boolean }) {
  return <th className={cn('whitespace-nowrap border-b border-line bg-sky-2 px-3.5 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[.05em] text-muted', num && 'text-right', className)} {...p} />;
}

export function Td({ className, num, nowrap, ...p }: TdHTMLAttributes<HTMLTableCellElement> & { num?: boolean; nowrap?: boolean }) {
  return <td className={cn('border-b border-line px-3.5 py-[11px] align-middle [tr:last-child>&]:border-0', num && 'text-right', nowrap && 'whitespace-nowrap', className)} {...p} />;
}

export function EmptyRow({ cols, show }: { cols: number; show: boolean }) {
  const t = useT(common);
  if (!show) return null;
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-10 text-center text-[13px] text-muted">
        {t('noResults')}
      </td>
    </tr>
  );
}

export function ListEmpty({ show }: { show: boolean }) {
  const t = useT(common);
  if (!show) return null;
  return <div className="py-8 text-center text-[13px] text-muted">{t('noResults')}</div>;
}
