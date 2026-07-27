import { AppShell } from '@/components/app-shell';

export default function QuoteLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
