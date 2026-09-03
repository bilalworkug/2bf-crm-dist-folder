'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  BarChart3, TrendingUp, ScanLine, Boxes,
  DollarSign, FileText, Clock, Award, History, Layers
} from 'lucide-react';

import {
  ReportFilterBar,
  INITIAL_FILTERS,
  type UniversalFilterState,
} from '@/components/reports/report-filter-bar';

// Report Modules
import { ExecutiveKpiReport } from '@/components/reports/executive-kpi-report';
import { SalesIntelligenceReport } from '@/components/reports/sales-intelligence-report';
import { ProductionIntelligenceReport } from '@/components/reports/production-intelligence-report';
import { WarehouseIntelligenceReport } from '@/components/reports/warehouse-intelligence-report';
import { FinancialIntelligenceReport } from '@/components/reports/financial-intelligence-report';
import { CustomerStatementGenerator } from '@/components/reports/customer-statement-generator';
import { BarcodeAnalyticsReport } from '@/components/reports/barcode-analytics-report';
import { ProfitabilityDashboard } from '@/components/reports/profitability-dashboard';
import { ScheduledReportsManager } from '@/components/reports/scheduled-reports-manager';
import { OperationsLogExplorer } from '@/components/reports/operations-log-explorer';

export default function ReportsPage() {
  const { profile, loading: authLoading } = useAuth();
  const [filters, setFilters] = useState<UniversalFilterState>(INITIAL_FILTERS);

  // Entities for filters
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [warehouses, setWarehouses] = useState<{ id: string; code: string }[]>([]);
  const [customers, setCustomers] = useState<{ id: string; customer_name: string }[]>([]);

  useEffect(() => {
    (async () => {
      const [p, w, c] = await Promise.all([
        supabase.from('products').select('id, name').order('name'),
        supabase.from('warehouses').select('id, code').order('code'),
        supabase.from('customers').select('id, customer_name').order('customer_name'),
      ]);
      setProducts(p.data || []);
      setWarehouses(w.data || []);
      setCustomers(c.data || []);
    })();
  }, []);

  if (authLoading) return <div className="p-12 text-center text-sm text-muted-foreground">Loading reports center...</div>;
  if (!profile) return null;

  const role = profile.role;
  const isProd = role === 'production';
  const isWh = role === 'warehouse';

  if (isProd || isWh) {
    return (
      <div className="p-8 text-center text-rose-600 font-bold">
        403 — Unauthorized. You do not have permission to view executive reports.
      </div>
    );
  }

  const isSales = role === 'sales' || role === 'sales_manager';
  const isAccounts = role === 'accounts' || role === 'accounts_manager';
  const hasFullAccess = role === 'admin' || role === 'manager' || role === 'reports';

  const defaultTab = hasFullAccess
    ? 'executive'
    : isAccounts
    ? 'finance'
    : isSales
    ? 'sales'
    : role === 'production_manager'
    ? 'production'
    : 'executive';

  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageHeader
          title="Business Intelligence & Executive Reports"
          description="Enterprise analytics, profitability insights, AR aging, customer statements, and print-ready exports."
        />
      </div>

      {/* Universal Sticky Filter Bar */}
      <ReportFilterBar
        filters={filters}
        setFilters={setFilters}
        warehouses={warehouses}
        products={products}
        customers={customers}
      />

      <Tabs defaultValue={defaultTab} className="w-full space-y-4">
        {/* Navigation Tabs Bar */}
        <div className="border-b border-border/80 pb-2 no-print overflow-x-auto">
          <TabsList className="h-10 w-max justify-start flex-nowrap bg-muted/50 p-1 rounded-xl">
            {hasFullAccess && (
              <TabsTrigger value="executive" className="text-xs flex items-center gap-1.5 touch-press">
                <BarChart3 className="h-3.5 w-3.5" />
                Executive KPI
              </TabsTrigger>
            )}

            {(hasFullAccess || isSales || isAccounts) && (
              <TabsTrigger value="sales" className="text-xs flex items-center gap-1.5 touch-press">
                <TrendingUp className="h-3.5 w-3.5" />
                Sales Intelligence
              </TabsTrigger>
            )}

            {(hasFullAccess || role === 'production_manager') && (
              <TabsTrigger value="production" className="text-xs flex items-center gap-1.5 touch-press">
                <ScanLine className="h-3.5 w-3.5" />
                Production Velocity
              </TabsTrigger>
            )}

            {(hasFullAccess || role === 'warehouse_manager') && (
              <TabsTrigger value="warehouse" className="text-xs flex items-center gap-1.5 touch-press">
                <Boxes className="h-3.5 w-3.5" />
                Warehouse Health
              </TabsTrigger>
            )}

            {(hasFullAccess || isAccounts) && (
              <TabsTrigger value="finance" className="text-xs flex items-center gap-1.5 touch-press">
                <DollarSign className="h-3.5 w-3.5" />
                Financial & AR Aging
              </TabsTrigger>
            )}

            {(hasFullAccess || isSales || isAccounts) && (
              <TabsTrigger value="statements" className="text-xs flex items-center gap-1.5 touch-press">
                <FileText className="h-3.5 w-3.5" />
                Customer Statements
              </TabsTrigger>
            )}

            <TabsTrigger value="barcode" className="text-xs flex items-center gap-1.5 touch-press">
              <Layers className="h-3.5 w-3.5" />
              Barcode Analytics
            </TabsTrigger>

            {hasFullAccess && (
              <TabsTrigger value="profitability" className="text-xs flex items-center gap-1.5 touch-press">
                <Award className="h-3.5 w-3.5" />
                Profitability Insights
              </TabsTrigger>
            )}

            <TabsTrigger value="logs" className="text-xs flex items-center gap-1.5 touch-press">
              <History className="h-3.5 w-3.5" />
              Operations Logs
            </TabsTrigger>

            {hasFullAccess && (
              <TabsTrigger value="schedules" className="text-xs flex items-center gap-1.5 touch-press">
                <Clock className="h-3.5 w-3.5" />
                Scheduled Reports
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* Tab Contents */}
        {hasFullAccess && (
          <TabsContent value="executive">
            <ExecutiveKpiReport filters={filters} />
          </TabsContent>
        )}

        {(hasFullAccess || isSales || isAccounts) && (
          <TabsContent value="sales">
            <SalesIntelligenceReport filters={filters} />
          </TabsContent>
        )}

        {(hasFullAccess || role === 'production_manager') && (
          <TabsContent value="production">
            <ProductionIntelligenceReport filters={filters} />
          </TabsContent>
        )}

        {(hasFullAccess || role === 'warehouse_manager') && (
          <TabsContent value="warehouse">
            <WarehouseIntelligenceReport filters={filters} />
          </TabsContent>
        )}

        {(hasFullAccess || isAccounts) && (
          <TabsContent value="finance">
            <FinancialIntelligenceReport filters={filters} />
          </TabsContent>
        )}

        {(hasFullAccess || isSales || isAccounts) && (
          <TabsContent value="statements">
            <CustomerStatementGenerator filters={filters} customers={customers} />
          </TabsContent>
        )}

        <TabsContent value="barcode">
          <BarcodeAnalyticsReport filters={filters} />
        </TabsContent>

        {hasFullAccess && (
          <TabsContent value="profitability">
            <ProfitabilityDashboard filters={filters} />
          </TabsContent>
        )}

        <TabsContent value="logs">
          <OperationsLogExplorer filters={filters} />
        </TabsContent>

        {hasFullAccess && (
          <TabsContent value="schedules">
            <ScheduledReportsManager />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
