'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  AlertTriangle, 
  RotateCcw, 
  LayoutDashboard, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  ShieldAlert, 
  LifeBuoy
} from 'lucide-react';
import { Logo } from '@/lib/logo';
import { Button } from '@/components/ui/button';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorProps) {
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Log exception to client console for telemetry
    console.error('2BF Operational Exception:', error);
  }, [error]);

  const copyErrorDetails = () => {
    const details = `[2BF System Error Report]\nDigest: ${error.digest || 'N/A'}\nMessage: ${error.message}\nTimestamp: ${new Date().toISOString()}\nStack: ${error.stack || 'Unavailable'}`;
    navigator.clipboard.writeText(details).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between bg-gradient-to-b from-background via-background/95 to-muted/30 text-foreground antialiased selection:bg-destructive/20 selection:text-destructive overflow-hidden">
      {/* Background industrial grid pattern */}
      <div 
        className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: '24px 24px'
        }}
      />
      
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-destructive/10 rounded-full blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-40 left-10 w-[400px] h-[300px] bg-amber-500/10 rounded-full blur-[100px]" />

      {/* Top Navbar */}
      <header className="relative z-10 border-b border-border/60 bg-background/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/dashboard" className="transition-opacity hover:opacity-90">
            <Logo variant="full" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-destructive">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-ping" />
              Runtime Error Handled
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        <div className="mx-auto w-full max-w-xl text-center">
          {/* Badge Icon */}
          <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-2xl border border-destructive/30 bg-card/90 shadow-xl backdrop-blur-sm">
            <div className="absolute inset-0 rounded-2xl bg-destructive/10" />
            <AlertTriangle className="h-12 w-12 text-destructive stroke-[1.75]" />
            {error.digest && (
              <div className="absolute -bottom-2 -right-2 flex items-center rounded-md bg-destructive text-destructive-foreground text-[10px] font-mono font-bold px-2 py-0.5 shadow-sm">
                #{error.digest.slice(0, 6)}
              </div>
            )}
          </div>

          {/* Error Tag */}
          <div className="mb-2 inline-flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-1 text-xs font-mono text-destructive">
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>EX_WORKFLOW_FAULT</span>
            <span>•</span>
            <span>FAILSAFE_ACTIVE</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-3">
            Workflow Execution Interrupted
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto mb-8 leading-relaxed">
            The system encountered an unexpected runtime condition while rendering this page or processing the factory pipeline. Your session and recorded operations are preserved.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
            <Button
              onClick={() => reset()}
              size="lg"
              className="h-11 px-6 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm"
            >
              <RotateCcw className="h-4 w-4" />
              Try Again
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-11 px-5 gap-2 border-border/80 hover:bg-muted font-medium"
            >
              <Link href="/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                Return to Dashboard
              </Link>
            </Button>
          </div>

          {/* Technical Diagnostics Box */}
          <div className="rounded-xl border border-border/80 bg-card/70 p-4 text-left shadow-sm backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Diagnostic Information
                </span>
                {error.digest && (
                  <span className="font-mono text-[11px] text-muted-foreground/80 bg-muted px-1.5 py-0.5 rounded">
                    Digest: {error.digest}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={copyErrorDetails}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Copy incident diagnostic for support"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-emerald-500 font-semibold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Details</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDetails(!showDetails)}
                  className="inline-flex items-center gap-1 rounded p-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label="Toggle technical stack trace"
                >
                  {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error summary line */}
            <div className="mt-2 text-xs font-mono text-destructive/90 truncate bg-destructive/5 p-2 rounded border border-destructive/10">
              {error.message || 'An unhandled exception occurred during server/client render.'}
            </div>

            {/* Expanded stack trace */}
            {showDetails && (
              <div className="mt-3 max-h-48 overflow-y-auto rounded bg-zinc-950 p-3 text-[11px] font-mono text-zinc-300">
                <div className="text-amber-400 font-semibold mb-1">Stack Trace:</div>
                <pre className="whitespace-pre-wrap leading-relaxed">
                  {error.stack || 'No client stack trace available.'}
                </pre>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/60 bg-background/60 px-6 py-4 text-center">
        <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div>
            Two Brothers Food Complex P.L.C • Automated Recovery Protocol
          </div>
          <div className="flex items-center gap-4">
            <Link href="/audit" className="hover:text-foreground transition-colors flex items-center gap-1">
              <LifeBuoy className="h-3.5 w-3.5" />
              IT System Audit
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
