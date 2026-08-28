import type * as React from 'react';

import { cn } from '@/lib/utils';

function Badge({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'inline-flex min-h-6 items-center rounded-full border bg-muted px-2 py-0.5 text-xs font-semibold text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
