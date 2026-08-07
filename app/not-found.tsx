import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background">
      <h2 className="text-3xl font-bold">404 - Not Found</h2>
      <p className="text-muted-foreground">Could not find requested resource</p>
      <Link href="/" className="text-primary hover:underline">
        Return Home
      </Link>
    </div>
  );
}
