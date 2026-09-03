'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  History, Search, RefreshCw, Package,
  Truck, CheckCircle2, Undo2, ScanLine
} from 'lucide-react';
import { ExportDropdown } from '@/components/export-dropdown';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { UniversalFilterState } from './report-filter-bar';

interface OperationsLogExplorerProps {
  filters: UniversalFilterState;
}

interface LogEntry {
  id: string;
  source: 'barcode' | 'order' | 'dispatch' | 'return';
  timestamp: string;
  action: string;
  details: string;
  reference: string;
  operator: string;
}

export function OperationsLogExplorer({ filters }: OperationsLogExplorerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const start = filters.dateFrom ? `${filters.dateFrom}T00:00:00Z` : '2025-01-01T00:00:00Z';
      const end = filters.dateTo ? `${filters.dateTo}T23:59:59Z` : new Date().toISOString();

      const [bcRes, ordersRes, dispatchesRes, returnsRes] = await Promise.all([
        supabase
          .from('barcode_history')
          .select('id, barcode, action, details, performed_at, actor:profiles(full_name)')
          .gte('performed_at', start)
          .lte('performed_at', end)
          .limit(100),
        supabase
          .from('orders')
          .select('id, order_number, status, total_amount, created_at, customer:customers(customer_name)')
          .gte('created_at', start)
          .lte('created_at', end)
          .limit(100),
        supabase
          .from('dispatches')
          .select('id, vehicle_number, driver_name, dispatched_at, order:orders(order_number)')
          .gte('dispatched_at', start)
          .lte('dispatched_at', end)
          .limit(100),
        supabase
          .from('returns')
          .select('id, return_type, reason, created_at, order:orders(order_number)')
          .gte('created_at', start)
          .lte('created_at', end)
          .limit(100),
      ]);

      const list: LogEntry[] = [];

      bcRes.data?.forEach((b: any) => {
        list.push({
          id: `bc-${b.id}`,
          source: 'barcode',
          timestamp: b.performed_at,
          action: b.action.replace(/_/g, ' '),
          details: b.details || 'Barcode stage event',
          reference: b.barcode,
          operator: b.actor?.full_name || 'System Operator',
        });
      });

      ordersRes.data?.forEach((o: any) => {
        list.push({
          id: `ord-${o.id}`,
          source: 'order',
          timestamp: o.created_at,
          action: `Order ${o.status.toUpperCase()}`,
          details: `Customer: ${o.customer?.customer_name || 'Unknown'} (ETB ${o.total_amount})`,
          reference: o.order_number,
          operator: 'Sales / System',
        });
      });

      dispatchesRes.data?.forEach((d: any) => {
        list.push({
          id: `dsp-${d.id}`,
          source: 'dispatch',
          timestamp: d.dispatched_at,
          action: 'Outbound Loaded',
          details: `Vehicle: ${d.vehicle_number || 'Truck'} • Driver: ${d.driver_name || 'Driver'}`,
          reference: (d.order as any)?.order_number || 'Dispatch Batch',
          operator: 'Logistics Team',
        });
      });

      returnsRes.data?.forEach((r: any) => {
        list.push({
          id: `ret-${r.id}`,
          source: 'return',
          timestamp: r.created_at,
          action: `Return: ${r.return_type}`,
          details: r.reason || 'Warehouse return inspection',
          reference: (r.order as any)?.order_number || 'RMA Item',
          operator: 'Warehouse QA',
        });
      });

      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(list);
    } catch (e) {
      console.error('Failed to load operational logs:', e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredLogs = useMemo(() => {
    const q = search.toLowerCase();
    return logs.filter((l) => {
      if (sourceFilter !== 'all' && l.source !== sourceFilter) return false;
      if (!q) return true;
      return (
        l.action.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q) ||
        l.reference.toLowerCase().includes(q) ||
        l.operator.toLowerCase().includes(q)
      );
    });
  }, [logs, search, sourceFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 p-4 rounded-2xl border border-border/80">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Operations Log Explorer
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Unified chronological audit trail across barcode events, orders, dispatches, and returns.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportDropdown
            filenameBase="operations_log_explorer"
            title="2BF Operations Log Explorer"
            headers={['Timestamp', 'Channel', 'Action', 'Reference', 'Details', 'Operator']}
            rows={filteredLogs.map((l) => [formatDate(l.timestamp), l.source.toUpperCase(), l.action, l.reference, l.details, l.operator])}
            variant="outline"
            className="h-9"
          />

          <Button variant="ghost" size="sm" onClick={loadData} disabled={loading} className="h-9 text-xs touch-press">
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      <Card className="shadow-xs border-border/80">
        <CardHeader className="p-4 pb-3 border-b border-border/60">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search logs by action, barcode, order number, or operator..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-full sm:w-44 h-9 text-xs">
                <SelectValue placeholder="All Channels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="barcode">Barcode Passport</SelectItem>
                <SelectItem value="order">Sales Orders</SelectItem>
                <SelectItem value="dispatch">Dispatches</SelectItem>
                <SelectItem value="return">Returns</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Timestamp</TableHead>
                  <TableHead className="text-xs">Channel</TableHead>
                  <TableHead className="text-xs">Action</TableHead>
                  <TableHead className="text-xs">Reference</TableHead>
                  <TableHead className="text-xs">Details</TableHead>
                  <TableHead className="text-xs">Operator</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                      No operational logs found matching your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap py-2.5">
                        {formatDate(item.timestamp)}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {item.source}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-semibold py-2.5">{item.action}</TableCell>
                      <TableCell className="font-mono text-xs font-bold text-primary py-2.5">{item.reference}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-sm truncate py-2.5">{item.details}</TableCell>
                      <TableCell className="text-xs text-muted-foreground py-2.5">{item.operator}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
