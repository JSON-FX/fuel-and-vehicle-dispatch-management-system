import { Fuel, SearchX } from 'lucide-react';
import Link from 'next/link';

import { ValidationError } from '@/application/shared/errors/application-error';
import { FuelIssuanceFilterForm } from '@/components/fuel-issuances/fuel-issuance-filter-form';
import { FuelIssuanceResults } from '@/components/fuel-issuances/fuel-issuance-results';
import { ReferencePageHeader } from '@/components/master-data/reference-page-header';
import { ReferencePagination } from '@/components/master-data/reference-pagination';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getServerAuthentication } from '@/lib/auth/server-authentication';
import {
  fuelPaginationHref,
  parseFuelPageQuery,
  type FuelPageSearchParams,
} from '@/lib/fuel/page-query';
import { authorizeFuelPageAccess } from '@/lib/fuel/server-fuel-access';

export const dynamic = 'force-dynamic';

export default async function FuelIssuancesPage({
  searchParams,
}: {
  readonly searchParams: Promise<FuelPageSearchParams>;
}) {
  const { composition, session } = await getServerAuthentication();
  const access = await authorizeFuelPageAccess(composition, session.principal, '/fuel-issuances');
  if (access === null)
    return (
      <Message
        title="Fuel issuance access denied"
        body="Your account cannot view fuel issuances."
      />
    );
  let parsed: ReturnType<typeof parseFuelPageQuery>;
  try {
    parsed = parseFuelPageQuery(await searchParams);
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    return (
      <Message title="Invalid fuel issuance filters" body="Clear the filters and try again." />
    );
  }
  const page = await composition.listFuelIssuances.execute({
    context: access,
    query: parsed.query,
  });
  const filtered = Object.values(parsed.values).some((value) => value.length > 0);
  const canCreate = composition.fuelPermissions.canCreate(session.principal);
  return (
    <div className="space-y-6">
      <ReferencePageHeader
        title="Fuel issuances"
        description="Prepare drafts, assign monthly RIS numbers at posting, and preserve immutable fuel movements."
        action={
          canCreate ? (
            <Button asChild>
              <Link href="/fuel-issuances/new">New fuel issuance</Link>
            </Button>
          ) : undefined
        }
      />
      <div className="flex justify-end">
        <Button asChild variant="outline">
          <Link href="/fuel-issuances/balances">View fuel balances</Link>
        </Button>
      </div>
      <FuelIssuanceFilterForm values={parsed.values} />
      <section className="space-y-4" aria-labelledby="fuel-results-heading">
        <div>
          <h2 id="fuel-results-heading" className="font-heading text-xl font-semibold">
            Issuance records
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {page.items.length} record{page.items.length === 1 ? '' : 's'} on this page.
          </p>
        </div>
        {page.items.length === 0 ? (
          <Card>
            <CardContent className="flex min-h-44 flex-col items-center justify-center gap-2 text-center">
              {filtered ? (
                <SearchX className="size-8 text-muted-foreground" aria-hidden="true" />
              ) : (
                <Fuel className="size-8 text-muted-foreground" aria-hidden="true" />
              )}
              <h3 className="font-heading text-lg font-semibold">
                {filtered ? 'No matching fuel issuances' : 'No fuel issuances yet'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {filtered
                  ? 'Adjust or clear the filters.'
                  : 'An authorized PSMD staff member can prepare the first draft.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <FuelIssuanceResults items={page.items} />
        )}
        {page.items.length === 0 ? null : (
          <ReferencePagination
            previousHref={
              page.previousCursor === null
                ? null
                : fuelPaginationHref(parsed.values, page.previousCursor)
            }
            nextHref={
              page.nextCursor === null ? null : fuelPaginationHref(parsed.values, page.nextCursor)
            }
          />
        )}
      </section>
    </div>
  );
}
function Message({ title, body }: { readonly title: string; readonly body: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <h1 className="font-heading text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}
