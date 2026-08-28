import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { NotFoundError } from '@/application/shared/errors/application-error';
import { BudgetAllocationEditForm } from '@/components/budget-allocations/budget-allocation-form';
import { BudgetAllocationStatusBadge } from '@/components/budget-allocations/budget-allocation-status-badge';
import { BudgetAllocationDetailActions } from '@/components/budget-allocations/budget-allocation-transition-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getServerAuthentication } from '@/lib/auth/server-authentication';
import { authorizeBudgetPageAccess } from '@/lib/budget/server-budget-access';
import { budgetAllocationPublicIdSchema } from '@/lib/budget/route-schemas';

export const dynamic = 'force-dynamic';

export default async function BudgetAllocationDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly budgetAllocationId: string }>;
}) {
  const { composition, session, bearerToken } = await getServerAuthentication();
  const access = await authorizeBudgetPageAccess(
    composition,
    session.principal,
    '/budget-allocations/:budgetAllocationId',
  );
  if (access === null) return <PermissionDenied />;

  const parsedId = budgetAllocationPublicIdSchema.safeParse((await params).budgetAllocationId);
  if (!parsedId.success) notFound();
  const allocation = await composition.getBudgetAllocation
    .execute({ context: access, publicId: parsedId.data })
    .catch((error: unknown) => {
      if (error instanceof NotFoundError) return null;
      throw error;
    });
  if (allocation === null) notFound();

  const canManage = composition.budgetPermissions.canManage(session.principal);
  const management = canManage
    ? await Promise.all([
        composition.getCurrentPrincipal.execute(bearerToken),
        allocation.status === 'DRAFT' && allocation.deletedAt === null
          ? composition.listOperationalOfficeOptions.execute({
              context: access,
              query: {
                mode: 'operational',
                query: null,
                lifecycle: 'current',
                status: 'ACTIVE',
                cursor: null,
                pageSize: 200,
              },
            })
          : null,
      ])
    : null;
  const deleted = allocation.deletedAt !== null;

  return (
    <div className="space-y-6">
      <Button asChild variant="link">
        <Link href="/budget-allocations">
          <ArrowLeft aria-hidden="true" /> Back to budget allocations
        </Link>
      </Button>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Budget allocation {allocation.ppmpNumber}
          </h1>
          <BudgetAllocationStatusBadge
            status={allocation.status}
            deleted={deleted}
            eligible={allocation.eligible}
          />
        </div>
        <p className="font-mono text-sm text-muted-foreground">{allocation.publicId}</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Allocation details</CardTitle>
            <CardDescription>{detailDescription(allocation)}</CardDescription>
          </CardHeader>
          <CardContent>
            {management !== null && management[1] !== null ? (
              <BudgetAllocationEditForm
                allocation={allocation}
                offices={management[1].items}
                csrfToken={management[0].csrfToken}
              />
            ) : (
              <AllocationDetails allocation={allocation} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Lifecycle actions</CardTitle>
            <CardDescription>{lifecycleDescription(allocation)}</CardDescription>
          </CardHeader>
          <CardContent>
            {management === null ? (
              <p className="text-sm text-muted-foreground">
                You have read-only access to this allocation.
              </p>
            ) : (
              <BudgetAllocationDetailActions
                key={`${allocation.status}-${allocation.deletedAt ?? 'current'}`}
                allocation={allocation}
                csrfToken={management[0].csrfToken}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AllocationDetails({
  allocation,
}: {
  readonly allocation: Awaited<
    ReturnType<
      import('@/application/budget/use-cases/get-budget-allocation').GetBudgetAllocation['execute']
    >
  >;
}) {
  return (
    <dl className="grid gap-4 text-sm sm:grid-cols-2">
      <Details label="PPMP number" monospace>
        {allocation.ppmpNumber}
      </Details>
      <Details label="Office">
        {allocation.office.name} ({allocation.office.abbreviation})
      </Details>
      <Details label="Fiscal period">
        FY {allocation.fiscalYear} · Quarter {allocation.quarter}
      </Details>
      <Details label="Allocation status">{statusLabel(allocation.status)}</Details>
      <Details label="Fiscal eligibility">
        {allocation.eligible ? 'Eligible now' : 'Not eligible now'}
      </Details>
      <Details label="Record lifecycle">
        {allocation.deletedAt === null ? 'Current' : 'Deleted'}
      </Details>
      <Details label="Updated">
        <time dateTime={allocation.updatedAt}>{formatDate(allocation.updatedAt)}</time>
      </Details>
      {allocation.deleteReason === null ? null : (
        <Details label="Deletion reason" wide>
          {allocation.deleteReason}
        </Details>
      )}
    </dl>
  );
}

function Details({
  label,
  children,
  monospace = false,
  wide = false,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
  readonly monospace?: boolean;
  readonly wide?: boolean;
}) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="font-semibold">{label}</dt>
      <dd className={monospace ? 'font-mono' : undefined}>{children}</dd>
    </div>
  );
}

function detailDescription(allocation: {
  readonly deletedAt: string | null;
  readonly status: string;
}) {
  if (allocation.deletedAt !== null) return 'Deleted records remain read-only until restored.';
  if (allocation.status === 'DRAFT')
    return 'Draft identity fields remain editable before activation.';
  return 'Activated and terminal allocation identity fields are read-only.';
}

function lifecycleDescription(allocation: {
  readonly deletedAt: string | null;
  readonly status: string;
}) {
  if (allocation.deletedAt !== null)
    return 'Restored active allocations return as drafts for review.';
  if (allocation.status === 'CLOSED' || allocation.status === 'CANCELLED') {
    return 'This allocation is terminal and cannot transition to another status.';
  }
  return 'Every lifecycle change is confirmed and recorded in the audit trail.';
}

function statusLabel(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value));
}

function PermissionDenied() {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <h1 className="font-heading text-2xl font-semibold">
          Budget allocation detail access denied
        </h1>
        <p className="mt-2 text-muted-foreground">
          Your account cannot view this budget allocation.
        </p>
      </CardContent>
    </Card>
  );
}
