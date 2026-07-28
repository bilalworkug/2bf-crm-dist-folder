'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import type { RoleKey } from '@/lib/types';
import { Logo } from '@/lib/logo';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { toast } from 'sonner';
import { Loader2, Factory, ShieldCheck, ScanLine, BarChart3, ChevronRight } from 'lucide-react';

const DEMO_ACCOUNTS: { role: string; roleKey: RoleKey; warehouse?: string }[] = [
  { role: 'Admin', roleKey: 'admin' },
  { role: 'Production', roleKey: 'production' },
  { role: 'Warehouse 1', roleKey: 'warehouse', warehouse: 'WH1' },
  { role: 'Warehouse 2', roleKey: 'warehouse', warehouse: 'WH2' },
  { role: 'Warehouse 3', roleKey: 'warehouse', warehouse: 'WH3' },
  { role: 'Dispatch', roleKey: 'dispatch' },
  { role: 'Sales', roleKey: 'sales' },
  { role: 'Accounts', roleKey: 'accounts' },
  { role: 'Manager', roleKey: 'manager' },
  { role: 'Reports', roleKey: 'reports' },
];

export default function LoginPage() {
  const { profile, loading, quickSignIn } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && profile) router.replace('/dashboard');
  }, [profile, loading, router]);

  async function quickLogin(roleKey: RoleKey, roleLabel: string) {
    setSubmitting(roleLabel);
    const { error } = await quickSignIn(roleKey);
    setSubmitting(null);
    if (error) {
      toast.error(error);
    } else {
      toast.success(`Signed in as ${roleLabel}`);
      router.replace('/dashboard');
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Left brand panel */}
        <div className="relative hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, hsl(32 80% 50%) 0, transparent 40%), radial-gradient(circle at 80% 70%, hsl(38 90% 50%) 0, transparent 35%)' }} />
          <div className="relative">
            <Logo className="[&_span:first-child]:text-sidebar-foreground [&_.text-amber-600]:text-amber-400" />
          </div>
          <div className="relative space-y-6">
            <h2 className="text-3xl font-bold leading-tight">
              From production line to customer hand —<br />trace every box.
            </h2>
            <p className="max-w-md text-sidebar-foreground/70">
              The complete factory operations system for Two Brothers Food Complex:
              production scanning, warehouse receiving, dispatch, sales, and full barcode traceability.
            </p>
            <div className="grid max-w-md grid-cols-1 gap-3 pt-4">
              {[
                { icon: ScanLine, label: 'Production scanning with duplicate detection' },
                { icon: ShieldCheck, label: 'Role-based access across 8 roles' },
                { icon: BarChart3, label: 'Real-time reports and audit logs' },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-3 text-sm text-sidebar-foreground/80">
                  <f.icon className="h-5 w-5 text-amber-400" />
                  <span>{f.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative flex items-center gap-2 text-sm text-sidebar-foreground/50">
            <Factory className="h-4 w-4" />
            <span>Two Brothers Food Complex P.L.C — Factory System</span>
          </div>
        </div>

        {/* Right quick-login panel */}
        <div className="flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <Logo />
            </div>
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight">Quick Login</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Click any role below to instantly enter the 2BF system. No password needed.
              </p>
            </div>

            <div className="space-y-2.5">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  disabled={submitting !== null}
                  onClick={() => quickLogin(acc.roleKey, acc.role)}
                  className="group flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3 text-left transition-all hover:border-primary/40 hover:bg-accent hover:shadow-sm disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-sm font-semibold text-amber-600 dark:text-amber-400">
                      {acc.role.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{acc.role}</p>
                      {acc.warehouse && (
                        <p className="text-xs text-muted-foreground">{acc.warehouse}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {submitting === acc.role && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                </button>
              ))}
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Each role sees a different dashboard and set of permissions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
