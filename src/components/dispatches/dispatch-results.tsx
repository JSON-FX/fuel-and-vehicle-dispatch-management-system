import Link from 'next/link';

import type { DispatchDetailDto } from '@/application/dispatch/dto/dispatch-dtos';
import {
  formatDispatchCivilDate,
  formatDispatchOdometer,
} from '@/components/dispatches/dispatch-format';
import { DispatchStatusBadge } from '@/components/dispatches/dispatch-status-badge';
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

export function DispatchResults({ items }: { readonly items: readonly DispatchDetailDto[] }) {
  return (
    <ResponsiveReferenceResults
      label="Vehicle dispatch results"
      table={
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>Travel / destination</TableHead>
              <TableHead>Driver / vehicle</TableHead>
              <TableHead>Requesting office</TableHead>
              <TableHead className="text-right">Passengers / odometer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <DispatchRow key={item.publicId} item={item} />
            ))}
          </TableBody>
        </Table>
      }
      cards={items.map((item) => (
        <DispatchCard key={item.publicId} item={item} />
      ))}
    />
  );
}

function DispatchRow({ item }: { readonly item: DispatchDetailDto }) {
  return (
    <TableRow>
      <TableCell>
        <strong className="block">{item.destination}</strong>
        <span className="block text-sm text-muted-foreground">
          {formatDispatchCivilDate(item.travelDate)} · {item.purpose}
        </span>
      </TableCell>
      <TableCell>
        {item.driver.name}
        <span className="block font-mono text-sm text-muted-foreground">
          {item.vehicle.plateNumber}
        </span>
        <span className="block text-sm text-muted-foreground">{item.vehicle.vehicleType}</span>
      </TableCell>
      <TableCell>
        {item.requestingOffice.name}
        <span className="block text-sm text-muted-foreground">
          {item.requestingOffice.abbreviation}
        </span>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {passengerLabel(item.passengerCount)}
        <span className="block font-mono text-sm text-muted-foreground">
          {formatDispatchOdometer(item.odoBefore)}
        </span>
      </TableCell>
      <TableCell>
        <DispatchStatusBadge status={item.status} />
      </TableCell>
      <TableCell>
        <Button asChild variant="link">
          <Link href={`/dispatches/${item.publicId}`}>View dispatch</Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}

function DispatchCard({ item }: { readonly item: DispatchDetailDto }) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-heading font-semibold">{item.destination}</h3>
            <p className="text-sm text-muted-foreground">
              {formatDispatchCivilDate(item.travelDate)}
            </p>
          </div>
          <DispatchStatusBadge status={item.status} />
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Details label="Driver" wide>
            {item.driver.name}
          </Details>
          <Details label="Vehicle" wide>
            {item.vehicle.plateNumber} · {item.vehicle.modelBrand} · {item.vehicle.vehicleType}
          </Details>
          <Details label="Requesting office" wide>
            {item.requestingOffice.name} ({item.requestingOffice.abbreviation})
          </Details>
          <Details label="Passengers">{passengerLabel(item.passengerCount)}</Details>
          <Details label="Initial odometer">{formatDispatchOdometer(item.odoBefore)}</Details>
        </dl>
        <Button asChild variant="outline" className="w-full">
          <Link href={`/dispatches/${item.publicId}`}>View dispatch</Link>
        </Button>
      </CardContent>
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
    <div className={wide ? 'col-span-2' : undefined}>
      <dt className="font-semibold">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function passengerLabel(count: number): string {
  return `${count} ${count === 1 ? 'passenger' : 'passengers'}`;
}
