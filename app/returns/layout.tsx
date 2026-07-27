import { AppShell } from '@/components/app-shell';

export default function ReturnsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
