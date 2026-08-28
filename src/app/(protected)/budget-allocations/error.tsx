'use client';

import { AlertCircle, RotateCcw } from 'lucide-react';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function BudgetAllocationsError({
  error,
  reset,
}: {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    console.error('Budget allocation page failed', { digest: error.digest });
  }, [error]);

  return (
    <Card role="alert" aria-live="assertive">
      <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
        <AlertCircle className="size-10 text-destructive" aria-hidden="true" />
        <div>
          <h1 className="font-heading text-2xl font-semibold">
            Budget allocations are unavailable
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Allocation records could not be loaded. No change was submitted from this page.
          </p>
        </div>
        <Button type="button" onClick={reset}>
          <RotateCcw aria-hidden="true" /> Try again
        </Button>
      </CardContent>
    </Card>
  );
}
