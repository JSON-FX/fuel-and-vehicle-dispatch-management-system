import Link from 'next/link';

import type { DispatchDetailDto } from '@/application/dispatch/dto/dispatch-dtos';
import { CancelDispatchDialog } from '@/components/dispatches/cancel-dispatch-dialog';
import { CompleteDispatchDialog } from '@/components/dispatches/complete-dispatch-dialog';
import { DispatchConfirmDialog } from '@/components/dispatches/dispatch-confirm-dialog';
import { DispatchConflictHistory } from '@/components/dispatches/dispatch-conflict-history';
import {
  formatDispatchCivilDate,
  formatDispatchDateTime,
  formatDispatchOdometer,
} from '@/components/dispatches/dispatch-format';
import { DispatchStatusBadge } from '@/components/dispatches/dispatch-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function DispatchDetail({
  dispatch,
  canUpdate,
  canComplete,
  canCancel,
}: {
  readonly dispatch: DispatchDetailDto;
  readonly canUpdate: boolean;
  readonly canComplete: boolean;
  readonly canCancel: boolean;
}) {
  const terminal = dispatch.status === 'COMPLETED' || dispatch.status === 'CANCELLED';
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            {dispatch.destination}
          </h1>
          <DispatchStatusBadge status={dispatch.status} />
        </div>
        <p className="text-muted-foreground">
          {formatDispatchCivilDate(dispatch.travelDate)} ·{' '}
          <span className="font-mono">{dispatch.vehicle.plateNumber}</span>
        </p>
        <p className="font-mono text-xs text-muted-foreground">{dispatch.publicId}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="space-y-6">
          <DetailCard title="Dispatch information">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Details label="Entry date">{formatDispatchCivilDate(dispatch.entryDate)}</Details>
              <Details label="Travel date">{formatDispatchCivilDate(dispatch.travelDate)}</Details>
              <Details label="Destination">{dispatch.destination}</Details>
              <Details label="Requesting office">
                {dispatch.requestingOffice.name} ({dispatch.requestingOffice.abbreviation})
              </Details>
              <Details label="Purpose" wide>
                {dispatch.purpose}
              </Details>
            </dl>
          </DetailCard>

          <DetailCard title="Assigned resources">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Details label="Driver">{dispatch.driver.name}</Details>
              <Details label="Passenger count">
                {dispatch.passengerCount}{' '}
                {dispatch.passengerCount === 1 ? 'passenger' : 'passengers'}
              </Details>
              <Details label="Vehicle" wide>
                {dispatch.vehicle.plateNumber} · {dispatch.vehicle.modelBrand} ·{' '}
                {dispatch.vehicle.vehicleType}
              </Details>
            </dl>
          </DetailCard>

          <DetailCard title="Odometer evidence">
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
              <Details label="Initial reading">
                <span className="font-mono">{formatDispatchOdometer(dispatch.odoBefore)}</span>
              </Details>
              <Details label="Final reading">
                <span className="font-mono">
                  {dispatch.odoAfter === null
                    ? 'Pending'
                    : formatDispatchOdometer(dispatch.odoAfter)}
                </span>
              </Details>
              <Details label="Distance">
                <span className="font-mono">
                  {dispatch.distance === null
                    ? 'Pending'
                    : formatDispatchOdometer(dispatch.distance)}
                </span>
              </Details>
            </dl>
          </DetailCard>

          <DetailCard title="Lifecycle history">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Details label="Created">
                <time dateTime={dispatch.createdAt}>
                  {formatDispatchDateTime(dispatch.createdAt)}
                </time>
              </Details>
              <Details label="Last updated">
                <time dateTime={dispatch.updatedAt}>
                  {formatDispatchDateTime(dispatch.updatedAt)}
                </time>
              </Details>
              <Details label="Dispatched">{lifecycleTime(dispatch.dispatchedAt)}</Details>
              <Details label="Completed">{lifecycleTime(dispatch.completedAt)}</Details>
              <Details label="Cancelled">{lifecycleTime(dispatch.cancelledAt)}</Details>
              <Details label="Cancellation reason" wide>
                {dispatch.cancellationReason ?? 'Not applicable'}
              </Details>
            </dl>
          </DetailCard>

          <DetailCard title="Schedule conflict acknowledgments">
            <DispatchConflictHistory items={dispatch.conflictAcknowledgments ?? []} />
          </DetailCard>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Lifecycle actions</CardTitle>
            <CardDescription>
              Controls follow your exact dispatch permissions and the current status.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dispatch.status === 'DRAFT' && canUpdate ? (
              <Button asChild variant="outline" className="w-full">
                <Link href={`/dispatches/${dispatch.publicId}?edit=1`}>Edit draft</Link>
              </Button>
            ) : null}
            {dispatch.status === 'DRAFT' && canUpdate ? (
              <DispatchConfirmDialog dispatch={dispatch} />
            ) : null}
            {dispatch.status === 'DISPATCHED' && canComplete ? (
              <CompleteDispatchDialog dispatch={dispatch} />
            ) : null}
            {(dispatch.status === 'DRAFT' || dispatch.status === 'DISPATCHED') && canCancel ? (
              <CancelDispatchDialog dispatch={dispatch} />
            ) : null}
            {terminal ? (
              <p className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">
                This dispatch is terminal. Its operational and lifecycle evidence is read-only.
              </p>
            ) : !canUpdate && !canComplete && !canCancel ? (
              <p className="text-sm text-muted-foreground">
                This record is read-only for your account.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DetailCard({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Details({
  label,
  children,
  wide = false,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
  readonly wide?: boolean;
}) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="font-semibold">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function lifecycleTime(value: string | null): React.ReactNode {
  return value === null ? (
    'Not recorded'
  ) : (
    <time dateTime={value}>{formatDispatchDateTime(value)}</time>
  );
}
