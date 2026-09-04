'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import {
  ExecutiveFilters,
  CompleteExecutiveData,
} from '@/lib/executive-intelligence/executive-types';
import { fetchExecutiveIntelligenceData } from '@/lib/executive-intelligence/executive-data-service';
import { ExecutiveFilterBar } from './executive-filter-bar';
import { ExecutiveSnapshotCards } from './executive-snapshot-cards';
import { CustomerIntelligence } from './customer-intelligence';
import { ProductIntelligence } from './product-intelligence';
import { SalesTrends } from './sales-trends';
import { WarehouseIntelligence } from './warehouse-intelligence';
import { ProductionIntelligence } from './production-intelligence';
import { FinancialIntelligence } from './financial-intelligence';
import { SmartRecommendations } from './smart-recommendations';
import { ExecutiveCompareMode } from './executive-compare-mode';
import { Button } from '@/components/ui/button';
import {
  Sparkles, Users, Package, TrendingUp,
  Building2, ScanLine, DollarSign, ArrowLeftRight,
  RefreshCcw, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRealtimeDashboard } from '@/hooks/use-realtime-dashboard';

export type ExecutiveSection =
  | 'overview'
  | 'customers'
  | 'products'
  | 'trends'
  | 'warehouses'
  | 'production'
  | 'finances'
  | 'recommendations'
  | 'compare';

const SECTION_TABS: { id: ExecutiveSection; label: string; icon: any }[] = [
  { id: 'overview', label: 'Executive Overview', icon: Sparkles },
  { id: 'customers', label: 'Customer Intelligence', icon: Users },
  { id: 'products', label: 'Product Velocity', icon: Package },
  { id: 'trends', label: 'Sales Trends', icon: TrendingUp },
  { id: 'finances', label: 'Financials & AR Aging', icon: DollarSign },
  { id: 'warehouses', label: 'Warehouse Network', icon: Building2 },
  { id: 'production', label: 'Production Floor', icon: ScanLine },
  { id: 'recommendations', label: 'Smart Insights', icon: Sparkles },
  { id: 'compare', label: 'Compare Mode', icon: ArrowLeftRight },
];

export function ExecutiveDashboardPro() {
  const { profile } = useAuth();
  const [activeSection, setActiveSection] = useState<ExecutiveSection>('overview');
  const [filters, setFilters] = useState<ExecutiveFilters>({
    datePreset: 'last_30_days',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CompleteExecutiveData | null>(null);

  // Strict role protection check
  if (profile?.role !== 'admin') {
    return (
      <div className="p-8 text-center bg-card rounded-xl border border-border">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
        <h3 className="text-base font-bold text-foreground">Access Restricted</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Executive Intelligence Pro is restricted to users with the Admin role.
        </p>
      </div>
    );
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchExecutiveIntelligenceData(filters);
      setData(result);
    } catch (err: any) {
      console.error('Failed to load executive intelligence:', err);
      setError(err?.message || 'Error compiling executive analytics');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime updates
  useRealtimeDashboard({
    tables: [
      { table: 'orders' },
      { table: 'payments' },
      { table: 'production_scans', event: 'INSERT' },
      { table: 'dispatches', event: 'INSERT' },
    ],
    onUpdate: loadData,
  });

  return (
    <div className="space-y-6">
      {/* ─── SECTION NAVIGATION TABS ─── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border/80 scrollbar-none">
        {SECTION_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap min-h-[38px]',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─── PART 1: UNIVERSAL EXECUTIVE FILTER BAR ─── */}
      <ExecutiveFilterBar
        filters={filters}
        onChange={(newFilters) => setFilters(newFilters)}
        filterOptions={
          data?.filterOptions || {
            warehouses: [],
            products: [],
            customers: [],
            paymentTypes: [],
            orderStatuses: [],
          }
        }
        isLoading={loading}
      />

      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-semibold">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
          <div className="h-72 rounded-xl bg-muted/40 animate-pulse" />
          <div className="h-96 rounded-xl bg-muted/40 animate-pulse" />
        </div>
      ) : data ? (
        <div className="space-y-8">
          {/* Overview Mode: Snapshot Cards + Recommendations + Top Summaries */}
          {activeSection === 'overview' && (
            <>
              {/* Part 2: Snapshot Cards */}
              <ExecutiveSnapshotCards snapshots={data.snapshots} />

              {/* Part 9: Smart Recommendations */}
              <SmartRecommendations recommendations={data.recommendations} />

              {/* Part 5: Sales Trends */}
              <SalesTrends salesTrends={data.salesTrends} />

              {/* Top Customer Intelligence Table */}
              <CustomerIntelligence customers={data.customers} />

              {/* Product Intelligence Table */}
              <ProductIntelligence products={data.products} />

              {/* Financial & AR Aging */}
              <FinancialIntelligence finances={data.finances} />

              {/* Warehouse Intelligence */}
              <WarehouseIntelligence warehouses={data.warehouses} />

              {/* Production Intelligence */}
              <ProductionIntelligence production={data.production} />

              {/* Compare Mode */}
              <ExecutiveCompareMode data={data} />
            </>
          )}

          {/* Individual Section Views */}
          {activeSection === 'customers' && (
            <CustomerIntelligence customers={data.customers} />
          )}

          {activeSection === 'products' && (
            <ProductIntelligence products={data.products} />
          )}

          {activeSection === 'trends' && (
            <SalesTrends salesTrends={data.salesTrends} />
          )}

          {activeSection === 'finances' && (
            <FinancialIntelligence finances={data.finances} />
          )}

          {activeSection === 'warehouses' && (
            <WarehouseIntelligence warehouses={data.warehouses} />
          )}

          {activeSection === 'production' && (
            <ProductionIntelligence production={data.production} />
          )}

          {activeSection === 'recommendations' && (
            <SmartRecommendations recommendations={data.recommendations} />
          )}

          {activeSection === 'compare' && (
            <ExecutiveCompareMode data={data} />
          )}
        </div>
      ) : null}
    </div>
  );
}
