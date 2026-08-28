import { SearchX, WalletCards } from 'lucide-react';

import { ValidationError } from '@/application/shared/errors/application-error';
import { BudgetAllocationFilterForm } from '@/components/budget-allocations/budget-allocation-filter-form';
import { BudgetAllocationCreateDialog } from '@/components/budget-allocations/budget-allocation-form';
import { BudgetAllocationResults } from '@/components/budget-allocations/budget-allocation-results';
import { ReferencePageHeader } from '@/components/master-data/reference-page-header';
import { ReferencePagination } from '@/components/master-data/reference-pagination';
import { Card, CardContent } from '@/components/ui/card';
import { getServerAuthentication } from '@/lib/auth/server-authentication';
import {
  budgetAllocationPaginationHref,
  hasActiveBudgetAllocationFilters,
  parseBudgetAllocationPageQuery,
  type BudgetAllocationPageSearchParams,
} from '@/lib/budget/page-query';
import { authorizeBudgetPageAccess } from '@/lib/budget/server-budget-access';

export const dynamic = 'force-dynamic';

export default async function BudgetAllocationsPage({
  searchParams,
}: {
  readonly searchParams: Promise<BudgetAllocationPageSearchParams>;
}) {
  const { composition, session, bearerToken } = await getServerAuthentication();
  const access = await authorizeBudgetPageAccess(
    composition,
    session.principal,
    '/budget-allocations',
  );
  if (access === null) return <PermissionDenied />;

  const params = await searchParams;
  let parsed: ReturnType<typeof parseBudgetAllocationPageQuery>;
  try {
    parsed = parseBudgetAllocationPageQuery(params);
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    return <InvalidFilters />;
  }

  const canManage = composition.budgetPermissions.canManage(session.principal);
  const pagePromise = composition.listBudgetAllocations.execute({
    context: access,
    query: parsed.query,
  });
  const managementPromise = canManage
    ? Promise.all([
        composition.getCurrentPrincipal.execute(bearerToken),
        composition.listOperationalOfficeOptions.execute({
          context: access,
          query: {
            mode: 'operational',
            query: null,
            lifecycle: 'current',
            status: 'ACTIVE',
            cursor: null,
            pageSize: 200,
          },
        }),
      ])
    : null;
  const [page, management] = await Promise.all([pagePromise, managementPromise]);
  const currentPeriod = composition.fiscalPeriodPolicy.resolve(new Date());
  const filtered = hasActiveBudgetAllocationFilters(parsed.values);

  return (
    <div className="space-y-6">
      <ReferencePageHeader
        title="Budget allocations"
        description="Manage PPMP allocations by office and fiscal period, then control their operational eligibility."
        action={
          management === null ? undefined : (
            <BudgetAllocationCreateDialog
              csrfToken={management[0].csrfToken}
              offices={management[1].items}
              defaultFiscalYear={currentPeriod.fiscalYear}
              defaultQuarter={currentPeriod.quarter}
            />
          )
        }
      />
      {management !== null && management[1].items.length === 0 ? (
        <p className="text-sm text-muted-foreground" role="status">
          Create an active office before creating a budget allocation.
        </p>
      ) : null}
      <BudgetAllocationFilterForm values={parsed.values} />
      <section className="space-y-4" aria-labelledby="budget-results-heading">
        <div>
          <h2 id="budget-results-heading" className="font-heading text-xl font-semibold">
            Allocation records
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {page.items.length} record{page.items.length === 1 ? '' : 's'} on this page.
          </p>
        </div>
        {page.items.length === 0 ? (
          <EmptyState filtered={filtered} />
        ) : (
          <BudgetAllocationResults items={page.items} canManage={canManage} />
        )}
        {page.items.length === 0 ? null : (
          <ReferencePagination
            previousHref={
              page.previousCursor === null
                ? null
                : budgetAllocationPaginationHref(parsed.values, page.previousCursor)
            }
            nextHref={
              page.nextCursor === null
                ? null
                : budgetAllocationPaginationHref(parsed.values, page.nextCursor)
            }
          />
        )}
      </section>
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
          <WalletCards className="size-8 text-muted-foreground" aria-hidden="true" />
        )}
        <h3 className="font-heading text-lg font-semibold">
          {filtered ? 'No matching budget allocations' : 'No budget allocations yet'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {filtered
            ? 'Adjust or clear the filters.'
            : 'An authorized Budget Officer can create the first draft allocation.'}
        </p>
      </CardContent>
    </Card>
  );
}

function PermissionDenied() {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <h1 className="font-heading text-2xl font-semibold">Budget allocation access denied</h1>
        <p className="mt-2 text-muted-foreground">Your account cannot view budget allocations.</p>
      </CardContent>
    </Card>
  );
}

function InvalidFilters() {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <h1 className="font-heading text-2xl font-semibold">Invalid budget allocation filters</h1>
        <p className="mt-2 text-muted-foreground">Clear the filters and try again.</p>
      </CardContent>
    </Card>
  );
}
