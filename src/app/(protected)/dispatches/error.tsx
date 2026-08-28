'use client';

import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function DispatchesError({
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <Card>
      <CardContent className="space-y-4 py-10 text-center">
        <h1
          ref={heading}
          tabIndex={-1}
          className="font-heading text-2xl font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Vehicle dispatches could not be loaded
        </h1>
        <p className="text-muted-foreground">
          The request failed before the page could be shown. Your saved records were not changed.
        </p>
        <Button type="button" onClick={reset}>
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}
