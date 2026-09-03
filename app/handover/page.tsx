'use client';

import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger
} from '@/components/ui/dialog';
import {
  ClipboardList, Plus, Search, Calendar, Clock,
  CheckCircle2, AlertTriangle, User, Filter, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import {
  getShiftHandoverNotes,
  saveShiftHandoverNote,
  type ShiftHandoverNote,
  type ShiftType,
  type DepartmentType,
} from '@/lib/shift-handover-service';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function ShiftHandoverPage() {
  const { profile } = useAuth();
  const [notes, setNotes] = useState<ShiftHandoverNote[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [shiftFilter, setShiftFilter] = useState<string>('all');

  // Form state
  const [department, setDepartment] = useState<DepartmentType>('production');
  const [shift, setShift] = useState<ShiftType>('morning');
  const [handoverDate, setHandoverDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [machineStatus, setMachineStatus] = useState('');
  const [boxesCompleted, setBoxesCompleted] = useState<number>(0);
  const [issues, setIssues] = useState('');
  const [pendingTasks, setPendingTasks] = useState('');
  const [nextShiftInstructions, setNextShiftInstructions] = useState('');

  useEffect(() => {
    setNotes(getShiftHandoverNotes());
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!machineStatus.trim() && !issues.trim() && !pendingTasks.trim()) {
      return toast.error('Please enter handover notes or machine status');
    }

    const created = saveShiftHandoverNote({
      department,
      shift,
      date: handoverDate,
      machineStatus: machineStatus.trim(),
      boxesCompleted: Number(boxesCompleted) || 0,
      issues: issues.trim(),
      pendingTasks: pendingTasks.trim(),
      nextShiftInstructions: nextShiftInstructions.trim(),
      authorName: profile?.full_name || 'Shift Lead',
      authorRole: profile?.role || 'operator',
    });

    setNotes((prev) => [created, ...prev]);
    toast.success('Shift handover note recorded');
    setOpen(false);

    // Reset fields
    setMachineStatus('');
    setBoxesCompleted(0);
    setIssues('');
    setPendingTasks('');
    setNextShiftInstructions('');
  };

  const filteredNotes = useMemo(() => {
    const q = search.toLowerCase();
    return notes.filter((n) => {
      if (departmentFilter !== 'all' && n.department !== departmentFilter) return false;
      if (shiftFilter !== 'all' && n.shift !== shiftFilter) return false;
      if (!q) return true;
      return (
        n.machineStatus.toLowerCase().includes(q) ||
        n.issues.toLowerCase().includes(q) ||
        n.pendingTasks.toLowerCase().includes(q) ||
        n.nextShiftInstructions.toLowerCase().includes(q) ||
        n.authorName.toLowerCase().includes(q) ||
        n.date.includes(q)
      );
    });
  }, [notes, search, departmentFilter, shiftFilter]);

  const morningCount = notes.filter((n) => n.shift === 'morning').length;
  const afternoonCount = notes.filter((n) => n.shift === 'afternoon').length;
  const nightCount = notes.filter((n) => n.shift === 'night').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shift Handover Notes"
        description="Inter-shift communication logs between Morning, Afternoon, and Night crews."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="h-11 sm:h-10 touch-press">
                <Plus className="h-4 w-4 mr-2" /> Log Shift Handover
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Record Shift Handover</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Department *</Label>
                    <Select value={department} onValueChange={(v: DepartmentType) => setDepartment(v)}>
                      <SelectTrigger className="h-11 sm:h-10 text-base sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="production">Production</SelectItem>
                        <SelectItem value="warehouse">Warehouse</SelectItem>
                        <SelectItem value="dispatch">Dispatch</SelectItem>
                        <SelectItem value="quality">Quality</SelectItem>
                        <SelectItem value="accounts">Accounts</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label>Shift *</Label>
                    <Select value={shift} onValueChange={(v: ShiftType) => setShift(v)}>
                      <SelectTrigger className="h-11 sm:h-10 text-base sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="morning">Morning (06:00 - 14:00)</SelectItem>
                        <SelectItem value="afternoon">Afternoon (14:00 - 22:00)</SelectItem>
                        <SelectItem value="night">Night (22:00 - 06:00)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label>Date *</Label>
                    <Input
                      type="date"
                      value={handoverDate}
                      onChange={(e) => setHandoverDate(e.target.value)}
                      className="h-11 sm:h-10 text-base sm:text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Machine / Line Status</Label>
                    <Input
                      placeholder="e.g. Line 1 operational, sealer calibrated"
                      value={machineStatus}
                      onChange={(e) => setMachineStatus(e.target.value)}
                      className="h-11 sm:h-10 text-base sm:text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Boxes / Units Completed</Label>
                    <Input
                      type="number"
                      min={0}
                      value={boxesCompleted}
                      onChange={(e) => setBoxesCompleted(Number(e.target.value))}
                      className="h-11 sm:h-10 text-base sm:text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Issues / Exceptions Encountered</Label>
                  <Textarea
                    placeholder="Details about stoppages, barcode errors, or bottlenecks..."
                    value={issues}
                    onChange={(e) => setIssues(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="space-y-1">
                  <Label>Pending Tasks For Next Shift</Label>
                  <Textarea
                    placeholder="Tasks that must be finalized by incoming team..."
                    value={pendingTasks}
                    onChange={(e) => setPendingTasks(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="space-y-1">
                  <Label>Next Shift Instructions</Label>
                  <Textarea
                    placeholder="Key priorities, specific SKU schedules, customer orders..."
                    value={nextShiftInstructions}
                    onChange={(e) => setNextShiftInstructions(e.target.value)}
                    rows={2}
                  />
                </div>

                <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto h-11 sm:h-10">
                    Cancel
                  </Button>
                  <Button type="submit" className="w-full sm:w-auto h-11 sm:h-10">
                    Save Handover Note
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Morning Shifts" value={morningCount} icon={Clock} accent="primary" />
        <StatCard label="Afternoon Shifts" value={afternoonCount} icon={Clock} accent="warning" />
        <StatCard label="Night Shifts" value={nightCount} icon={Clock} accent="neutral" />
        <StatCard label="Total Logged" value={notes.length} icon={ClipboardList} accent="success" />
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search notes by machine, issues, next shift, or author..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-11 sm:h-10 text-base sm:text-sm"
              />
            </div>

            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full sm:w-44 h-11 sm:h-10 text-base sm:text-sm">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="warehouse">Warehouse</SelectItem>
                <SelectItem value="dispatch">Dispatch</SelectItem>
                <SelectItem value="quality">Quality</SelectItem>
                <SelectItem value="accounts">Accounts</SelectItem>
              </SelectContent>
            </Select>

            <Select value={shiftFilter} onValueChange={setShiftFilter}>
              <SelectTrigger className="w-full sm:w-40 h-11 sm:h-10 text-base sm:text-sm">
                <SelectValue placeholder="Shift" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Shifts</SelectItem>
                <SelectItem value="morning">Morning</SelectItem>
                <SelectItem value="afternoon">Afternoon</SelectItem>
                <SelectItem value="night">Night</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredNotes.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No shift handover notes matching your criteria.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotes.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-border/80 bg-card p-4 shadow-xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                        {item.department}
                      </span>
                      <span className="text-xs font-semibold capitalize px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {item.shift} Shift
                      </span>
                      <span className="text-xs font-mono font-medium text-foreground">
                        {item.date}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {item.authorName}
                      </span>
                      <span>{formatDate(item.createdAt)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {item.machineStatus && (
                      <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40">
                        <p className="font-semibold text-foreground mb-0.5">Machine / Equipment:</p>
                        <p className="text-muted-foreground">{item.machineStatus}</p>
                      </div>
                    )}

                    {item.boxesCompleted > 0 && (
                      <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40">
                        <p className="font-semibold text-foreground mb-0.5">Output Volume:</p>
                        <p className="font-mono font-bold text-primary">{item.boxesCompleted} boxes</p>
                      </div>
                    )}
                  </div>

                  {item.issues && (
                    <div className="p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs">
                      <p className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1 mb-0.5">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        Issues Encountered:
                      </p>
                      <p className="text-muted-foreground">{item.issues}</p>
                    </div>
                  )}

                  {item.pendingTasks && (
                    <div className="p-2.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-xs">
                      <p className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1 mb-0.5">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        Pending For Next Shift:
                      </p>
                      <p className="text-muted-foreground">{item.pendingTasks}</p>
                    </div>
                  )}

                  {item.nextShiftInstructions && (
                    <div className="p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-xs">
                      <p className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1 mb-0.5">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        Instructions for Incoming Crew:
                      </p>
                      <p className="text-muted-foreground">{item.nextShiftInstructions}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
