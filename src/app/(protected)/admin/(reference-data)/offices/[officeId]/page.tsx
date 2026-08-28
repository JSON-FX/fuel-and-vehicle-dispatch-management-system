import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { NotFoundError } from '@/application/shared/errors/application-error';
import { OfficeEditForm } from '@/components/offices/office-form';
import { ReferenceLifecycleDialog } from '@/components/master-data/reference-lifecycle-dialog';
import { ReferenceStatusBadge } from '@/components/master-data/reference-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getServerAuthentication } from '@/lib/auth/server-authentication';
import { authorizeMasterDataPageAccess } from '@/lib/master-data/server-master-data-access';
import { masterDataPublicIdSchema } from '@/lib/master-data/route-schemas';

export const dynamic = 'force-dynamic';

export default async function OfficeDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly officeId: string }>;
}) {
  const { composition, session, bearerToken } = await getServerAuthentication();
  const access = await authorizeMasterDataPageAccess(
    composition,
    session.principal,
    'office',
    '/admin/offices/:officeId',
  );
  if (access === null) return <Denied />;
  const parsedId = masterDataPublicIdSchema.safeParse((await params).officeId);
  if (!parsedId.success) notFound();
  const [current, office] = await Promise.all([
    composition.getCurrentPrincipal.execute(bearerToken),
    composition.getOffice
      .execute({ context: access, publicId: parsedId.data })
      .catch((error: unknown) => {
        if (error instanceof NotFoundError) return null;
        throw error;
      }),
  ]);
  if (office === null) notFound();
  const deleted = office.deletedAt !== null;
  return (
    <div className="space-y-6">
      <Button asChild variant="link">
        <Link href="/admin/offices">
          <ArrowLeft aria-hidden="true" /> Back to offices
        </Link>
      </Button>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">{office.name}</h1>
          {deleted ? (
            <ReferenceStatusBadge label="Deleted" tone="deleted" />
          ) : (
            <ReferenceStatusBadge
              label={office.status === 'ACTIVE' ? 'Active' : 'Inactive'}
              tone={office.status === 'ACTIVE' ? 'positive' : 'inactive'}
            />
          )}
        </div>
        <p className="font-mono text-sm text-muted-foreground">
          {office.abbreviation} · {office.publicId}
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Office details</CardTitle>
            <CardDescription>
              {deleted
                ? 'Deleted records remain read-only until restored.'
                : 'Update identity and operational status.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {deleted ? (
              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="font-semibold">Office name</dt>
                  <dd>{office.name}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Abbreviation</dt>
                  <dd className="font-mono">{office.abbreviation}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Deletion reason</dt>
                  <dd>{office.deleteReason}</dd>
                </div>
              </dl>
            ) : (
              <OfficeEditForm office={office} csrfToken={current.csrfToken} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Lifecycle</CardTitle>
            <CardDescription>Restored offices remain inactive until reviewed.</CardDescription>
          </CardHeader>
          <CardContent>
            {deleted ? (
              <ReferenceLifecycleDialog
                title="Restore office"
                description="Restore this record as inactive. It will not enter operational selectors yet."
                actionLabel="Restore office"
                endpoint={`/api/offices/${office.publicId}/restore`}
                csrfToken={current.csrfToken}
                requireReason={false}
                trigger={
                  <Button>
                    <RotateCcw aria-hidden="true" /> Restore office
                  </Button>
                }
              />
            ) : (
              <ReferenceLifecycleDialog
                title="Delete office"
                description="Remove this office from current lists while preserving its history."
                actionLabel="Delete office"
                endpoint={`/api/offices/${office.publicId}/soft-delete`}
                csrfToken={current.csrfToken}
                requireReason
                trigger={
                  <Button variant="destructive">
                    <Trash2 aria-hidden="true" /> Delete office
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Denied() {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <h1 className="font-heading text-2xl font-semibold">Access denied</h1>
        <p className="mt-2 text-muted-foreground">You cannot manage this office.</p>
      </CardContent>
    </Card>
  );
}
