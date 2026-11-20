import { forwardRef, useEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Loader2, MoreHorizontal, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger' | 'subtle';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-onaccent border border-transparent hover:bg-accent/90 active:bg-accent/80 font-semibold',
  outline: 'border border-line bg-panel text-ink hover:border-muted/50 hover:bg-panel2',
  ghost: 'border border-transparent text-ink2 hover:bg-panel2 hover:text-ink',
  danger: 'border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20',
  subtle: 'border border-transparent bg-panel2 text-ink hover:bg-active',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[12.5px] gap-1.5 rounded-btn',
  md: 'h-9.5 px-3.5 text-[13px] gap-2 rounded-btn',
  lg: 'h-11 px-5 text-sm gap-2 rounded-btn',
  icon: 'h-9 w-9 rounded-btn',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading = false, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={props.type ?? 'button'}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap transition-[background-color,border-color,color,transform] duration-200 ease-calm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, label, active, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={props.type ?? 'button'}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        'inline-flex h-8.5 w-8.5 items-center justify-center rounded-btn transition-colors duration-150 ease-calm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        active ? 'bg-active text-accent' : 'text-ink2 hover:bg-panel2 hover:text-ink',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});

export const inputClass =
  'w-full rounded-input border border-line bg-panel2 px-3 py-2 text-sm text-ink transition-colors placeholder:text-muted/80 hover:border-muted/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(inputClass, 'h-9.5', className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 3, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={cn(inputClass, 'resize-y leading-relaxed', className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <div className="relative inline-flex">
      <select
        ref={ref}
        className={cn(inputClass, 'h-9.5 cursor-pointer appearance-none pr-8 text-[13px]', className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
    </div>
  );
});

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[12px] font-semibold tracking-wide text-ink2">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[11.5px] text-danger">{error}</p>
      ) : hint ? (
        <p className="text-[11.5px] leading-relaxed text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'warm' | 'danger';
  className?: string;
}) {
  const tones = {
    neutral: 'border-line bg-panel2 text-ink2',
    accent: 'border-accent/30 bg-accent/10 text-accent',
    warm: 'border-accent2/30 bg-accent2/10 text-accent2',
    danger: 'border-danger/30 bg-danger/10 text-danger',
  } as const;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.1em]',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 size={16} className={cn('animate-spin text-muted', className)} aria-hidden="true" />;
}

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: ReactNode;
  hint?: string;
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  className,
  size = 'md',
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('inline-flex items-center gap-0.5 rounded-input border border-line bg-panel2 p-0.5', className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            role="tab"
            aria-selected={active}
            type="button"
            title={option.hint}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative inline-flex items-center justify-center gap-1.5 rounded-[7px] font-medium transition-colors duration-150 ease-calm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
              size === 'sm' ? 'h-7 px-2.5 text-[11.5px]' : 'h-8 px-3.5 text-[12.5px]',
              active ? 'text-ink' : 'text-ink2 hover:text-ink',
            )}
          >
            {active && (
              <motion.span
                layoutId={`segmented-${label.replace(/\s+/g, '-')}`}
                className="absolute inset-0 rounded-[7px] border border-line/70 bg-panel shadow-[0_1px_2px_rgba(0,0,0,0.18)]"
                transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-panel border border-dashed border-line/90 bg-panel/40 px-6 py-14 text-center',
        className,
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-card border border-line bg-panel text-muted">
        <Icon size={19} aria-hidden="true" />
      </div>
      <div className="max-w-sm">
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink2">{description}</p>
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export interface MenuItem {
  label?: string;
  icon?: LucideIcon;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
}

export function Menu({
  items,
  label = 'More options',
  align = 'right',
  trigger,
}: {
  items: MenuItem[];
  label?: string;
  align?: 'left' | 'right';
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-flex">
      {trigger ? (
        <span onClick={() => setOpen((value) => !value)} className="inline-flex">
          {trigger}
        </span>
      ) : (
        <IconButton label={label} active={open} onClick={() => setOpen((value) => !value)} aria-haspopup="menu" aria-expanded={open}>
          <MoreHorizontal size={16} />
        </IconButton>
      )}
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label={label}
            initial={{ opacity: 0, y: -4, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.985 }}
            transition={{ duration: 0.15, ease: [0.22, 0.61, 0.36, 1] }}
            className={cn(
              'absolute top-[calc(100%+4px)] z-40 w-52 overflow-hidden rounded-card border border-line bg-panel p-1 shadow-modal',
              align === 'right' ? 'right-0' : 'left-0',
            )}
          >
            {items.map((item, index) => (
              <div key={`${item.label ?? 'separator'}-${index}`}>
                {item.separator && <div className="my-1 border-t border-line" />}
                {item.label && <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onClick?.();
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 text-left text-[12.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                    item.danger ? 'text-danger hover:bg-danger/10' : 'text-ink2 hover:bg-panel2 hover:text-ink',
                  )}
                >
                  {item.icon && <item.icon size={14} className="shrink-0" aria-hidden="true" />}
                  <span className="truncate">{item.label}</span>
                </button>}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder = 'Search…',
  className,
  ariaLabel,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className={cn('relative flex items-center', className)}>
      <Search size={15} className="pointer-events-none absolute left-3 text-muted" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        autoFocus={autoFocus}
        className={cn(inputClass, 'h-9.5 pl-9 pr-8 text-[13px] [&::-webkit-search-cancel-button]:hidden')}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 rounded p-1 text-[10px] text-muted hover:text-ink"
        >
          Clear
        </button>
      )}
    </div>
  );
}

export function CheckRow({
  checked,
  onChange,
  children,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  id: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-2.5 text-[12.5px] text-ink2 transition-colors hover:text-ink"
    >
      <span
        className={cn(
          'flex h-4 w-4 items-center justify-center rounded-[4px] border transition-colors',
          checked ? 'border-accent bg-accent text-onaccent' : 'border-line bg-panel2 text-transparent',
        )}
      >
        <Check size={11} strokeWidth={3} aria-hidden="true" />
      </span>
      <input
        id={id}
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {children}
    </label>
  );
}

export function ProgressBar({ value, className, tone = 'accent' }: { value: number; className?: string; tone?: 'accent' | 'warm' | 'danger' }) {
  const tones = { accent: 'bg-accent', warm: 'bg-accent2', danger: 'bg-danger' } as const;
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-panel2', className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div
        className={cn('h-full rounded-full', tones[tone])}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
    </div>
  );
}
