'use client';

import { useAuth } from '@/lib/auth';
import { Loader2 } from 'lucide-react';

export function DashboardRouter({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Profile is null means not authenticated — page.tsx handles this with `if (!profile) return null`
  return <>{children}</>;
}
