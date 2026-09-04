'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HandoverRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="flex h-[50vh] items-center justify-center">
      <p className="text-sm text-muted-foreground">Redirecting to Dashboard...</p>
    </div>
  );
}
