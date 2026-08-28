import Link from 'next/link';

import type { BudgetAllocationAdminDto } from '@/application/budget/dto/budget-allocation-dtos';
import { BudgetAllocationStatusBadge } from '@/components/budget-allocations/budget-allocation-status-badge';
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

export function BudgetAllocationResults({
  items,
  canManage,
}: {
  readonly items: readonly BudgetAllocationAdminDto[];
  readonly canManage: boolean;
}) {
  return (
    <ResponsiveReferenceResults
      label="Budget allocation results"
      table={
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>PPMP number</TableHead>
              <TableHead>Office</TableHead>
              <TableHead>Fiscal period</TableHead>
              <TableHead>Status and eligibility</TableHead>
              <TableHead>Lifecycle</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((allocation) => (
              <BudgetAllocationRow
                key={allocation.publicId}
                allocation={allocation}
                canManage={canManage}
              />
            ))}
          </TableBody>
        </Table>
      }
      cards={items.map((allocation) => (
        <BudgetAllocationCard
          key={allocation.publicId}
          allocation={allocation}
          canManage={canManage}
        />
      ))}
    />
  );
}

function BudgetAllocationRow({
  allocation,
  canManage,
}: {
  readonly allocation: BudgetAllocationAdminDto;
  readonly canManage: boolean;
}) {
  return (
    <TableRow>
      <TableCell className="font-mono font-semibold">{allocation.ppmpNumber}</TableCell>
      <TableCell>
        <Office allocation={allocation} />
      </TableCell>
      <TableCell>{fiscalPeriod(allocation)}</TableCell>
      <TableCell>
        <BudgetAllocationStatusBadge
          status={allocation.status}
          deleted={allocation.deletedAt !== null}
          eligible={allocation.eligible}
        />
      </TableCell>
      <TableCell>{lifecycle(allocation)}</TableCell>
      <TableCell>
        <time dateTime={allocation.updatedAt}>{formatDate(allocation.updatedAt)}</time>
      </TableCell>
      <TableCell>
        <DetailLink allocation={allocation} canManage={canManage} />
      </TableCell>
    </TableRow>
  );
}

function BudgetAllocationCard({
  allocation,
  canManage,
}: {
  readonly allocation: BudgetAllocationAdminDto;
  readonly canManage: boolean;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <h2 className="font-mono font-semibold">{allocation.ppmpNumber}</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Details label="Office" wide>
            <Office allocation={allocation} />
          </Details>
          <Details label="Fiscal period" wide>
            {fiscalPeriod(allocation)}
          </Details>
          <Details label="Status and eligibility" wide>
            <BudgetAllocationStatusBadge
              status={allocation.status}
              deleted={allocation.deletedAt !== null}
              eligible={allocation.eligible}
            />
          </Details>
          <Details label="Lifecycle">{lifecycle(allocation)}</Details>
          <Details label="Updated">
            <time dateTime={allocation.updatedAt}>{formatDate(allocation.updatedAt)}</time>
          </Details>
        </dl>
        <DetailLink allocation={allocation} canManage={canManage} fullWidth />
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

function DetailLink({
  allocation,
  canManage,
  fullWidth = false,
}: {
  readonly allocation: BudgetAllocationAdminDto;
  readonly canManage: boolean;
  readonly fullWidth?: boolean;
}) {
  const label = canManage ? 'Manage allocation' : 'View allocation';
  return (
    <Button asChild variant={fullWidth ? 'outline' : 'link'} className={fullWidth ? 'w-full' : ''}>
      <Link href={`/budget-allocations/${allocation.publicId}`}>{label}</Link>
    </Button>
  );
}

function Office({ allocation }: { readonly allocation: BudgetAllocationAdminDto }) {
  return (
    <span>
      {allocation.office.name} ({allocation.office.abbreviation})
    </span>
  );
}

function fiscalPeriod(allocation: BudgetAllocationAdminDto): string {
  return `FY ${allocation.fiscalYear} · Quarter ${allocation.quarter}`;
}

function lifecycle(allocation: BudgetAllocationAdminDto): string {
  return allocation.deletedAt === null ? 'Current' : 'Deleted';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value));
}
