import { Dialog as RDialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { common, useT } from '@dyh/i18n';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  icon?: string;
  children: ReactNode;
  /** Footer actions; buttons stretch to equal width like the prototype modals. */
  actions?: ReactNode;
  wide?: boolean;
  description?: string;
}

export function Modal({ open, onOpenChange, title, icon, children, actions, wide, description }: ModalProps) {
  const t = useT(common);
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-40 bg-[#0a1424]/55 backdrop-blur-[2px]" />
        <RDialog.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-3xl border border-line bg-card shadow-lift outline-none',
            wide ? 'max-w-[720px]' : 'max-w-[520px]',
          )}
        >
          <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
            {icon && (
              <span className="grid size-9 place-items-center rounded-xl bg-sky text-blue">
                <Icon name={icon} size={19} />
              </span>
            )}
            <RDialog.Title className="flex-1 text-[17px] font-bold">{title}</RDialog.Title>
            <RDialog.Close className="grid size-9 place-items-center rounded-xl bg-soft text-ink hover:brightness-95" aria-label={t('close')}>
              <Icon name="x" size={18} />
            </RDialog.Close>
          </div>
          {description && <RDialog.Description className="sr-only">{description}</RDialog.Description>}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {actions && <div className="flex gap-2.5 border-t border-line px-5 py-3.5 [&>button]:flex-1">{actions}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
