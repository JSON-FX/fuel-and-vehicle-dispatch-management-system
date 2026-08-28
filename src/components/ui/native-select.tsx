import type * as React from 'react';

import { cn } from '@/lib/utils';

function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'flex min-h-11 w-full cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-base text-foreground outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none aria-invalid:border-destructive aria-invalid:ring-destructive/40',
        className,
      )}
      {...props}
    />
  );
}

export { NativeSelect };
