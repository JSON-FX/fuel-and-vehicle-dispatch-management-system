import Link from 'next/link';

import type { DriverAdminDto } from '@/application/driver/dto/driver-dtos';
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

export function DriverResults({ items }: { readonly items: readonly DriverAdminDto[] }) {
  return (
    <ResponsiveReferenceResults
      label="Driver results"
      table={
        <Table>
          <TableHeader className="sticky top-0 z-10">
            <TableRow>
              <TableHead>Driver</TableHead>
              <TableHead>Contact number</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Lifecycle</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((driver) => (
              <DriverRow key={driver.publicId} driver={driver} />
            ))}
          </TableBody>
        </Table>
      }
      cards={items.map((driver) => (
        <DriverCard key={driver.publicId} driver={driver} />
      ))}
    />
  );
}
function DriverRow({ driver }: { readonly driver: DriverAdminDto }) {
  return (
    <TableRow>
      <TableCell className="font-semibold">{driver.name}</TableCell>
      <TableCell>{driver.contactNumber ?? 'Not provided'}</TableCell>
      <TableCell>
        <Status driver={driver} />
      </TableCell>
      <TableCell>{driver.deletedAt === null ? 'Current' : 'Deleted'}</TableCell>
      <TableCell>
        <time dateTime={driver.updatedAt}>{formatDate(driver.updatedAt)}</time>
      </TableCell>
      <TableCell>
        <Button asChild variant="link">
          <Link href={`/admin/drivers/${driver.publicId}`}>Manage</Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}
function DriverCard({ driver }: { readonly driver: DriverAdminDto }) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <h2 className="font-heading font-semibold">{driver.name}</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="col-span-2">
            <dt className="font-semibold">Contact number</dt>
            <dd>{driver.contactNumber ?? 'Not provided'}</dd>
          </div>
          <div>
            <dt className="font-semibold">Status</dt>
            <dd>
              <Status driver={driver} />
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Lifecycle</dt>
            <dd>{driver.deletedAt === null ? 'Current' : 'Deleted'}</dd>
          </div>
          <div className="col-span-2">
            <dt className="font-semibold">Updated</dt>
            <dd>
              <time dateTime={driver.updatedAt}>{formatDate(driver.updatedAt)}</time>
            </dd>
          </div>
        </dl>
        <Button asChild variant="outline" className="w-full">
          <Link href={`/admin/drivers/${driver.publicId}`}>Manage driver</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
function Status({ driver }: { readonly driver: DriverAdminDto }) {
  if (driver.deletedAt !== null) return <ReferenceStatusBadge label="Deleted" tone="deleted" />;
  return (
    <ReferenceStatusBadge
      label={driver.status === 'ACTIVE' ? 'Active' : 'Inactive'}
      tone={driver.status === 'ACTIVE' ? 'positive' : 'inactive'}
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
