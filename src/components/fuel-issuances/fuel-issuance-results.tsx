import Link from 'next/link';

import type { FuelIssuanceDto } from '@/application/fuel/dto/fuel-dtos';
import { FuelIssuanceStatusBadge } from '@/components/fuel-issuances/fuel-issuance-status-badge';
import { ResponsiveReferenceResults } from '@/components/master-data/responsive-reference-results';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function FuelIssuanceResults({ items }: { readonly items: readonly FuelIssuanceDto[] }) {
  return (
    <ResponsiveReferenceResults
      label="Fuel issuance results"
      table={
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>RIS / date</TableHead>
              <TableHead>Request</TableHead>
              <TableHead>Dispatch</TableHead>
              <TableHead>Fuel</TableHead>
              <TableHead className="text-right">Issued / total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <Row key={item.publicId} item={item} />
            ))}
          </TableBody>
        </Table>
      }
      cards={items.map((item) => (
        <MobileCard key={item.publicId} item={item} />
      ))}
    />
  );
}

function Row({ item }: { readonly item: FuelIssuanceDto }) {
  return (
    <TableRow>
      <TableCell>
        <strong className="block font-mono">{item.risNumber ?? 'Pending RIS'}</strong>
        <span className="text-sm text-muted-foreground">{formatCivilDate(item.entryDate)}</span>
      </TableCell>
      <TableCell>
        <span className="font-mono">{item.purchaseRequestNumber}</span>
        <span className="block text-sm text-muted-foreground">{item.purpose}</span>
      </TableCell>
      <TableCell>
        {item.driver.name}
        <span className="block font-mono text-sm text-muted-foreground">
          {item.vehicle.plateNumber}
        </span>
        <span className="block text-sm text-muted-foreground">{item.vehicle.vehicleType}</span>
      </TableCell>
      <TableCell>
        {label(item.fuelType)}
        <span className="block text-sm text-muted-foreground">
          {item.isFullTank ? 'Full tank' : `${item.requestedLiters} L requested`}
        </span>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {item.issuedLiters === null ? '—' : `${item.issuedLiters} L`}
        <span className="block text-sm text-muted-foreground">
          {item.totalAmount === null ? 'Pending total' : `₱${item.totalAmount}`}
        </span>
      </TableCell>
      <TableCell>
        <FuelIssuanceStatusBadge status={item.status} />
      </TableCell>
      <TableCell>
        <Button asChild variant="link">
          <Link href={`/fuel-issuances/${item.publicId}`}>View issuance</Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}

function MobileCard({ item }: { readonly item: FuelIssuanceDto }) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-mono font-semibold">{item.risNumber ?? 'Pending RIS'}</h3>
          <FuelIssuanceStatusBadge status={item.status} />
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Details label="Entry date">{formatCivilDate(item.entryDate)}</Details>
          <Details label="Request">
            <span className="font-mono">{item.purchaseRequestNumber}</span>
          </Details>
          <Details label="Driver" wide>
            {item.driver.name}
          </Details>
          <Details label="Vehicle" wide>
            {item.vehicle.plateNumber} · {item.vehicle.modelBrand} · {item.vehicle.vehicleType}
          </Details>
          <Details label="Fuel">{label(item.fuelType)}</Details>
          <Details label="Quantity">
            {item.issuedLiters === null
              ? item.isFullTank
                ? 'Full tank'
                : `${item.requestedLiters} L requested`
              : `${item.issuedLiters} L issued`}
          </Details>
          <Details label="Total" wide>
            {item.totalAmount === null ? 'Pending' : `₱${item.totalAmount}`}
          </Details>
        </dl>
        <Button asChild variant="outline" className="w-full">
          <Link href={`/fuel-issuances/${item.publicId}`}>View issuance</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function Details({
  label: term,
  children,
  wide = false,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
  readonly wide?: boolean;
}) {
  return (
    <div className={wide ? 'col-span-2' : undefined}>
      <dt className="font-semibold">{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}
function label(value: string) {
  return value === 'DIESEL' ? 'Diesel' : 'Gasoline';
}
function formatCivilDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${value}T00:00:00Z`),
  );
}
