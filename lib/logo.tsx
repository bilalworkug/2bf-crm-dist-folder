import { cn } from './utils';
import Image from 'next/image';

interface LogoProps {
  className?: string;
  showText?: boolean;
  variant?: 'full' | 'mark';
}

export function Logo({ className, showText = true, variant = 'full' }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-border">
        <Image
          src="/logo.jpg"
          alt="Two Brothers Food Complex Logo"
          width={64}
          height={64}
          className="object-contain p-0.5"
        />
      </div>
      {showText && variant === 'full' && (
        <div className="flex flex-col leading-none text-left">
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
