import { Building2, SearchX } from 'lucide-react';

import { ValidationError } from '@/application/shared/errors/application-error';
import { OfficeCreateDialog } from '@/components/offices/office-form';
import { OfficeResults } from '@/components/offices/office-results';
import { ReferenceFilterForm } from '@/components/master-data/reference-filter-form';
import { ReferencePageHeader } from '@/components/master-data/reference-page-header';
import { ReferencePagination } from '@/components/master-data/reference-pagination';
import { Card, CardContent } from '@/components/ui/card';
import { getServerAuthentication } from '@/lib/auth/server-authentication';
import {
  hasActiveMasterDataFilters,
  masterDataPaginationHref,
  parseMasterDataPageQuery,
  type MasterDataPageSearchParams,
} from '@/lib/master-data/page-query';
import { authorizeMasterDataPageAccess } from '@/lib/master-data/server-master-data-access';

export const dynamic = 'force-dynamic';

export default async function OfficesPage({
  searchParams,
}: {
  readonly searchParams: Promise<MasterDataPageSearchParams>;
}) {
  const { composition, session, bearerToken } = await getServerAuthentication();
  const access = await authorizeMasterDataPageAccess(
    composition,
    session.principal,
    'office',
    '/admin/offices',
  );
  if (access === null) return <Denied />;
  const params = await searchParams;
  let parsed: ReturnType<typeof parseMasterDataPageQuery>;
  try {
    parsed = parseMasterDataPageQuery('office', params);
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    return <QueryError />;
  }
  const [current, page] = await Promise.all([
    composition.getCurrentPrincipal.execute(bearerToken),
    composition.listOffices.execute({ context: access, query: parsed.query }),
  ]);
  return (
    <div className="space-y-6">
      <ReferencePageHeader
        title="Offices"
        description="Maintain the offices used by budget, fuel, and dispatch workflows."
        action={<OfficeCreateDialog csrfToken={current.csrfToken} />}
      />
      <ReferenceFilterForm
        action="/admin/offices"
        query={parsed.values.query}
        lifecycle={parsed.values.lifecycle}
        status={parsed.values.status}
        statuses={[
          { value: 'ACTIVE', label: 'Active' },
          { value: 'INACTIVE', label: 'Inactive' },
        ]}
      />
      <section className="space-y-4" aria-labelledby="office-results-heading">
        <div>
          <h2 id="office-results-heading" className="font-heading text-xl font-semibold">
            Office records
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {page.items.length} record{page.items.length === 1 ? '' : 's'} on this page.
          </p>
        </div>
        {page.items.length === 0 ? (
          <Empty filtered={hasActiveMasterDataFilters(parsed.values)} />
        ) : (
          <OfficeResults items={page.items} />
        )}
        {page.items.length === 0 ? null : (
          <ReferencePagination
            previousHref={
              page.previousCursor === null
                ? null
                : masterDataPaginationHref('office', parsed.values, page.previousCursor)
            }
            nextHref={
              page.nextCursor === null
                ? null
                : masterDataPaginationHref('office', parsed.values, page.nextCursor)
            }
          />
        )}
      </section>
    </div>
  );
}

function Empty({ filtered }: { readonly filtered: boolean }) {
  return (
    <Card>
      <CardContent className="flex min-h-44 flex-col items-center justify-center gap-2 text-center">
        {filtered ? (
          <SearchX className="size-8 text-muted-foreground" aria-hidden="true" />
        ) : (
          <Building2 className="size-8 text-muted-foreground" aria-hidden="true" />
        )}
        <h3 className="font-heading text-lg font-semibold">
          {filtered ? 'No matching offices' : 'No offices yet'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {filtered ? 'Adjust or clear the filters.' : 'Create the first office reference record.'}
        </p>
      </CardContent>
    </Card>
  );
}
function Denied() {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <h1 className="font-heading text-2xl font-semibold">Access denied</h1>
        <p className="mt-2 text-muted-foreground">You cannot manage office records.</p>
      </CardContent>
    </Card>
  );
}
function QueryError() {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <h1 className="font-heading text-2xl font-semibold">Invalid office filters</h1>
        <p className="mt-2 text-muted-foreground">Clear the filters and try again.</p>
      </CardContent>
    </Card>
  );
}
