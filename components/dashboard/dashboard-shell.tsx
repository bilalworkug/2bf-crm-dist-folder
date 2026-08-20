'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DashboardShellProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function DashboardShell({ children, className, ...props }: DashboardShellProps) {
  return (
    <div className={cn("flex-1 space-y-6 p-4 md:p-8 pt-6 min-h-screen bg-slate-50 dark:bg-slate-950", className)} {...props}>
      {children}
    </div>
  );
}
