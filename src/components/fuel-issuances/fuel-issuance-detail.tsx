import Link from 'next/link';

import type { FuelIssuanceDetailDto } from '@/application/fuel/dto/fuel-dtos';
import { FuelIssuancePostDialog } from '@/components/fuel-issuances/fuel-issuance-post-dialog';
import { FuelIssuanceStatusBadge } from '@/components/fuel-issuances/fuel-issuance-status-badge';
import { FuelIssuanceVoidDialog } from '@/components/fuel-issuances/fuel-issuance-void-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function FuelIssuanceDetail({
  issuance,
  csrfToken,
  canCreate,
  canPost,
  canVoid,
}: {
  readonly issuance: FuelIssuanceDetailDto;
  readonly csrfToken: string | null;
  readonly canCreate: boolean;
  readonly canPost: boolean;
  readonly canVoid: boolean;
}) {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            {issuance.risNumber ?? 'Pending RIS'}
          </h1>
          <FuelIssuanceStatusBadge status={issuance.status} />
        </div>
        <p className="font-mono text-sm text-muted-foreground">
          {issuance.purchaseRequestNumber} · {issuance.publicId}
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="space-y-6">
          <DetailCard title="Request and dispatch">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Details label="Entry date">{issuance.entryDate}</Details>
              <Details label="Purchase request">
                <span className="font-mono">{issuance.purchaseRequestNumber}</span>
              </Details>
              <Details label="Driver">{issuance.driver.name}</Details>
              <Details label="Destination">{issuance.destination}</Details>
              <Details label="Vehicle">
                {issuance.vehicle.plateNumber} · {issuance.vehicle.modelBrand}
              </Details>
              <Details label="Vehicle type">{issuance.vehicle.vehicleType}</Details>
              <Details label="Purpose" wide>
                {issuance.purpose}
              </Details>
            </dl>
          </DetailCard>
          <DetailCard title="Fuel, price, and budget">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Details label="Fuel type">
                {issuance.fuelType === 'DIESEL' ? 'Diesel' : 'Gasoline'}
              </Details>
              <Details label="Request mode">
                {issuance.isFullTank ? 'Full tank' : 'Standard request'}
              </Details>
              <Details label="Requested liters">
                {issuance.requestedLiters === null
                  ? 'Not applicable'
                  : `${issuance.requestedLiters} L`}
              </Details>
              <Details label="Actual issued liters">
                {issuance.issuedLiters === null ? 'Pending' : `${issuance.issuedLiters} L`}
              </Details>
              <Details label="Unit price">₱{issuance.unitPrice}</Details>
              <Details label="Authoritative total">
                {issuance.totalAmount === null ? 'Pending' : `₱${issuance.totalAmount}`}
              </Details>
              <Details label="Allocation" wide>
                {issuance.allocation.ppmpNumber} · {issuance.allocation.office.name} (
                {issuance.allocation.office.abbreviation}) · FY {issuance.allocation.fiscalYear} Q
                {issuance.allocation.quarter}
              </Details>
            </dl>
          </DetailCard>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Lifecycle actions</CardTitle>
            <CardDescription>
              Controls follow your exact fuel permissions and the current status.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {issuance.status === 'DRAFT' && canCreate ? (
              <Button asChild variant="outline" className="w-full">
                <Link href={`/fuel-issuances/${issuance.publicId}?edit=1`}>Edit draft</Link>
              </Button>
            ) : null}
            {issuance.status === 'DRAFT' && canPost && csrfToken !== null ? (
              <FuelIssuancePostDialog issuance={issuance} csrfToken={csrfToken} />
            ) : null}
            {issuance.status === 'POSTED' && canVoid && csrfToken !== null ? (
              <FuelIssuanceVoidDialog issuance={issuance} csrfToken={csrfToken} />
            ) : null}
            {issuance.status === 'VOIDED' || (!canCreate && !canPost && !canVoid) ? (
              <p className="text-sm text-muted-foreground">
                This record is read-only for your account.
              </p>
            ) : null}
            {issuance.voidReason === null ? null : (
              <div className="rounded-md border border-destructive/40 p-3 text-sm">
                <strong>Void reason</strong>
                <p>{issuance.voidReason}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Immutable fuel ledger</CardTitle>
          <CardDescription>
            Posting and void compensation entries cannot be edited or deleted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {issuance.ledgerEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No ledger entry exists while this issuance is a draft.
            </p>
          ) : (
            <div
              className="overflow-x-auto"
              role="region"
              aria-label="Fuel ledger entries"
              tabIndex={0}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Effective date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Signed movement</TableHead>
                    <TableHead>Recorded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issuance.ledgerEntries.map((entry) => (
                    <TableRow key={entry.publicId}>
                      <TableCell>{entry.effectiveDate}</TableCell>
                      <TableCell>
                        {entry.transactionType === 'ISSUANCE'
                          ? 'Issuance'
                          : entry.transactionType === 'ADJUSTMENT'
                            ? 'Adjustment'
                            : entry.transactionType}
                      </TableCell>
                      <TableCell className="font-mono">{entry.reference}</TableCell>
                      <TableCell className="text-right font-mono">{entry.quantity} L</TableCell>
                      <TableCell className="text-right font-mono">
                        {entry.signedQuantity} L
                      </TableCell>
                      <TableCell>
                        <time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
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
function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value));
}
