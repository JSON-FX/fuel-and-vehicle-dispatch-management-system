import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ReferencePagination({
  previousHref,
  nextHref,
}: {
  readonly previousHref: string | null;
  readonly nextHref: string | null;
}) {
  return (
    <nav aria-label="Reference data pages" className="flex items-center justify-between gap-3">
      {previousHref === null ? (
        <span
          aria-disabled="true"
          className={cn(buttonVariants({ variant: 'outline' }), 'cursor-not-allowed opacity-50')}
        >
          <ArrowLeft aria-hidden="true" /> Previous
        </span>
      ) : (
        <Link className={buttonVariants({ variant: 'outline' })} href={previousHref}>
          <ArrowLeft aria-hidden="true" /> Previous
        </Link>
      )}
      {nextHref === null ? (
        <span
          aria-disabled="true"
          className={cn(buttonVariants({ variant: 'outline' }), 'cursor-not-allowed opacity-50')}
        >
          Next <ArrowRight aria-hidden="true" />
        </span>
      ) : (
        <Link className={buttonVariants({ variant: 'outline' })} href={nextHref}>
          Next <ArrowRight aria-hidden="true" />
        </Link>
      )}
    </nav>
  );
}
