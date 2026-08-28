import type * as React from 'react';

import { cn } from '@/lib/utils';

function Alert({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      role="alert"
      data-slot="alert"
      className={cn(
        'rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm',
        className,
      )}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <h2 className={cn('font-heading font-semibold', className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mt-1 text-muted-foreground', className)} {...props} />;
}

export { Alert, AlertDescription, AlertTitle };
