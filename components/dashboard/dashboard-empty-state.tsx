'use client';

import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileQuestion } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardEmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function DashboardEmptyState({ title, description, icon, action, className }: DashboardEmptyStateProps) {
  return (
    <Card className={cn("border-dashed shadow-sm bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800", className)}>
      <CardContent className="flex flex-col items-center justify-center p-8 text-center min-h-[250px]">
        <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500 shadow-sm mb-4 border border-slate-100 dark:border-slate-700">
          {icon || <FileQuestion className="w-8 h-8" />}
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-sm">
          {description}
        </p>
        {action && <div className="mt-6">{action}</div>}
      </CardContent>
    </Card>
  );
}
