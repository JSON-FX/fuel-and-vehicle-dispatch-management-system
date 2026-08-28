import { CheckCircle2, CircleSlash2, Trash2, TriangleAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type ReferenceStatusTone = 'positive' | 'inactive' | 'warning' | 'deleted';

export function ReferenceStatusBadge({
  label,
  tone,
}: {
  readonly label: string;
  readonly tone: ReferenceStatusTone;
}) {
  const Icon =
    tone === 'positive'
      ? CheckCircle2
      : tone === 'deleted'
        ? Trash2
        : tone === 'warning'
          ? TriangleAlert
          : CircleSlash2;
  return (
    <Badge
      className={cn(
        'gap-1.5 whitespace-nowrap',
        tone === 'positive' && 'border-success/40 bg-success/10 text-success',
        tone === 'warning' && 'border-warning/40 bg-warning/10 text-warning',
        tone === 'deleted' && 'border-destructive/40 bg-destructive/10 text-destructive',
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {label}
    </Badge>
  );
}
