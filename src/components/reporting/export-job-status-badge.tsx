import { CheckCircle2, CircleAlert, Clock3, LoaderCircle, TimerOff } from 'lucide-react';

import type { ExportJobStatus } from '@/application/reporting/dto/export-job-dtos';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const labels: Readonly<Record<ExportJobStatus, string>> = {
  QUEUED: 'Queued',
  RUNNING: 'Running',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  EXPIRED: 'Expired',
};

const icons = {
  QUEUED: Clock3,
  RUNNING: LoaderCircle,
  COMPLETED: CheckCircle2,
  FAILED: CircleAlert,
  EXPIRED: TimerOff,
} as const;

export function ExportJobStatusBadge({ status }: { readonly status: ExportJobStatus }) {
  const Icon = icons[status];
  return (
    <Badge
      className={cn(
        'gap-1.5',
        status === 'COMPLETED' && 'border-success/40 bg-success/10 text-success',
        status === 'FAILED' && 'border-destructive/40 bg-destructive/10 text-destructive',
        status === 'RUNNING' && 'border-info/40 bg-info/10 text-info',
        status === 'EXPIRED' && 'text-muted-foreground',
      )}
    >
      <Icon className="size-3.5 motion-reduce:animate-none" aria-hidden="true" />
      {labels[status]}
    </Badge>
  );
}
