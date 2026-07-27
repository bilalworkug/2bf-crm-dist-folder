import { cn } from './utils';

interface LogoProps {
  className?: string;
  showText?: boolean;
  variant?: 'full' | 'mark';
}

export function Logo({ className, showText = true, variant = 'full' }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 shadow-md ring-1 ring-amber-800/20">
        <svg viewBox="0 0 48 48" className="h-7 w-7" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 36V14h6v22h-6z" fill="white" />
          <path d="M18 36V14h5l4 13 4-13h5v22h-4V20l-4 13h-2l-4-13v16h-4z" fill="white" />
          <circle cx="38" cy="12" r="3" fill="#fbbf24" stroke="white" strokeWidth="1.5" />
        </svg>
      </div>
      {showText && variant === 'full' && (
        <div className="flex flex-col leading-none">
          <span className="text-base font-bold tracking-tight text-foreground">
            Two Brothers
          </span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-500">
            Food Complex
          </span>
        </div>
      )}
      {showText && variant === 'mark' && (
        <span className="text-lg font-bold tracking-tight text-foreground">2BF</span>
      )}
    </div>
  );
}
