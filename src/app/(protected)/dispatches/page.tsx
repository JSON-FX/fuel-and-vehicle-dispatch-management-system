import { Route, SearchX } from 'lucide-react';
import Link from 'next/link';

import { ValidationError } from '@/application/shared/errors/application-error';
import { DispatchFilterForm } from '@/components/dispatches/dispatch-filter-form';
import { DispatchResults } from '@/components/dispatches/dispatch-results';
import { ReferencePageHeader } from '@/components/master-data/reference-page-header';
import { ReferencePagination } from '@/components/master-data/reference-pagination';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getServerAuthentication } from '@/lib/auth/server-authentication';
import {
  dispatchPaginationHref,
  parseDispatchPageQuery,
  type DispatchPageSearchParams,
} from '@/lib/dispatch/page-query';
import { authorizeDispatchPageAccess } from '@/lib/dispatch/server-dispatch-access';

export const dynamic = 'force-dynamic';

export default async function DispatchesPage({
  searchParams,
}: {
  readonly searchParams: Promise<DispatchPageSearchParams>;
}) {
  const { composition, session } = await getServerAuthentication();
  const access = await authorizeDispatchPageAccess(composition, session.principal, '/dispatches');
  if (access === null) {
    return (
      <Message
        title="Vehicle dispatch access denied"
        body="Your account cannot view vehicle dispatches."
      />
    );
  }

  let parsed: ReturnType<typeof parseDispatchPageQuery>;
  try {
    parsed = parseDispatchPageQuery(await searchParams);
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    return <Message title="Invalid dispatch filters" body="Clear the filters and try again." />;
  }

  const [page, filterOptions] = await Promise.all([
    composition.listDispatches.execute({ context: access, query: parsed.query }),
    composition.getDispatchFilterOptions.execute({ context: access }),
  ]);
  const filtered = Object.values(parsed.values).some((value) => value.length > 0);
  const canCreate = composition.dispatchPermissions.canCreate(session.principal);

  return (
    <div className="space-y-6">
      <ReferencePageHeader
        title="Vehicle dispatches"
        description="Prepare assignments, dispatch vehicles, and preserve exact completion or cancellation evidence."
        action={
          canCreate ? (
            <Button asChild>
              <Link href="/dispatches/new">New dispatch</Link>
            </Button>
          ) : undefined
        }
      />
      <DispatchFilterForm values={parsed.values} offices={filterOptions.offices} />
      <section className="space-y-4" aria-labelledby="dispatch-results-heading">
        <div>
          <h2 id="dispatch-results-heading" className="font-heading text-xl font-semibold">
            Dispatch records
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
                <Route className="size-8 text-muted-foreground" aria-hidden="true" />
              )}
              <h3 className="font-heading text-lg font-semibold">
                {filtered ? 'No matching vehicle dispatches' : 'No vehicle dispatches yet'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {filtered
                  ? 'Adjust or clear the filters.'
                  : 'An authorized dispatch officer can prepare the first draft.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <DispatchResults items={page.items} />
        )}
        {page.items.length === 0 ? null : (
          <ReferencePagination
            previousHref={
              page.previousCursor === null
                ? null
                : dispatchPaginationHref(parsed.values, page.previousCursor)
            }
            nextHref={
              page.nextCursor === null
                ? null
                : dispatchPaginationHref(parsed.values, page.nextCursor)
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
