'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Download, FileText, Table, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { exportToCsv, exportToExcel, exportToPDF } from '@/lib/export';

interface ExportDropdownProps {
  filenameBase: string; // e.g. "orders" -> will become "orders_2026-08-18.pdf"
  title: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  disabled?: boolean;
  onExport?: (type: 'pdf' | 'excel' | 'csv') => boolean | void | Promise<boolean | void>;
}

export function ExportDropdown({ 
  filenameBase, 
  title, 
  headers, 
  rows, 
  className,
  variant = "outline",
  disabled = false,
  onExport
}: ExportDropdownProps) {
  const { profile } = useAuth();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (type: 'pdf' | 'excel' | 'csv') => {
    setIsExporting(true);
    
    try {
      if (onExport) {
        const handled = await onExport(type);
        if (handled) return;
      }

      if (!rows || rows.length === 0) {
        toast.info('No data available to export.');
        return;
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `${filenameBase}_${dateStr}`;
      const userName = profile?.full_name || 'System User';
      const userRole = profile?.role || 'user';

      if (type === 'pdf') {
        exportToPDF(`${filename}.pdf`, headers, rows, title, userName, userRole);
        toast.success('PDF generated successfully');
      } else if (type === 'excel') {
        exportToExcel(`${filename}.xlsx`, 'Report Data', headers, rows, title, userName, userRole);
        toast.success('Excel generated successfully');
      } else if (type === 'csv') {
        exportToCsv(`${filename}.csv`, headers, rows);
        toast.success('CSV generated successfully');
      }
    } catch (error) {
      console.error(`Error exporting ${type}:`, error);
      toast.error(`Unable to generate ${type.toUpperCase()} file. Please try again.`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} className={className} disabled={disabled || isExporting}>
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? 'Exporting...' : 'Export'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => handleExport('pdf')} className="cursor-pointer">
          <FileText className="mr-2 h-4 w-4 text-red-500" />
          <span>Export to PDF</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('excel')} className="cursor-pointer">
          <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-500" />
          <span>Export to Excel</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('csv')} className="cursor-pointer">
          <Table className="mr-2 h-4 w-4 text-slate-500" />
          <span>Export to CSV</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
