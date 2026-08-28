import { CircleCheck, CircleDashed, CircleSlash } from 'lucide-react';

import type { FuelIssuanceStatusValue } from '@/domain/fuel/value-objects/fuel-issuance-status';
import { Badge } from '@/components/ui/badge';

export function FuelIssuanceStatusBadge({ status }: { readonly status: FuelIssuanceStatusValue }) {
  const Icon = status === 'DRAFT' ? CircleDashed : status === 'POSTED' ? CircleCheck : CircleSlash;
  return (
    <Badge>
      <Icon className="mr-1 size-3.5" aria-hidden="true" />
      {status === 'DRAFT' ? 'Draft' : status === 'POSTED' ? 'Posted' : 'Voided'}
    </Badge>
  );
}
