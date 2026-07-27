'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Loader2 } from 'lucide-react';
import { Logo } from '@/lib/logo';

export default function Home() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (profile) router.replace('/dashboard');
    else router.replace('/login');
  }, [profile, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Logo variant="mark" showText />
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    </div>
  );
}
