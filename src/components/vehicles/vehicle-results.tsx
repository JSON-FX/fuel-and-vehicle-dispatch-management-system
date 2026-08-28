import Link from 'next/link';

import type { VehicleAdminDto } from '@/application/vehicle/dto/vehicle-dtos';
import { ReferenceStatusBadge } from '@/components/master-data/reference-status-badge';
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

export function VehicleResults({ items }: { readonly items: readonly VehicleAdminDto[] }) {
  return (
    <ResponsiveReferenceResults
      label="Vehicle results"
      table={
        <Table>
          <TableHeader className="sticky top-0 z-10">
            <TableRow>
              <TableHead>Plate number</TableHead>
              <TableHead>Model or brand</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Serviceability</TableHead>
              <TableHead>Lifecycle</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((vehicle) => (
              <VehicleRow key={vehicle.publicId} vehicle={vehicle} />
            ))}
          </TableBody>
        </Table>
      }
      cards={items.map((vehicle) => (
        <VehicleCard key={vehicle.publicId} vehicle={vehicle} />
      ))}
    />
  );
}
function VehicleRow({ vehicle }: { readonly vehicle: VehicleAdminDto }) {
  return (
    <TableRow>
      <TableCell className="font-mono font-semibold">{vehicle.plateNumber}</TableCell>
      <TableCell>{vehicle.modelBrand}</TableCell>
      <TableCell>{vehicle.vehicleType}</TableCell>
      <TableCell>
        <Status vehicle={vehicle} />
      </TableCell>
      <TableCell>{vehicle.deletedAt === null ? 'Current' : 'Deleted'}</TableCell>
      <TableCell>
        <Button asChild variant="link">
          <Link href={`/admin/vehicles/${vehicle.publicId}`}>Manage</Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}
function VehicleCard({ vehicle }: { readonly vehicle: VehicleAdminDto }) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <h2 className="font-heading font-semibold">{vehicle.modelBrand}</h2>
          <p className="font-mono text-sm text-muted-foreground">{vehicle.plateNumber}</p>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="font-semibold">Type</dt>
            <dd>{vehicle.vehicleType}</dd>
          </div>
          <div>
            <dt className="font-semibold">Lifecycle</dt>
            <dd>{vehicle.deletedAt === null ? 'Current' : 'Deleted'}</dd>
          </div>
          <div className="col-span-2">
            <dt className="font-semibold">Serviceability</dt>
            <dd>
              <Status vehicle={vehicle} />
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="font-semibold">Updated</dt>
            <dd>
              <time dateTime={vehicle.updatedAt}>{formatDate(vehicle.updatedAt)}</time>
            </dd>
          </div>
        </dl>
        <Button asChild variant="outline" className="w-full">
          <Link href={`/admin/vehicles/${vehicle.publicId}`}>Manage vehicle</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
function Status({ vehicle }: { readonly vehicle: VehicleAdminDto }) {
  if (vehicle.deletedAt !== null) return <ReferenceStatusBadge label="Deleted" tone="deleted" />;
  return (
    <ReferenceStatusBadge
      label={vehicle.status === 'SERVICEABLE' ? 'Serviceable' : 'Unserviceable'}
      tone={vehicle.status === 'SERVICEABLE' ? 'positive' : 'warning'}
    />
  );
}
function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value));
}
