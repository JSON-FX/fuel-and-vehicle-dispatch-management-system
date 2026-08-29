import type {
  FuelIssuanceReportRow,
  ReportResultDto,
} from '@/application/reporting/dto/report-dtos';
import { ResponsiveReferenceResults } from '@/components/master-data/responsive-reference-results';
import {
  formatReportCivilDate,
  formatReportCurrency,
  formatReportNumber,
  reportStatusLabel,
} from '@/components/reporting/report-formatting';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function FuelReportResults({ report }: { readonly report: ReportResultDto }) {
  const rows = report.rows.filter(isFuelRow);
  return (
    <ResponsiveReferenceResults
      label="Fuel issuance report results"
      desktopBreakpoint="lg"
      table={
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>RIS / entry date</TableHead>
              <TableHead>Request and purpose</TableHead>
              <TableHead>Driver / vehicle</TableHead>
              <TableHead>Office / allocation</TableHead>
              <TableHead>Fuel</TableHead>
              <TableHead className="text-right">Issued / price / total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.publicId}>
                <TableCell>
                  <strong className="block font-mono">{row.risNumber ?? 'No RIS number'}</strong>
                  <span className="text-sm text-muted-foreground">
                    {formatReportCivilDate(row.entryDate)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="font-mono">{row.purchaseRequestNumber}</span>
                  <span className="block">{row.destination}</span>
                  <span className="block text-sm text-muted-foreground">{row.purpose}</span>
                </TableCell>
                <TableCell>
                  {row.driver.label}
                  <span className="block text-sm text-muted-foreground">
                    {row.vehicle.plateNumber} · {row.vehicle.label}
                  </span>
                </TableCell>
                <TableCell>
                  {row.office.label}
                  <span className="block text-sm text-muted-foreground">
                    {row.budgetAllocation.label}
                  </span>
                </TableCell>
                <TableCell>{row.fuelType === 'DIESEL' ? 'Diesel' : 'Gasoline'}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatReportNumber(row.issuedLiters)} L
                  <span className="block text-sm text-muted-foreground">
                    {formatReportCurrency(row.unitPrice)} / L
                  </span>
                  <strong className="block">{formatReportCurrency(row.totalAmount)}</strong>
                </TableCell>
                <TableCell>
                  <Badge>{reportStatusLabel(row.status)}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
      cards={rows.map((row) => (
        <FuelMobileCard key={row.publicId} row={row} />
      ))}
    />
  );
}

function FuelMobileCard({ row }: { readonly row: FuelIssuanceReportRow }) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-mono font-semibold">{row.risNumber ?? 'No RIS number'}</h3>
          <Badge>{reportStatusLabel(row.status)}</Badge>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Detail label="Entry date">{formatReportCivilDate(row.entryDate)}</Detail>
          <Detail label="Request">{row.purchaseRequestNumber}</Detail>
          <Detail label="Destination" wide>
            {row.destination}
          </Detail>
          <Detail label="Purpose" wide>
            {row.purpose}
          </Detail>
          <Detail label="Driver">{row.driver.label}</Detail>
          <Detail label="Vehicle">
            {row.vehicle.plateNumber} · {row.vehicle.label}
          </Detail>
          <Detail label="Office" wide>
            {row.office.label}
          </Detail>
          <Detail label="Allocation" wide>
            {row.budgetAllocation.label}
          </Detail>
          <Detail label="Fuel">{row.fuelType === 'DIESEL' ? 'Diesel' : 'Gasoline'}</Detail>
          <Detail label="Issued">{formatReportNumber(row.issuedLiters)} L</Detail>
          <Detail label="Unit price">{formatReportCurrency(row.unitPrice)} / L</Detail>
          <Detail label="Total">{formatReportCurrency(row.totalAmount)}</Detail>
        </dl>
      </CardContent>
    </Card>
  );
}

function Detail({
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
      <dd className="break-words">{children}</dd>
    </div>
  );
}

function isFuelRow(row: ReportResultDto['rows'][number]): row is FuelIssuanceReportRow {
  return row.reportType === 'FUEL_ISSUANCE';
}
