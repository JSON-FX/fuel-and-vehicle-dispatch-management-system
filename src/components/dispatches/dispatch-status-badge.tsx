import { CircleCheck, CircleDashed, CircleX, Route } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { DispatchStatusValue } from '@/domain/dispatch/value-objects/dispatch-status';

export function DispatchStatusBadge({ status }: { readonly status: DispatchStatusValue }) {
  const Icon =
    status === 'DRAFT'
      ? CircleDashed
      : status === 'DISPATCHED'
        ? Route
        : status === 'COMPLETED'
          ? CircleCheck
          : CircleX;
  const label =
    status === 'DRAFT'
      ? 'Draft'
      : status === 'DISPATCHED'
        ? 'Dispatched'
        : status === 'COMPLETED'
          ? 'Completed'
          : 'Cancelled';
  return (
    <Badge className={status === 'CANCELLED' ? 'border-destructive text-destructive' : undefined}>
      <Icon className="mr-1 size-3.5" aria-hidden="true" />
      {label}
    </Badge>
  );
}
