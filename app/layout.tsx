import './globals.css';
import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/lib/auth';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: '2BF System — Two Brothers Food Complex',
  description:
    'Factory operations system for Two Brothers Food Complex P.L.C: production traceability, warehouse, dispatch, sales, and reports.',
};

import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            {children}
            <Toaster richColors position="top-right" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

