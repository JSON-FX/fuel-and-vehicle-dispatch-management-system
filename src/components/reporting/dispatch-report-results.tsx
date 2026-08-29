import type { DispatchReportRow, ReportResultDto } from '@/application/reporting/dto/report-dtos';
import { ResponsiveReferenceResults } from '@/components/master-data/responsive-reference-results';
import {
  formatReportCivilDate,
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

export function DispatchReportResults({ report }: { readonly report: ReportResultDto }) {
  const rows = report.rows.filter(isDispatchRow);
  return (
    <ResponsiveReferenceResults
      label="Dispatch report results"
      desktopBreakpoint="lg"
      table={
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>Travel / entry date</TableHead>
              <TableHead>Destination and purpose</TableHead>
              <TableHead>Driver / vehicle</TableHead>
              <TableHead>Office</TableHead>
              <TableHead className="text-right">Passengers</TableHead>
              <TableHead className="text-right">Odometer / distance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.publicId}>
                <TableCell>
                  <strong className="block">{formatReportCivilDate(row.travelDate)}</strong>
                  <span className="text-sm text-muted-foreground">
                    Entered {formatReportCivilDate(row.entryDate)}
                  </span>
                </TableCell>
                <TableCell>
                  {row.destination}
                  <span className="block text-sm text-muted-foreground">{row.purpose}</span>
                </TableCell>
                <TableCell>
                  {row.driver.label}
                  <span className="block text-sm text-muted-foreground">
                    {row.vehicle.plateNumber} · {row.vehicle.label}
                  </span>
                </TableCell>
                <TableCell>{row.office.label}</TableCell>
                <TableCell className="text-right tabular-nums">{row.passengerCount}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatReportNumber(row.odoBefore, 1)}
                  {row.odoAfter === null ? '' : ` to ${formatReportNumber(row.odoAfter, 1)}`}
                  <span className="block text-sm text-muted-foreground">
                    {row.distance === null
                      ? 'No completed distance'
                      : `${formatReportNumber(row.distance, 1)} km`}
                  </span>
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
        <DispatchMobileCard key={row.publicId} row={row} />
      ))}
    />
  );
}

function DispatchMobileCard({ row }: { readonly row: DispatchReportRow }) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-heading font-semibold">{row.destination}</h3>
          <Badge>{reportStatusLabel(row.status)}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{row.purpose}</p>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Detail label="Travel date">{formatReportCivilDate(row.travelDate)}</Detail>
          <Detail label="Entry date">{formatReportCivilDate(row.entryDate)}</Detail>
          <Detail label="Driver">{row.driver.label}</Detail>
          <Detail label="Vehicle">
            {row.vehicle.plateNumber} · {row.vehicle.label}
          </Detail>
          <Detail label="Office" wide>
            {row.office.label}
          </Detail>
          <Detail label="Passengers">{row.passengerCount}</Detail>
          <Detail label="Odometer">
            {formatReportNumber(row.odoBefore, 1)}
            {row.odoAfter === null ? '' : ` to ${formatReportNumber(row.odoAfter, 1)}`}
          </Detail>
          <Detail label="Distance" wide>
            {row.distance === null
              ? 'No completed distance'
              : `${formatReportNumber(row.distance, 1)} km`}
          </Detail>
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
function isDispatchRow(row: ReportResultDto['rows'][number]): row is DispatchReportRow {
  return row.reportType === 'DISPATCH';
}
