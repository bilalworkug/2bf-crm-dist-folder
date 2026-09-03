'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Calendar, Clock, CheckCircle2, Play,
  Plus, Trash2, Shield, FileText, Download
} from 'lucide-react';
import { toast } from 'sonner';

export interface ScheduledReportConfig {
  id: string;
  name: string;
  reportType: 'executive' | 'sales' | 'production' | 'warehouse' | 'finance';
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string; // HH:mm
  format: 'pdf' | 'excel';
  targetRole: string;
  enabled: boolean;
}

const STORAGE_KEY = '2bf_scheduled_reports_prefs';

const DEFAULT_SCHEDULES: ScheduledReportConfig[] = [
  {
    id: 'sch-1',
    name: 'Executive Morning Briefing',
    reportType: 'executive',
    frequency: 'daily',
    time: '08:00',
    format: 'pdf',
    targetRole: 'admin',
    enabled: true,
  },
  {
    id: 'sch-2',
    name: 'Weekly Accounts Receivable Aging',
    reportType: 'finance',
    frequency: 'weekly',
    time: '09:00',
    format: 'excel',
    targetRole: 'accounts_manager',
    enabled: true,
  },
  {
    id: 'sch-3',
    name: 'Factory Production Velocity Summary',
    reportType: 'production',
    frequency: 'daily',
    time: '22:30',
    format: 'pdf',
    targetRole: 'production_manager',
    enabled: true,
  },
];

export function ScheduledReportsManager() {
  const [schedules, setSchedules] = useState<ScheduledReportConfig[]>([]);
  const [openAdd, setOpenAdd] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [reportType, setReportType] = useState<ScheduledReportConfig['reportType']>('executive');
  const [frequency, setFrequency] = useState<ScheduledReportConfig['frequency']>('daily');
  const [time, setTime] = useState('08:00');
  const [reportFormat, setReportFormat] = useState<ScheduledReportConfig['format']>('pdf');
  const [targetRole, setTargetRole] = useState('admin');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSchedules(JSON.parse(stored));
      } else {
        setSchedules(DEFAULT_SCHEDULES);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SCHEDULES));
      }
    } catch {
      setSchedules(DEFAULT_SCHEDULES);
    }
  }, []);

  const save = (updated: ScheduledReportConfig[]) => {
    setSchedules(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  const handleToggle = (id: string) => {
    const updated = schedules.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
    save(updated);
    toast.success('Schedule updated');
  };

  const handleDelete = (id: string) => {
    const updated = schedules.filter((s) => s.id !== id);
    save(updated);
    toast.success('Scheduled job removed');
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Please enter a schedule name');

    const newSchedule: ScheduledReportConfig = {
      id: `sch-${Date.now()}`,
      name: name.trim(),
      reportType,
      frequency,
      time,
      format: reportFormat,
      targetRole,
      enabled: true,
    };

    save([...schedules, newSchedule]);
    toast.success('New report schedule registered');
    setName('');
    setOpenAdd(false);
  };

  const handleTriggerTest = (sch: ScheduledReportConfig) => {
    toast.success(`Generated test ${sch.format.toUpperCase()} export for "${sch.name}"`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 p-4 rounded-2xl border border-border/80">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Scheduled Reports Automation Framework
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure automated daily, weekly, and monthly PDF & Excel dispatches for executive roles.
          </p>
        </div>

        <Button onClick={() => setOpenAdd(!openAdd)} className="h-9 text-xs touch-press">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {openAdd ? 'Cancel' : 'New Schedule'}
        </Button>
      </div>

      {openAdd && (
        <Card className="shadow-xs border-primary/40 bg-card">
          <CardHeader className="p-4 pb-2 border-b border-border/60">
            <CardTitle className="text-sm font-bold">Register Automated Report Schedule</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Schedule Title</Label>
                  <Input
                    placeholder="e.g. Daily Warehouse Inventory Dispatch"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Report Type</Label>
                  <Select value={reportType} onValueChange={(v: any) => setReportType(v)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="executive">Executive KPI</SelectItem>
                      <SelectItem value="sales">Sales Intelligence</SelectItem>
                      <SelectItem value="production">Production Throughput</SelectItem>
                      <SelectItem value="warehouse">Warehouse Inventory</SelectItem>
                      <SelectItem value="finance">Financial AR Aging</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Frequency</Label>
                  <Select value={frequency} onValueChange={(v: any) => setFrequency(v)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly (Mondays)</SelectItem>
                      <SelectItem value="monthly">Monthly (1st of month)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Trigger Time</Label>
                  <Input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Export Format</Label>
                  <Select value={reportFormat} onValueChange={(v: any) => setReportFormat(v)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF Document</SelectItem>
                      <SelectItem value="excel">Excel Workbook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Recipient Group</Label>
                  <Select value={targetRole} onValueChange={setTargetRole}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrators</SelectItem>
                      <SelectItem value="manager">Plant Managers</SelectItem>
                      <SelectItem value="accounts_manager">Accounts Team</SelectItem>
                      <SelectItem value="sales_manager">Sales Executives</SelectItem>
                      <SelectItem value="production_manager">Production Leads</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setOpenAdd(false)} className="h-9 text-xs">
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="h-9 text-xs">
                  Save Schedule
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Schedule Cards List */}
      <div className="space-y-3">
        {schedules.map((sch) => (
          <div
            key={sch.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border/80 bg-card shadow-xs"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {sch.frequency} at {sch.time}
                </span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {sch.format.toUpperCase()}
                </span>
                <h4 className="text-sm font-bold text-foreground">{sch.name}</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Target: {sch.targetRole.replace(/_/g, ' ')} • Category: {sch.reportType.toUpperCase()}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTriggerTest(sch)}
                className="h-8 text-xs touch-press"
              >
                <Play className="h-3 w-3 mr-1 text-emerald-600" />
                Test Export
              </Button>

              <Button
                variant={sch.enabled ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => handleToggle(sch.id)}
                className="h-8 text-xs touch-press"
              >
                {sch.enabled ? 'Active' : 'Paused'}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(sch.id)}
                className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 touch-press"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
