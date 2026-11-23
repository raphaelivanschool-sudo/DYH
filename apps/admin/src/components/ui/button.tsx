import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';

/** Button variants mirror the prototype: p(rimary), n(avy), o(utline), g(host), r(ed), ok. */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-bold transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-2',
  {
    variants: {
      variant: {
        p: 'bg-primary text-white hover:brightness-110',
        n: 'bg-navy text-white hover:brightness-110',
        o: 'border-[1.5px] border-line bg-card text-ink hover:bg-sky-2',
        g: 'bg-sky text-blue hover:brightness-95',
        r: 'bg-red-bg text-red hover:brightness-95',
        ok: 'bg-[#12805a] text-white hover:brightness-110',
        link: 'p-0 text-blue hover:underline',
      },
      size: {
        sm: 'rounded-[10px] px-3 py-[9px] text-[13px]',
        md: 'rounded-[14px] px-[18px] py-3 text-[14px]',
        lg: 'rounded-2xl px-[22px] py-4 text-[16px]',
        icon: 'size-9 rounded-[10px]',
      },
    },
    compoundVariants: [{ variant: 'link', className: 'px-0 py-0' }],
    defaultVariants: { variant: 'p', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  icon?: string;
  iconRight?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, icon, iconRight, children, type = 'button', ...props }, ref) => (
  <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props}>
    {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
    {children}
    {iconRight && <Icon name={iconRight} size={size === 'sm' ? 16 : 18} />}
  </button>
));
Button.displayName = 'Button';

export function IconButton({ icon, label, dot, className, ...props }: { icon: string; label: string; dot?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" title={label} aria-label={label} className={cn('relative grid size-10 place-items-center rounded-xl bg-soft text-ink hover:brightness-95', className)} {...props}>
      <Icon name={icon} size={19} />
      {dot && <span className="absolute right-2 top-2 size-2 rounded-full bg-red ring-2 ring-card" />}
    </button>
  );
}
