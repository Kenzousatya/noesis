import { cn } from '../lib/utils';

/**
 * NOEMA mark — a custom Greek Lambda drawn as one flat silhouette:
 * a slanted architectural apex, a heavier left stroke and a lighter right
 * stroke, both closing on straight plinth-like feet. The geometry is shared
 * with public/favicon.svg.
 */
export const LAMBDA_PATH = 'M24.6 6 L39.2 10.6 L56 56 L47 56 L31.6 14.3 L17 56 L7 56 Z';

interface LambdaMarkProps {
  className?: string;
  size?: number;
  title?: string;
}

export function LambdaMark({ className, size = 28, title }: LambdaMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      fill="currentColor"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <path d={LAMBDA_PATH} />
    </svg>
  );
}

const WORDMARK_SIZES = {
  sm: 'text-[13px] tracking-[0.22em] -mr-[0.22em]',
  md: 'text-[16px] tracking-[0.17em] -mr-[0.17em]',
  lg: 'text-[24px] tracking-[0.15em] -mr-[0.15em]',
} as const;

export function Wordmark({
  className,
  size = 'md',
}: {
  className?: string;
  size?: keyof typeof WORDMARK_SIZES;
}) {
  return (
    <span
      className={cn(
        'select-none whitespace-nowrap font-serif uppercase leading-none text-ink',
        WORDMARK_SIZES[size],
        className,
      )}
    >
      Noema
    </span>
  );
}

export function BrandLockup({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="flex h-9 w-9 items-center justify-center text-accent">
        <LambdaMark size={27} title="NOEMA" />
      </span>
      <span className="flex min-w-0 flex-col">
        <Wordmark />
        <span className="mt-1.5 truncate text-[8px] font-semibold uppercase tracking-[0.2em] text-muted">
          Collect · Cultivate
        </span>
      </span>
    </div>
  );
}

export function LoadingScreen() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 bg-bg">
      <div className="atmosphere" aria-hidden="true" />
      <div className="relative flex flex-col items-center gap-5">
        <LambdaMark size={46} className="text-accent motion-safe:animate-pulse" title="NOEMA" />
        <div className="flex flex-col items-center gap-2.5">
          <Wordmark size="md" />
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted">Νοήμα · opening the archive</p>
        </div>
      </div>
    </div>
  );
}
