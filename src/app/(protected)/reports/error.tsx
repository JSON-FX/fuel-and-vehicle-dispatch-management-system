'use client';

import { AlertCircle, RotateCcw } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function ReportsError({
  error,
  reset,
}: {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    console.error('Reporting page failed', { digest: error.digest });
    heading.current?.focus();
  }, [error]);
  return (
    <Card role="alert" aria-live="assertive">
      <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
        <AlertCircle className="size-10 text-destructive" aria-hidden="true" />
        <div>
          <h1
            ref={heading}
            tabIndex={-1}
            className="font-heading text-2xl font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Operational reports are unavailable
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Report data could not be loaded. No operational records or export jobs were changed.
          </p>
        </div>
        <Button type="button" onClick={reset}>
          <RotateCcw aria-hidden="true" /> Try again
        </Button>
      </CardContent>
    </Card>
  );
}
