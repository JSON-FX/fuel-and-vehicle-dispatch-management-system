'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function DispatchScheduleError({ reset }: { readonly reset: () => void }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <h1 className="font-heading text-2xl font-semibold">Dispatch schedule unavailable</h1>
        <p className="mt-2 text-muted-foreground">The schedule could not be loaded safely.</p>
        <Button className="mt-4" type="button" onClick={reset}>
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}
