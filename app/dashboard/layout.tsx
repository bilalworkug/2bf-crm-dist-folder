import { AppShell } from '@/components/app-shell';
import { DashboardRouter } from './dashboard-router';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <DashboardRouter>{children}</DashboardRouter>
    </AppShell>
  );
}
