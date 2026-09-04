'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Logo } from '@/lib/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { toast } from 'sonner';
import { Loader2, Shield, Factory, Package, Truck, BarChart3, Users, LayoutDashboard, Calculator, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const DEMO_USERS = [
  { id: 'admin', name: 'Admin', email: 'admin@2bf.com.et', password: 'Password123!', role: 'admin', icon: Shield },
  { id: 'prod1', name: 'Production User 1', email: 'production1@2bf.com.et', password: 'Password123!', role: 'production', icon: Factory },
  { id: 'prod2', name: 'Production User 2', email: 'production2@2bf.com.et', password: 'Password123!', role: 'production', icon: Factory },
  { id: 'prod_mgr', name: 'Production Manager', email: 'production_manager@2bf.com.et', password: 'Password123!', role: 'production_manager', icon: LayoutDashboard },
  { id: 'wh1', name: 'Warehouse User 1', email: 'warehouse1@2bf.com.et', password: 'Password123!', role: 'warehouse', icon: Package },
  { id: 'wh2', name: 'Warehouse User 2', email: 'warehouse2@2bf.com.et', password: 'Password123!', role: 'warehouse', icon: Package },
  { id: 'wh_mgr', name: 'Warehouse Manager', email: 'warehouse_manager@2bf.com.et', password: 'Password123!', role: 'warehouse_manager', icon: LayoutDashboard },
  { id: 'sales', name: 'Sales User', email: 'sales@2bf.com.et', password: 'Password123!', role: 'sales', icon: Users },
  { id: 'sales_mgr', name: 'Sales Manager', email: 'sales_manager@2bf.com.et', password: 'Password123!', role: 'sales_manager', icon: LayoutDashboard },
  { id: 'dispatch', name: 'Dispatch User', email: 'dispatch@2bf.com.et', password: 'Password123!', role: 'dispatch', icon: Truck },
  { id: 'dispatch_mgr', name: 'Dispatch Manager', email: 'dispatch_manager@2bf.com.et', password: 'Password123!', role: 'dispatch_manager', icon: LayoutDashboard },
  { id: 'accounts', name: 'Accounts User', email: 'accounts@2bf.com.et', password: 'Password123!', role: 'accounts', icon: Calculator },
  { id: 'returns_mgr', name: 'Returns Manager', email: 'returns_manager@2bf.com.et', password: 'Password123!', role: 'returns_manager', icon: LayoutDashboard },
  { id: 'reports', name: 'Reports User', email: 'reports@2bf.com.et', password: 'Password123!', role: 'reports', icon: BarChart3 },
];

export default function LoginPage() {
  const { profile, loading, quickSignIn } = useAuth();
  const router = useRouter();

  // Email/password form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Quick login state
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && profile) router.replace('/dashboard');
  }, [profile, loading, router]);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    try {
      setIsSigningIn(true);
      const { error } = await quickSignIn(email, password);
      if (error) {
        toast.error(error);
      } else {
        toast.success('Welcome back!');
        router.replace('/dashboard');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleQuickLogin(acc: typeof DEMO_USERS[0]) {
    try {
      setSubmittingId(acc.id);
      const { error } = await quickSignIn(acc.email, acc.password);
      if (error) {
        toast.error(error);
      } else {
        toast.success(`Welcome back, ${acc.name}`);
        router.replace('/dashboard');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmittingId(null);
    }
  }

  const anyLoading = isSigningIn || submittingId !== null;

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-background p-6">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-6xl space-y-10 z-10">
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="scale-125">
            <Logo />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Two Brothers CRM</h1>
            <p className="text-muted-foreground max-w-lg mx-auto text-sm">
              Sign in with your email and password, or use quick demo access below.
            </p>
          </div>
        </div>

        {/* Email / Password login form */}
        <div className="flex justify-center">
          <Card className="w-full max-w-sm shadow-lg border-muted">
            <CardHeader>
              <CardTitle>Sign In</CardTitle>
              <CardDescription>Enter your credentials to access the system.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@2bf.com.et"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={anyLoading}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      placeholder="Your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={anyLoading}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={anyLoading}>
                  {isSigningIn ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    'Sign in'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 max-w-sm mx-auto">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground uppercase tracking-wide">or quick access</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Quick demo login cards */}
        <div className="flex justify-center">
          <Card className="w-full max-w-4xl shadow-lg border-muted">
            <CardHeader>
              <CardTitle>Quick Demo Access</CardTitle>
              <CardDescription>Select a role to instantly log in with demo credentials.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {DEMO_USERS.map((acc) => {
                  const Icon = acc.icon;
                  const isSubmitting = submittingId === acc.id;
                  return (
                    <button
                      key={acc.id}
                      onClick={() => handleQuickLogin(acc)}
                      disabled={anyLoading}
                      className="group relative flex flex-col items-center gap-3 rounded-xl border bg-card p-4 text-center transition-all hover:border-primary hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="rounded-full bg-primary/10 p-3 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        {isSubmitting ? (
                          <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                          <Icon className="h-6 w-6" />
                        )}
                      </div>
                      <span className="block text-sm font-semibold text-foreground">{acc.name}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-grid-slate-200/20 [mask-image:linear-gradient(to_bottom,white,transparent)] dark:bg-grid-slate-800/20" />
    </div>
  );
}
