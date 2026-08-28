import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { NotFoundError } from '@/application/shared/errors/application-error';
import { DriverEditForm } from '@/components/drivers/driver-form';
import { ReferenceLifecycleDialog } from '@/components/master-data/reference-lifecycle-dialog';
import { ReferenceStatusBadge } from '@/components/master-data/reference-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getServerAuthentication } from '@/lib/auth/server-authentication';
import { authorizeMasterDataPageAccess } from '@/lib/master-data/server-master-data-access';
import { masterDataPublicIdSchema } from '@/lib/master-data/route-schemas';

export const dynamic = 'force-dynamic';

export default async function DriverDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly driverId: string }>;
}) {
  const { composition, session, bearerToken } = await getServerAuthentication();
  const access = await authorizeMasterDataPageAccess(
    composition,
    session.principal,
    'driver',
    '/admin/drivers/:driverId',
  );
  if (access === null) return <Denied />;
  const parsedId = masterDataPublicIdSchema.safeParse((await params).driverId);
  if (!parsedId.success) notFound();
  const [current, driver] = await Promise.all([
    composition.getCurrentPrincipal.execute(bearerToken),
    composition.getDriver
      .execute({ context: access, publicId: parsedId.data })
      .catch((error: unknown) => {
        if (error instanceof NotFoundError) return null;
        throw error;
      }),
  ]);
  if (driver === null) notFound();
  const deleted = driver.deletedAt !== null;
  return (
    <div className="space-y-6">
      <Button asChild variant="link">
        <Link href="/admin/drivers">
          <ArrowLeft aria-hidden="true" /> Back to drivers
        </Link>
      </Button>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">{driver.name}</h1>
          {deleted ? (
            <ReferenceStatusBadge label="Deleted" tone="deleted" />
          ) : (
            <ReferenceStatusBadge
              label={driver.status === 'ACTIVE' ? 'Active' : 'Inactive'}
              tone={driver.status === 'ACTIVE' ? 'positive' : 'inactive'}
            />
          )}
        </div>
        <p className="font-mono text-sm text-muted-foreground">{driver.publicId}</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Driver details</CardTitle>
            <CardDescription>
              {deleted
                ? 'Deleted records remain read-only until restored.'
                : 'Contact numbers are manager-only personal data.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {deleted ? (
              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="font-semibold">Driver name</dt>
                  <dd>{driver.name}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Contact number</dt>
                  <dd>{driver.contactNumber ?? 'Not provided'}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Deletion reason</dt>
                  <dd>{driver.deleteReason}</dd>
                </div>
              </dl>
            ) : (
              <DriverEditForm driver={driver} csrfToken={current.csrfToken} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Lifecycle</CardTitle>
            <CardDescription>Restored drivers remain inactive until reviewed.</CardDescription>
          </CardHeader>
          <CardContent>
            {deleted ? (
              <ReferenceLifecycleDialog
                title="Restore driver"
                description="Restore this record as inactive. It will not enter operational selectors yet."
                actionLabel="Restore driver"
                endpoint={`/api/drivers/${driver.publicId}/restore`}
                csrfToken={current.csrfToken}
                requireReason={false}
                trigger={
                  <Button>
                    <RotateCcw aria-hidden="true" /> Restore driver
                  </Button>
                }
              />
            ) : (
              <ReferenceLifecycleDialog
                title="Delete driver"
                description="Remove this driver from current lists while preserving history."
                actionLabel="Delete driver"
                endpoint={`/api/drivers/${driver.publicId}/soft-delete`}
                csrfToken={current.csrfToken}
                requireReason
                trigger={
                  <Button variant="destructive">
                    <Trash2 aria-hidden="true" /> Delete driver
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
        <p className="mt-2 text-muted-foreground">You cannot manage this driver.</p>
      </CardContent>
    </Card>
  );
}
