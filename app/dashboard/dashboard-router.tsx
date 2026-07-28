'use client';

import { useAuth } from '@/lib/auth';
import { UnifiedDashboard } from '@/components/dashboards/unified-dashboard';
import { Loader2 } from 'lucide-react';

export function DashboardRouter({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return <UnifiedDashboard />;
}
