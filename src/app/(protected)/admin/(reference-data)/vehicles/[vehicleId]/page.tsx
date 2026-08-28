import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { NotFoundError } from '@/application/shared/errors/application-error';
import { ReferenceLifecycleDialog } from '@/components/master-data/reference-lifecycle-dialog';
import { ReferenceStatusBadge } from '@/components/master-data/reference-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { VehicleEditForm } from '@/components/vehicles/vehicle-form';
import { getServerAuthentication } from '@/lib/auth/server-authentication';
import { masterDataPublicIdSchema } from '@/lib/master-data/route-schemas';
import { authorizeMasterDataPageAccess } from '@/lib/master-data/server-master-data-access';

export const dynamic = 'force-dynamic';

export default async function VehicleDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly vehicleId: string }>;
}) {
  const { composition, session, bearerToken } = await getServerAuthentication();
  const access = await authorizeMasterDataPageAccess(
    composition,
    session.principal,
    'vehicle',
    '/admin/vehicles/:vehicleId',
  );
  if (access === null) return <Denied />;

  const parsedId = masterDataPublicIdSchema.safeParse((await params).vehicleId);
  if (!parsedId.success) notFound();

  const [current, vehicle] = await Promise.all([
    composition.getCurrentPrincipal.execute(bearerToken),
    composition.getVehicle
      .execute({ context: access, publicId: parsedId.data })
      .catch((error: unknown) => {
        if (error instanceof NotFoundError) return null;
        throw error;
      }),
  ]);
  if (vehicle === null) notFound();

  const deleted = vehicle.deletedAt !== null;
  return (
    <div className="space-y-6">
      <Button asChild variant="link">
        <Link href="/admin/vehicles">
          <ArrowLeft aria-hidden="true" /> Back to vehicles
        </Link>
      </Button>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            {vehicle.modelBrand}
          </h1>
          {deleted ? (
            <ReferenceStatusBadge label="Deleted" tone="deleted" />
          ) : (
            <ReferenceStatusBadge
              label={vehicle.status === 'SERVICEABLE' ? 'Serviceable' : 'Unserviceable'}
              tone={vehicle.status === 'SERVICEABLE' ? 'positive' : 'warning'}
            />
          )}
        </div>
        <p className="font-mono text-sm text-muted-foreground">{vehicle.plateNumber}</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Vehicle details</CardTitle>
            <CardDescription>
              {deleted
                ? 'Deleted records remain read-only until restored.'
                : 'Only serviceable vehicles enter operational selectors.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {deleted ? (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-semibold">Model or brand</dt>
                  <dd>{vehicle.modelBrand}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Vehicle type</dt>
                  <dd>{vehicle.vehicleType}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Plate number</dt>
                  <dd className="font-mono">{vehicle.plateNumber}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Remarks</dt>
                  <dd>{vehicle.remarks ?? 'Not provided'}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="font-semibold">Deletion reason</dt>
                  <dd>{vehicle.deleteReason}</dd>
                </div>
              </dl>
            ) : (
              <VehicleEditForm vehicle={vehicle} csrfToken={current.csrfToken} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Lifecycle</CardTitle>
            <CardDescription>
              Restored vehicles remain unserviceable until reviewed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {deleted ? (
              <ReferenceLifecycleDialog
                title="Restore vehicle"
                description="Restore this record as unserviceable. It will not enter operational selectors yet."
                actionLabel="Restore vehicle"
                endpoint={`/api/vehicles/${vehicle.publicId}/restore`}
                csrfToken={current.csrfToken}
                requireReason={false}
                trigger={
                  <Button>
                    <RotateCcw aria-hidden="true" /> Restore vehicle
                  </Button>
                }
              />
            ) : (
              <ReferenceLifecycleDialog
                title="Delete vehicle"
                description="Remove this vehicle from current lists while preserving history."
                actionLabel="Delete vehicle"
                endpoint={`/api/vehicles/${vehicle.publicId}/soft-delete`}
                csrfToken={current.csrfToken}
                requireReason
                trigger={
                  <Button variant="destructive">
                    <Trash2 aria-hidden="true" /> Delete vehicle
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
        <p className="mt-2 text-muted-foreground">You cannot manage this vehicle.</p>
      </CardContent>
    </Card>
  );
}
