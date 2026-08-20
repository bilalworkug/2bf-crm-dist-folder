'use client';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { RefreshCcw, FileText, Download } from 'lucide-react';
import { Logo } from '@/lib/logo';
import { toast } from 'sonner';

interface DashboardHeaderProps {
  userName: string;
  userRole: string;
  onRefresh: () => void;
  onExportPDF: () => Promise<void> | void;
  onExportExcel: () => Promise<void> | void;
}

import { NotificationsPopover } from '@/components/dashboard/notifications-popover';

export function DashboardHeader({ userName, userRole, onRefresh, onExportPDF, onExportExcel }: DashboardHeaderProps) {
  
  const handlePDF = async () => {
    try {
      toast.info('Generating PDF...');
      await onExportPDF();
      toast.success('PDF Export Successful');
    } catch (e: any) {
      console.error('PDF Export Error:', e);
      toast.error(e?.message || 'Failed to generate PDF');
    }
  };

  const handleExcel = async () => {
    try {
      toast.info('Generating Excel...');
      await onExportExcel();
      toast.success('Excel Export Successful');
    } catch (e: any) {
      console.error('Excel Export Error:', e);
      toast.error(e?.message || 'Failed to generate Excel');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
      <div className="flex items-start sm:items-center gap-4 flex-col sm:flex-row">
        <div className="w-14 h-14 shrink-0 bg-white dark:bg-slate-900 rounded-xl p-2.5 shadow-sm flex items-center justify-center border border-slate-200 dark:border-slate-800">
           <Logo className="w-full h-full text-primary" />
        </div>
        <div className="flex flex-col space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white break-words">
            Good morning, {userName}
          </h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 capitalize flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {userRole.replace('_', ' ')}
            </span>
            <span>•</span>
            <span>{format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
          </p>
        </div>
      </div>
      
      <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
        <NotificationsPopover />
        <Button variant="outline" onClick={onRefresh} className="h-10 px-4 bg-white dark:bg-slate-900 shadow-sm">
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
        <Button variant="outline" onClick={handlePDF} className="h-10 px-4 bg-white dark:bg-slate-900 shadow-sm border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-900/30">
          <FileText className="mr-2 h-4 w-4 text-rose-500" />
          Export PDF
        </Button>
        <Button variant="outline" onClick={handleExcel} className="h-10 px-4 bg-white dark:bg-slate-900 shadow-sm border-emerald-200 dark:border-emerald-900 hover:bg-emerald-50 dark:hover:bg-emerald-900/30">
          <Download className="mr-2 h-4 w-4 text-emerald-500" />
          Export Excel
        </Button>
      </div>
    </div>
  );
}
