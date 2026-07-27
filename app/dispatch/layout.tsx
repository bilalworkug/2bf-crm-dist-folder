import { AppShell } from '@/components/app-shell';

export default function DispatchLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
