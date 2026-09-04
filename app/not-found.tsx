import Link from 'next/link';
import { 
  Compass, 
  ArrowLeft, 
  LayoutDashboard, 
  ScanLine, 
  Boxes, 
  Search, 
  FileQuestion 
} from 'lucide-react';
import { Logo } from '@/lib/logo';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between bg-gradient-to-b from-background via-background/95 to-muted/30 text-foreground antialiased selection:bg-primary/20 selection:text-primary overflow-hidden">
      {/* Subtle industrial background pattern */}
      <div 
        className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: '24px 24px'
        }}
      />
      
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-primary/10 rounded-full blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 right-10 w-[400px] h-[300px] bg-amber-500/10 rounded-full blur-[100px]" />

      {/* Top Navbar */}
      <header className="relative z-10 border-b border-border/60 bg-background/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/dashboard" className="transition-opacity hover:opacity-90">
            <Logo variant="full" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              HTTP 404 • Route Unresolved
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        <div className="mx-auto w-full max-w-2xl text-center">
          {/* Badge Icon */}
          <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-2xl border border-border bg-card/80 shadow-xl backdrop-blur-sm">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-primary/10 via-transparent to-amber-500/10" />
            <FileQuestion className="h-12 w-12 text-primary stroke-[1.75]" />
            <div className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold shadow-md">
              404
            </div>
          </div>

          {/* Error Headers */}
          <div className="mb-2 inline-flex items-center gap-2 rounded-md bg-muted px-2.5 py-1 text-xs font-mono text-muted-foreground">
            <span>ERR_RESOURCE_NOT_FOUND</span>
            <span>•</span>
            <span>CLUSTER_2BF_CORE</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-3">
            Resource or Location Not Found
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto mb-8 leading-relaxed">
            The page, SKU record, dispatch manifest, or workflow endpoint you requested does not exist or has been relocated to another warehouse sector.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
            <Button
              asChild
              size="lg"
              className="h-11 px-6 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm"
            >
              <Link href="/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                Return to Dashboard
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-11 px-5 gap-2 border-border/80 hover:bg-muted font-medium"
            >
              <Link href="/orders">
                <ArrowLeft className="h-4 w-4" />
                Back to Orders
              </Link>
            </Button>
          </div>

          {/* Quick Jump Shortcuts */}
          <div className="rounded-xl border border-border/70 bg-card/60 p-5 shadow-sm backdrop-blur-sm text-left">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5 text-primary" />
              Common Factory Operations
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <Link
                href="/barcode-search"
                className="group flex items-center gap-2.5 rounded-lg border border-border/50 bg-background/50 p-2.5 text-xs transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                  <ScanLine className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Barcode Search</div>
                  <div className="text-[11px] text-muted-foreground">Lookup SKU & Box</div>
                </div>
              </Link>

              <Link
                href="/orders"
                className="group flex items-center gap-2.5 rounded-lg border border-border/50 bg-background/50 p-2.5 text-xs transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                  <Boxes className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Orders Center</div>
                  <div className="text-[11px] text-muted-foreground">Manage Sales & Flow</div>
                </div>
              </Link>

              <Link
                href="/search"
                className="group flex items-center gap-2.5 rounded-lg border border-border/50 bg-background/50 p-2.5 text-xs transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
                  <Search className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Global Search</div>
                  <div className="text-[11px] text-muted-foreground">Universal Registry</div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/60 bg-background/60 px-6 py-4 text-center">
        <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div>
            Two Brothers Food Complex P.L.C • Operations ERP & Traceability System
          </div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Gateway Nominal
            </span>
            <Link href="/audit" className="hover:text-foreground transition-colors">
              System Audit
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
