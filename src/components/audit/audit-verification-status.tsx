import { Clock, ShieldAlert, ShieldCheck } from 'lucide-react';

import type { AuditVerificationStatusDto } from '@/application/audit/dto/audit-event-dtos';
import { Card, CardContent } from '@/components/ui/card';

export function AuditVerificationStatus({
  verification,
}: {
  readonly verification: AuditVerificationStatusDto | null;
}) {
  if (verification === null) {
    return (
      <Card aria-labelledby="audit-verification-heading">
        <CardContent className="flex min-h-32 items-start gap-4 pt-6">
          <Clock className="mt-0.5 size-6 shrink-0 text-warning" aria-hidden="true" />
          <div>
            <h2 id="audit-verification-heading" className="font-heading text-lg font-semibold">
              Latest verification: <span className="text-warning">Unavailable</span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              No completed verification result is available yet. Audit records remain readable.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const passed = verification.status === 'PASS';
  const Icon = passed ? ShieldCheck : ShieldAlert;
  const status = passed ? 'Passed' : 'Failed';
  const color = passed ? 'text-success' : 'text-destructive';

  return (
    <Card aria-labelledby="audit-verification-heading">
      <CardContent className="flex min-h-32 items-start gap-4 pt-6">
        <Icon className={`mt-0.5 size-6 shrink-0 ${color}`} aria-hidden="true" />
        <div className="min-w-0">
          <h2 id="audit-verification-heading" className="font-heading text-lg font-semibold">
            Latest verification: <span className={color}>{status}</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Verified through sequence {verification.highWaterSequence}. Checked{' '}
            {verification.verifiedCount} record{verification.verifiedCount === '1' ? '' : 's'}.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Completed{' '}
            <time className="font-mono text-xs" dateTime={verification.completedAt}>
              {verification.completedAt.replace('T', ' ')}
            </time>
            .
          </p>
          {!passed ? (
            <p className="mt-2 text-sm text-destructive">
              First mismatch at sequence {verification.firstMismatchSequence ?? 'unknown'}:{' '}
              {verification.firstMismatchType ?? 'unknown mismatch'}.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
