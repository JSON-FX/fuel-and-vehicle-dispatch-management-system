import Link from 'next/link';

import type { OfficeAdminDto } from '@/application/office/dto/office-dtos';
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

export function OfficeResults({ items }: { readonly items: readonly OfficeAdminDto[] }) {
  return (
    <ResponsiveReferenceResults
      label="Office results"
      table={
        <Table>
          <TableHeader className="sticky top-0 z-10">
            <TableRow>
              <TableHead>Office</TableHead>
              <TableHead>Abbreviation</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Lifecycle</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((office) => (
              <OfficeRow key={office.publicId} office={office} />
            ))}
          </TableBody>
        </Table>
      }
      cards={items.map((office) => (
        <OfficeCard key={office.publicId} office={office} />
      ))}
    />
  );
}

function OfficeRow({ office }: { readonly office: OfficeAdminDto }) {
  return (
    <TableRow>
      <TableCell className="font-semibold">{office.name}</TableCell>
      <TableCell className="font-mono">{office.abbreviation}</TableCell>
      <TableCell>
        <Status office={office} />
      </TableCell>
      <TableCell>{office.deletedAt === null ? 'Current' : 'Deleted'}</TableCell>
      <TableCell>
        <time dateTime={office.updatedAt}>{formatDate(office.updatedAt)}</time>
      </TableCell>
      <TableCell>
        <Button asChild variant="link">
          <Link href={`/admin/offices/${office.publicId}`}>Manage</Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}

function OfficeCard({ office }: { readonly office: OfficeAdminDto }) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <h2 className="font-heading font-semibold">{office.name}</h2>
          <p className="font-mono text-sm text-muted-foreground">{office.abbreviation}</p>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="font-semibold">Status</dt>
            <dd>
              <Status office={office} />
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Lifecycle</dt>
            <dd>{office.deletedAt === null ? 'Current' : 'Deleted'}</dd>
          </div>
          <div className="col-span-2">
            <dt className="font-semibold">Updated</dt>
            <dd>
              <time dateTime={office.updatedAt}>{formatDate(office.updatedAt)}</time>
            </dd>
          </div>
        </dl>
        <Button asChild variant="outline" className="w-full">
          <Link href={`/admin/offices/${office.publicId}`}>Manage office</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function Status({ office }: { readonly office: OfficeAdminDto }) {
  if (office.deletedAt !== null) return <ReferenceStatusBadge label="Deleted" tone="deleted" />;
  return (
    <ReferenceStatusBadge
      label={office.status === 'ACTIVE' ? 'Active' : 'Inactive'}
      tone={office.status === 'ACTIVE' ? 'positive' : 'inactive'}
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
