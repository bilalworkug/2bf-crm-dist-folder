'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Logo } from '@/lib/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/theme-toggle';
import { toast } from 'sonner';
import { Loader2, Factory, ShieldCheck, ScanLine, BarChart3 } from 'lucide-react';

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@2bf.com.et', password: '2bf-admin-2025' },
  { role: 'Production', email: 'production@2bf.com.et', password: '2bf-prod-2025' },
  { role: 'Warehouse 1', email: 'warehouse1@2bf.com.et', password: '2bf-wh1-2025' },
  { role: 'Warehouse 2', email: 'warehouse2@2bf.com.et', password: '2bf-wh2-2025' },
  { role: 'Warehouse 3', email: 'warehouse3@2bf.com.et', password: '2bf-wh3-2025' },
  { role: 'Dispatch', email: 'dispatch@2bf.com.et', password: '2bf-disp-2025' },
  { role: 'Sales', email: 'sales@2bf.com.et', password: '2bf-sales-2025' },
  { role: 'Accounts', email: 'accounts@2bf.com.et', password: '2bf-acc-2025' },
  { role: 'Manager', email: 'manager@2bf.com.et', password: '2bf-mgr-2025' },
  { role: 'Reports', email: 'reports@2bf.com.et', password: '2bf-rep-2025' },
];

export default function LoginPage() {
  const { profile, loading, signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && profile) router.replace('/dashboard');
  }, [profile, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success('Welcome back');
      router.replace('/dashboard');
    }
  }

  async function quickLogin(acc: { email: string; password: string }) {
    setEmail(acc.email);
    setPassword(acc.password);
    setSubmitting(true);
    const { error } = await signIn(acc.email, acc.password);
    setSubmitting(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success('Welcome back');
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

        {/* Right login form */}
        <div className="flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-sm">
            <div className="mb-8 lg:hidden">
              <Logo />
            </div>
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight">Sign in to your account</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Enter your credentials to access the 2BF system.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@2bf.com.et"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>

            <div className="mt-8 rounded-lg border bg-muted/40 p-4">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Quick login — click any role to sign in instantly
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    disabled={submitting}
                    onClick={() => quickLogin(acc)}
                    className="rounded-md border bg-card px-2.5 py-2 text-left text-xs transition-colors hover:bg-accent disabled:opacity-50"
                  >
                    <span className="block font-medium text-foreground">{acc.role}</span>
                    <span className="block font-mono text-[10px] text-muted-foreground">{acc.password}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
