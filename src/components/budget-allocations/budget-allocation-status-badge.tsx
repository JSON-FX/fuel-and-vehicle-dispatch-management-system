import { BadgeCheck, BadgeX, CircleDashed, CircleX, LockKeyhole, Trash2 } from 'lucide-react';

import type { BudgetAllocationStatusValue } from '@/domain/budget/value-objects/budget-allocation-status';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function BudgetAllocationStatusBadge({
  status,
  deleted,
  eligible,
}: {
  readonly status: BudgetAllocationStatusValue;
  readonly deleted: boolean;
  readonly eligible: boolean;
}) {
  if (deleted) {
    return (
      <Badge className="gap-1.5 border-destructive/40 bg-destructive/10 text-destructive">
        <Trash2 className="size-3.5" aria-hidden="true" /> Deleted
      </Badge>
    );
  }

  const statusDetails = {
    DRAFT: { label: 'Draft', icon: CircleDashed, className: '' },
    ACTIVE: {
      label: 'Active',
      icon: BadgeCheck,
      className: 'border-success/40 bg-success/10 text-success',
    },
    CLOSED: {
      label: 'Closed',
      icon: LockKeyhole,
      className: 'border-warning/40 bg-warning/10 text-warning',
    },
    CANCELLED: {
      label: 'Cancelled',
      icon: CircleX,
      className: 'border-destructive/40 bg-destructive/10 text-destructive',
    },
  }[status];
  const StatusIcon = statusDetails.icon;
  const EligibilityIcon = eligible ? BadgeCheck : BadgeX;

  return (
    <span className="flex flex-wrap gap-1.5">
      <Badge className={cn('gap-1.5 whitespace-nowrap', statusDetails.className)}>
        <StatusIcon className="size-3.5" aria-hidden="true" /> {statusDetails.label}
      </Badge>
      <Badge
        className={cn(
          'gap-1.5 whitespace-nowrap',
          eligible
            ? 'border-success/40 bg-success/10 text-success'
            : 'border-muted-foreground/30 text-muted-foreground',
        )}
      >
        <EligibilityIcon className="size-3.5" aria-hidden="true" />
        {eligible ? 'Eligible now' : 'Not eligible now'}
      </Badge>
    </span>
  );
}
