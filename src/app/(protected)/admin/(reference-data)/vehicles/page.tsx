import { SearchX, Truck } from 'lucide-react';

import { ValidationError } from '@/application/shared/errors/application-error';
import { ReferenceFilterForm } from '@/components/master-data/reference-filter-form';
import { ReferencePageHeader } from '@/components/master-data/reference-page-header';
import { ReferencePagination } from '@/components/master-data/reference-pagination';
import { Card, CardContent } from '@/components/ui/card';
import { VehicleCreateDialog } from '@/components/vehicles/vehicle-form';
import { VehicleResults } from '@/components/vehicles/vehicle-results';
import { getServerAuthentication } from '@/lib/auth/server-authentication';
import {
  hasActiveMasterDataFilters,
  masterDataPaginationHref,
  parseMasterDataPageQuery,
  type MasterDataPageSearchParams,
} from '@/lib/master-data/page-query';
import { authorizeMasterDataPageAccess } from '@/lib/master-data/server-master-data-access';

export const dynamic = 'force-dynamic';

export default async function VehiclesPage({
  searchParams,
}: {
  readonly searchParams: Promise<MasterDataPageSearchParams>;
}) {
  const { composition, session, bearerToken } = await getServerAuthentication();
  const access = await authorizeMasterDataPageAccess(
    composition,
    session.principal,
    'vehicle',
    '/admin/vehicles',
  );
  if (access === null) return <Denied />;

  const params = await searchParams;
  let parsed: ReturnType<typeof parseMasterDataPageQuery>;
  try {
    parsed = parseMasterDataPageQuery('vehicle', params);
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    return <QueryError />;
  }

  const [current, page] = await Promise.all([
    composition.getCurrentPrincipal.execute(bearerToken),
    composition.listVehicles.execute({ context: access, query: parsed.query }),
  ]);

  return (
    <div className="space-y-6">
      <ReferencePageHeader
        title="Vehicles"
        description="Maintain fleet identity, serviceability, and selector eligibility for dispatch operations."
        action={<VehicleCreateDialog csrfToken={current.csrfToken} />}
      />
      <ReferenceFilterForm
        action="/admin/vehicles"
        query={parsed.values.query}
        lifecycle={parsed.values.lifecycle}
        status={parsed.values.status}
        statuses={[
          { value: 'SERVICEABLE', label: 'Serviceable' },
          { value: 'UNSERVICEABLE', label: 'Unserviceable' },
        ]}
      />
      <section className="space-y-4" aria-labelledby="vehicle-results-heading">
        <div>
          <h2 id="vehicle-results-heading" className="font-heading text-xl font-semibold">
            Vehicle records
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {page.items.length} record{page.items.length === 1 ? '' : 's'} on this page.
          </p>
        </div>
        {page.items.length === 0 ? (
          <Empty filtered={hasActiveMasterDataFilters(parsed.values)} />
        ) : (
          <VehicleResults items={page.items} />
        )}
        {page.items.length === 0 ? null : (
          <ReferencePagination
            previousHref={
              page.previousCursor === null
                ? null
                : masterDataPaginationHref('vehicle', parsed.values, page.previousCursor)
            }
            nextHref={
              page.nextCursor === null
                ? null
                : masterDataPaginationHref('vehicle', parsed.values, page.nextCursor)
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
          <Truck className="size-8 text-muted-foreground" aria-hidden="true" />
        )}
        <h3 className="font-heading text-lg font-semibold">
          {filtered ? 'No matching vehicles' : 'No vehicles yet'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {filtered ? 'Adjust or clear the filters.' : 'Create the first vehicle reference record.'}
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
        <p className="mt-2 text-muted-foreground">You cannot manage vehicle records.</p>
      </CardContent>
    </Card>
  );
}

function QueryError() {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <h1 className="font-heading text-2xl font-semibold">Invalid vehicle filters</h1>
        <p className="mt-2 text-muted-foreground">Clear the filters and try again.</p>
      </CardContent>
    </Card>
  );
}
