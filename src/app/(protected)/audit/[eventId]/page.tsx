import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import type { AuditEventDetailDto } from '@/application/audit/dto/audit-event-dtos';
import { NotFoundError, ValidationError } from '@/application/shared/errors/application-error';
import { AuditVerificationStatus } from '@/components/audit/audit-verification-status';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { authorizeAuditPageAccess } from '@/lib/audit/server-audit-access';
import { getServerAuthentication } from '@/lib/auth/server-authentication';

export const dynamic = 'force-dynamic';

export default async function AuditEventPage({
  params,
}: {
  readonly params: Promise<{ readonly eventId: string }>;
}) {
  const { composition, session } = await getServerAuthentication();
  const access = await authorizeAuditPageAccess(composition, session.principal, '/audit/:eventId');
  if (access === null) return <PermissionDenied />;

  const verification = await composition.getLatestAuditVerification.execute().catch(() => null);
  let event: AuditEventDetailDto | null = null;
  let failure: 'NOT_FOUND' | 'REQUEST' | null = null;
  try {
    event = await composition.getAuditEvent.execute({
      actor: session.principal,
      eventPublicId: (await params).eventId,
      requestId: access.requestId,
      ipAddress: access.ipAddress,
      userAgent: access.userAgent,
    });
  } catch (error) {
    failure =
      error instanceof ValidationError || error instanceof NotFoundError ? 'NOT_FOUND' : 'REQUEST';
  }
  if (failure === 'NOT_FOUND') {
    return (
      <DetailState
        title="Audit event not found"
        description="Check the event link or return to the audit trail."
      />
    );
  }
  if (failure === 'REQUEST' || event === null) {
    return (
      <DetailState
        title="Audit event could not be loaded"
        description="Return to the audit trail and try the request again."
      />
    );
  }
  return <AuditEventDetail event={event} verification={verification} />;
}

function AuditEventDetail({
  event,
  verification,
}: {
  readonly event: AuditEventDetailDto;
  readonly verification: Parameters<typeof AuditVerificationStatus>[0]['verification'];
}) {
  return (
    <div className="space-y-6">
      <Button asChild variant="link">
        <Link href="/audit">
          <ArrowLeft aria-hidden="true" />
          Back to audit trail
        </Link>
      </Button>
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Audit event</h1>
          <Badge>{sentenceCaseAction(event.action)}</Badge>
        </div>
        <p className="mt-2 break-all font-mono text-sm text-muted-foreground">{event.publicId}</p>
      </header>
      <AuditVerificationStatus verification={verification} />
      <EvidenceSection title="Event summary">
        <EvidenceItem label="Occurred at">
          <time className="font-mono text-sm" dateTime={event.occurredAt}>
            {event.occurredAt}
          </time>
        </EvidenceItem>
        <EvidenceItem label="Canonical action">
          <code>{event.action}</code>
        </EvidenceItem>
        <EvidenceItem label="Sequence">
          <code>{event.sequence}</code>
        </EvidenceItem>
        <EvidenceItem label="Schema version">
          <code>{event.schemaVersion}</code>
        </EvidenceItem>
        <EvidenceItem label="Reason code">{event.reasonCode ?? 'Not applicable'}</EvidenceItem>
      </EvidenceSection>
      <EvidenceSection title="Actor and entity">
        <EvidenceItem label="Actor public ID">
          <code>{event.actorPublicId ?? 'System'}</code>
        </EvidenceItem>
        <EvidenceItem label="Entity type">{event.entity?.type ?? 'Not applicable'}</EvidenceItem>
        <EvidenceItem label="Entity public ID">
          <code>{event.entity?.publicId ?? 'Not applicable'}</code>
        </EvidenceItem>
      </EvidenceSection>
      <EvidenceSection title="Request context">
        <EvidenceItem label="Request ID">
          <code>{event.requestId}</code>
        </EvidenceItem>
        {event.sensitive === null ? (
          <div className="rounded-md border bg-muted p-4 text-sm text-muted-foreground sm:col-span-2">
            Sensitive request context is hidden because your account lacks that permission.
          </div>
        ) : (
          <>
            <EvidenceItem label="IP address">
              <code>{event.sensitive.ipAddress ?? 'Unavailable'}</code>
            </EvidenceItem>
            <EvidenceItem label="User agent">
              <span className="break-words">{event.sensitive.userAgent ?? 'Unavailable'}</span>
            </EvidenceItem>
          </>
        )}
      </EvidenceSection>
      <EvidenceSection title="Chain evidence">
        <EvidenceItem label="Source position">
          <code>{event.sourcePosition}</code>
        </EvidenceItem>
        <EvidenceItem label="Chained at">
          <time className="font-mono text-sm" dateTime={event.chainedAt}>
            {event.chainedAt}
          </time>
        </EvidenceItem>
        <EvidenceItem label="Previous hash">
          <code>{event.previousHashHex}</code>
        </EvidenceItem>
        <EvidenceItem label="Record hash">
          <code>{event.recordHashHex}</code>
        </EvidenceItem>
      </EvidenceSection>
      {event.sensitive === null ? null : (
        <Card aria-labelledby="audit-payload-heading">
          <CardHeader>
            <h2 id="audit-payload-heading" className="font-heading text-xl font-semibold">
              Sensitive event context
            </h2>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-3">
            <JsonEvidence label="Before" value={event.sensitive.before} />
            <JsonEvidence label="After" value={event.sensitive.after} />
            <JsonEvidence label="Metadata" value={event.sensitive.metadata} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EvidenceSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  const id = `audit-${title.toLowerCase().replaceAll(' ', '-')}`;
  return (
    <Card aria-labelledby={id}>
      <CardHeader>
        <h2 id={id} className="font-heading text-xl font-semibold">
          {title}
        </h2>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-5 sm:grid-cols-2">{children}</dl>
      </CardContent>
    </Card>
  );
}

function EvidenceItem({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-sm font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-1 min-w-0 break-all [&_code]:font-mono [&_code]:text-sm">{children}</dd>
    </div>
  );
}

function JsonEvidence({ label, value }: { readonly label: string; readonly value: unknown }) {
  return (
    <section aria-labelledby={`audit-json-${label.toLowerCase()}`} className="min-w-0">
      <h3 id={`audit-json-${label.toLowerCase()}`} className="font-heading font-semibold">
        {label}
      </h3>
      <pre
        className="mt-2 max-h-80 overflow-auto rounded-md border bg-muted p-3 text-xs whitespace-pre-wrap break-all"
        tabIndex={0}
      >
        {value === null ? 'Not recorded' : JSON.stringify(value, null, 2)}
      </pre>
    </section>
  );
}

function DetailState({
  title,
  description,
}: {
  readonly title: string;
  readonly description: string;
}) {
  return (
    <div className="space-y-4">
      <Button asChild variant="link">
        <Link href="/audit">
          <ArrowLeft aria-hidden="true" />
          Back to audit trail
        </Link>
      </Button>
      <Alert>
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{description}</AlertDescription>
      </Alert>
    </div>
  );
}

function PermissionDenied() {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <h1 className="font-heading text-2xl font-semibold">Access denied</h1>
        <p className="mt-2 text-muted-foreground">
          Your account does not have permission to view this audit event.
        </p>
      </CardContent>
    </Card>
  );
}

function sentenceCaseAction(action: string): string {
  return action
    .replaceAll('.', ' ')
    .replaceAll('_', ' ')
    .replace(/^./, (character) => character.toUpperCase());
}
