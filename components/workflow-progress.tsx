'use client';

import { useMemo } from 'react';
import {
  ShoppingCart, CreditCard, PackageCheck, Truck,
  CheckCircle2, Clock, Check, FileCheck, ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Order, Payment, Dispatch } from '@/lib/types';

export type StepStatus = 'done' | 'in_progress' | 'waiting';

export interface WorkflowStep {
  id: string;
  title: string;
  department: string;
  status: StepStatus;
  detail: string;
}

interface WorkflowProgressProps {
  order: (Order & { payment_type?: string }) | null;
  payments?: Payment[];
  dispatches?: Dispatch[];
  className?: string;
}

export function WorkflowProgress({
  order,
  payments = [],
  dispatches = [],
  className,
}: WorkflowProgressProps) {
  const steps: WorkflowStep[] = useMemo(() => {
    if (!order) return [];

    const isCredit = order.payment_type === 'credit';
    const isPaid = (order as any).payment_status === 'paid' || (order.paid_amount || 0) >= (order.total_amount || 0);
    const hasPendingPayment = payments.some((p) => p.status === 'pending');
    const isPartiallyDispatched = order.status === 'partially_dispatched';
    const isDispatched = order.status === 'dispatched' || order.status === 'handed_over' || order.status === 'completed';
    const isHandedOver = order.status === 'handed_over' || order.status === 'completed';
    const isCompleted = order.status === 'completed';

    // Step 1: Order Created
    const step1: WorkflowStep = {
      id: 'created',
      title: 'Order Created',
      department: 'Sales',
      status: 'done',
      detail: `Created ${new Date(order.created_at).toLocaleDateString()}`,
    };

    // Step 2: Payment / Credit Cleared
    let step2Status: StepStatus = 'waiting';
    let step2Detail = 'Awaiting payment';
    if (isPaid) {
      step2Status = 'done';
      step2Detail = 'Fully paid & reconciled';
    } else if (isCredit) {
      step2Status = 'done';
      step2Detail = 'Credit terms approved';
    } else if (hasPendingPayment) {
      step2Status = 'in_progress';
      step2Detail = 'Payment awaiting accounts approval';
    } else if ((order.paid_amount || 0) > 0) {
      step2Status = 'in_progress';
      step2Detail = `Partial payment received`;
    }

    const step2: WorkflowStep = {
      id: 'payment',
      title: isCredit ? 'Credit Approved' : 'Payment Cleared',
      department: 'Accounts',
      status: step2Status,
      detail: step2Detail,
    };

    // Step 3: Warehouse Picked & Staged
    let step3Status: StepStatus = 'waiting';
    let step3Detail = 'Pending warehouse allocation';
    if (isDispatched || isPartiallyDispatched || isHandedOver || isCompleted) {
      step3Status = 'done';
      step3Detail = 'Stock staged & picked';
    } else if (order.status === 'approved' || order.status === 'processing') {
      step3Status = 'in_progress';
      step3Detail = 'Ready for warehouse staging';
    }

    const step3: WorkflowStep = {
      id: 'warehouse',
      title: 'Warehouse Picked',
      department: 'Warehouse',
      status: step3Status,
      detail: step3Detail,
    };

    // Step 4: Dispatched (Warehouse Stock Deducted)
    let step4Status: StepStatus = 'waiting';
    let step4Detail = 'Awaiting vehicle loading';
    if (isDispatched || isHandedOver || isCompleted) {
      step4Status = 'done';
      step4Detail = `Fully dispatched (${dispatches.length} cartons loaded)`;
    } else if (isPartiallyDispatched || dispatches.length > 0) {
      step4Status = 'in_progress';
      step4Detail = `Partially dispatched (${dispatches.length} cartons loaded)`;
    }

    const step4: WorkflowStep = {
      id: 'dispatch',
      title: 'Dispatched',
      department: 'Dispatch Desk',
      status: step4Status,
      detail: step4Detail,
    };

    // Step 5: Handover & Completed
    let step5Status: StepStatus = 'waiting';
    let step5Detail = 'Awaiting gate custody handover';
    if (isCompleted) {
      step5Status = 'done';
      step5Detail = 'Order fulfilled & closed';
    } else if (isHandedOver) {
      step5Status = 'in_progress';
      step5Detail = 'Gate pass & custody handed over';
    }

    const step5: WorkflowStep = {
      id: 'handover_completed',
      title: isCompleted ? 'Order Completed' : 'Gate Handover',
      department: 'Loading Gate',
      status: step5Status,
      detail: step5Detail,
    };

    return [step1, step2, step3, step4, step5];
  }, [order, payments, dispatches]);

  if (!order) return null;

  const isOrderClosed = order.status === 'completed';

  return (
    <div className={cn('rounded-lg border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-3.5', className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <h3 className="text-sm font-bold text-foreground">
            Order Workflow Pipeline
          </h3>
          <p className="text-xs text-muted-foreground">
            Live progression: Sales → Accounts → Production → Warehouse → Dispatch → Gate Handover
          </p>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold self-start sm:self-auto border border-primary/20">
          {order.order_number}
        </span>
      </div>

      {/* Desktop Step Flow */}
      <div className="hidden lg:grid lg:grid-cols-5 gap-3 relative">
        {steps.map((step, idx) => {
          let Icon = Clock;
          if (step.id === 'created') Icon = ShoppingCart;
          if (step.id === 'payment') Icon = CreditCard;
          if (step.id === 'warehouse') Icon = PackageCheck;
          if (step.id === 'dispatch') Icon = Truck;
          if (step.id === 'handover_completed') Icon = isOrderClosed ? ShieldCheck : FileCheck;

          return (
            <div
              key={step.id}
              className={cn(
                'relative flex flex-col p-3 rounded-lg border transition-all',
                step.status === 'done' && 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60',
                step.status === 'in_progress' && 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-700 ring-1 ring-blue-500/20',
                step.status === 'waiting' && 'bg-muted/30 border-border/60 opacity-70'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={cn(
                    'w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs shrink-0',
                    step.status === 'done' && 'bg-emerald-600 text-white',
                    step.status === 'in_progress' && 'bg-blue-600 text-white',
                    step.status === 'waiting' && 'bg-muted text-muted-foreground border border-border'
                  )}
                >
                  {step.status === 'done' ? <Check className="h-4 w-4 stroke-[3]" /> : idx + 1}
                </div>

                <span
                  className={cn(
                    'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border',
                    step.status === 'done' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border-emerald-200/60',
                    step.status === 'in_progress' && 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 border-blue-200/60',
                    step.status === 'waiting' && 'bg-muted text-muted-foreground border-border/40'
                  )}
                >
                  {step.status === 'done' ? 'Done' : step.status === 'in_progress' ? 'Active' : 'Waiting'}
                </span>
              </div>

              <div className="space-y-0.5">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center gap-1">
                  <Icon className="h-3 w-3" />
                  {step.department}
                </p>
                <h4 className="text-xs font-bold text-foreground truncate">
                  {step.title}
                </h4>
                <p className="text-[11px] text-muted-foreground leading-tight line-clamp-2 pt-0.5">
                  {step.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile Stacked Step Flow */}
      <div className="grid grid-cols-1 gap-2 lg:hidden">
        {steps.map((step, idx) => {
          let Icon = Clock;
          if (step.id === 'created') Icon = ShoppingCart;
          if (step.id === 'payment') Icon = CreditCard;
          if (step.id === 'warehouse') Icon = PackageCheck;
          if (step.id === 'dispatch') Icon = Truck;
          if (step.id === 'handover_completed') Icon = isOrderClosed ? ShieldCheck : FileCheck;

          return (
            <div
              key={step.id}
              className={cn(
                'flex items-start gap-3 p-2.5 rounded-lg border transition-all',
                step.status === 'done' && 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60',
                step.status === 'in_progress' && 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-700 ring-1 ring-blue-500/20',
                step.status === 'waiting' && 'bg-muted/30 border-border/60 opacity-70'
              )}
            >
              <div
                className={cn(
                  'w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs shrink-0 mt-0.5',
                  step.status === 'done' && 'bg-emerald-600 text-white',
                  step.status === 'in_progress' && 'bg-blue-600 text-white',
                  step.status === 'waiting' && 'bg-muted text-muted-foreground border border-border'
                )}
              >
                {step.status === 'done' ? <Check className="h-4 w-4 stroke-[3]" /> : idx + 1}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-foreground truncate flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    {step.title}
                  </h4>
                  <span
                    className={cn(
                      'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0',
                      step.status === 'done' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border-emerald-200/60',
                      step.status === 'in_progress' && 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 border-blue-200/60',
                      step.status === 'waiting' && 'bg-muted text-muted-foreground border-border/40'
                    )}
                  >
                    {step.status === 'done' ? 'Done' : step.status === 'in_progress' ? 'Active' : 'Waiting'}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{step.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
