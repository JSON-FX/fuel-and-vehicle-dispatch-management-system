import { FileSearch, SearchX } from 'lucide-react';
import Link from 'next/link';

import { ValidationError } from '@/application/shared/errors/application-error';
import { AuditEventTable } from '@/components/audit/audit-event-table';
import { AuditFilterForm } from '@/components/audit/audit-filter-form';
import { AuditVerificationStatus } from '@/components/audit/audit-verification-status';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  auditFilterValues,
  auditPaginationHref,
  hasActiveAuditFilters,
  parseAuditPageQuery,
  type AuditPageSearchParams,
} from '@/lib/audit/page-query';
import { authorizeAuditPageAccess } from '@/lib/audit/server-audit-access';
import { getServerAuthentication } from '@/lib/auth/server-authentication';

export const dynamic = 'force-dynamic';

export default async function AuditPage({
  searchParams,
}: {
  readonly searchParams: Promise<AuditPageSearchParams>;
}) {
  const { composition, session } = await getServerAuthentication();
  const access = await authorizeAuditPageAccess(composition, session.principal, '/audit');
  if (access === null) return <PermissionDenied />;

  const params = await searchParams;
  const values = auditFilterValues(params);
  const verification = await composition.getLatestAuditVerification.execute().catch(() => null);

  let parsed: ReturnType<typeof parseAuditPageQuery> | null = null;
  let invalidQuery = false;
  try {
    parsed = parseAuditPageQuery(params);
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    invalidQuery = true;
  }
  if (invalidQuery || parsed === null) {
    return (
      <AuditPageShell verification={verification} values={values}>
        <QueryError cursor={params.cursor !== undefined} invalid />
      </AuditPageShell>
    );
  }

  let page: Awaited<ReturnType<typeof composition.searchAuditEvents.execute>> | null = null;
  let searchFailure: 'INVALID' | 'REQUEST' | null = null;
  try {
    page = await composition.searchAuditEvents.execute({
      actor: session.principal,
      requestId: access.requestId,
      ipAddress: access.ipAddress,
      userAgent: access.userAgent,
      query: parsed.query,
    });
  } catch (error) {
    searchFailure = error instanceof ValidationError ? 'INVALID' : 'REQUEST';
  }
  if (searchFailure !== null || page === null) {
    return (
      <AuditPageShell verification={verification} values={values}>
        <QueryError cursor={params.cursor !== undefined} invalid={searchFailure === 'INVALID'} />
      </AuditPageShell>
    );
  }

  const filtered = hasActiveAuditFilters(parsed.values);
  return (
    <AuditPageShell verification={verification} values={parsed.values}>
      <section className="space-y-4" aria-labelledby="audit-results-heading">
        <div>
          <h2 id="audit-results-heading" className="font-heading text-xl font-semibold">
            Audit events
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {page.items.length} event{page.items.length === 1 ? '' : 's'} on this page.
          </p>
        </div>
        {page.items.length === 0 ? (
          <EmptyState filtered={filtered} />
        ) : (
          <AuditEventTable items={page.items} />
        )}
        {page.items.length > 0 ? (
          <nav
            aria-label="Audit event pagination"
            className="flex items-center justify-between gap-4"
          >
            {page.previousCursor === null ? (
              <span
                className={cn(
                  buttonVariants({ variant: 'outline' }),
                  'cursor-not-allowed text-muted-foreground',
                )}
              >
                Previous
              </span>
            ) : (
              <Button asChild variant="outline">
                <Link href={auditPaginationHref(parsed.values, page.previousCursor)}>
                  Previous events
                </Link>
              </Button>
            )}
            <span className="text-center text-sm text-muted-foreground">Cursor page</span>
            {page.nextCursor === null ? (
              <span
                className={cn(
                  buttonVariants({ variant: 'outline' }),
                  'cursor-not-allowed text-muted-foreground',
                )}
              >
                Next
              </span>
            ) : (
              <Button asChild variant="outline">
                <Link href={auditPaginationHref(parsed.values, page.nextCursor)}>Next events</Link>
              </Button>
            )}
          </nav>
        ) : null}
      </section>
    </AuditPageShell>
  );
}

function AuditPageShell({
  verification,
  values,
  children,
}: {
  readonly verification: Parameters<typeof AuditVerificationStatus>[0]['verification'];
  readonly values: Parameters<typeof AuditFilterForm>[0]['values'];
  readonly children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Audit trail</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Review the immutable record of security and operational activity.
        </p>
      </header>
      <AuditVerificationStatus verification={verification} />
      <AuditFilterForm values={values} />
      {children}
    </div>
  );
}

function EmptyState({ filtered }: { readonly filtered: boolean }) {
  return (
    <Card>
      <CardContent className="flex min-h-44 flex-col items-center justify-center gap-2 text-center">
        {filtered ? (
          <SearchX className="size-8 text-muted-foreground" aria-hidden="true" />
        ) : (
          <FileSearch className="size-8 text-muted-foreground" aria-hidden="true" />
        )}
        <h3 className="font-heading text-lg font-semibold">
          {filtered ? 'No matching audit events' : 'No audit events yet'}
        </h3>
        <p className="max-w-prose text-sm text-muted-foreground">
          {filtered
            ? 'Adjust or clear the filters to broaden the search.'
            : 'Events will appear after audited system activity is finalized.'}
        </p>
      </CardContent>
    </Card>
  );
}

function QueryError({ cursor, invalid }: { readonly cursor: boolean; readonly invalid: boolean }) {
  const title = invalid
    ? cursor
      ? 'The pagination cursor is invalid'
      : 'The audit filters are invalid'
    : 'Audit events could not be loaded';
  const description = invalid
    ? cursor
      ? 'Clear the filters to restart from the newest audit events.'
      : 'Check the timestamp format and identifiers, then search again.'
    : 'Keep the current filters and try the request again.';
  return (
    <Alert aria-live="assertive">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}

function PermissionDenied() {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <h1 className="font-heading text-2xl font-semibold">Access denied</h1>
        <p className="mt-2 text-muted-foreground">
          Your account does not have permission to view the audit trail.
        </p>
      </CardContent>
    </Card>
  );
}
