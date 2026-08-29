import type { ReportResultDto, ReportRow } from '@/application/reporting/dto/report-dtos';
import { ResponsiveReferenceResults } from '@/components/master-data/responsive-reference-results';
import {
  formatReportCivilDate,
  formatReportCurrency,
  formatReportNumber,
} from '@/components/reporting/report-formatting';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface SummaryCell {
  readonly label: string;
  readonly value: React.ReactNode;
  readonly numeric?: boolean;
}

export function SummaryReportResults({ report }: { readonly report: ReportResultDto }) {
  const rows = report.rows.map(summaryCells);
  if (rows.length === 0) return null;
  const headings = rows[0]?.map((cell) => cell.label) ?? [];
  return (
    <ResponsiveReferenceResults
      label={`${report.label} results`}
      desktopBreakpoint="sm"
      table={
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              {headings.map((heading, index) => (
                <TableHead
                  key={heading}
                  className={rows[0]?.[index]?.numeric ? 'text-right' : undefined}
                >
                  {heading}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((cells, rowIndex) => (
              <TableRow key={`${report.reportType}-${rowIndex}`}>
                {cells.map((cell) => (
                  <TableCell
                    key={cell.label}
                    className={cell.numeric ? 'text-right tabular-nums' : undefined}
                  >
                    {cell.value}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
      cards={rows.map((cells, rowIndex) => (
        <Card key={`${report.reportType}-${rowIndex}`}>
          <CardContent className="pt-6">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {cells.map((cell, index) => (
                <div key={cell.label} className={index === 0 ? 'col-span-2' : undefined}>
                  <dt className="font-semibold">{cell.label}</dt>
                  <dd className={cell.numeric ? 'tabular-nums' : 'break-words'}>{cell.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ))}
    />
  );
}

function summaryCells(row: ReportRow): readonly SummaryCell[] {
  switch (row.reportType) {
    case 'FUEL_BY_OFFICE':
      return [
        { label: 'Office', value: row.office.label },
        { label: 'Issuances', value: row.issuanceCount.toLocaleString('en-PH'), numeric: true },
        { label: 'Issued', value: `${formatReportNumber(row.issuedLiters)} L`, numeric: true },
        { label: 'Total amount', value: formatReportCurrency(row.totalAmount), numeric: true },
      ];
    case 'FUEL_BY_VEHICLE':
      return [
        { label: 'Vehicle', value: `${row.vehicle.plateNumber} · ${row.vehicle.label}` },
        { label: 'Issuances', value: row.issuanceCount.toLocaleString('en-PH'), numeric: true },
        { label: 'Issued', value: `${formatReportNumber(row.issuedLiters)} L`, numeric: true },
        { label: 'Total amount', value: formatReportCurrency(row.totalAmount), numeric: true },
      ];
    case 'FUEL_TYPE_TOTALS':
      return [
        { label: 'Fuel type', value: row.fuelType === 'DIESEL' ? 'Diesel' : 'Gasoline' },
        { label: 'Issuances', value: row.issuanceCount.toLocaleString('en-PH'), numeric: true },
        { label: 'Issued', value: `${formatReportNumber(row.issuedLiters)} L`, numeric: true },
        { label: 'Total amount', value: formatReportCurrency(row.totalAmount), numeric: true },
      ];
    case 'FUEL_AMOUNT_BY_PERIOD':
      return [
        {
          label: 'Period',
          value: `${row.periodLabel} · ${formatReportCivilDate(row.periodStart)} to ${formatReportCivilDate(row.periodEnd)}`,
        },
        { label: 'Issuances', value: row.issuanceCount.toLocaleString('en-PH'), numeric: true },
        { label: 'Total amount', value: formatReportCurrency(row.totalAmount), numeric: true },
      ];
    case 'DISPATCH_COUNT_BY_OFFICE':
      return [
        { label: 'Office', value: row.office.label },
        { label: 'Dispatches', value: row.dispatchCount.toLocaleString('en-PH'), numeric: true },
      ];
    case 'VEHICLE_UTILIZATION':
      return [
        { label: 'Vehicle', value: `${row.vehicle.plateNumber} · ${row.vehicle.label}` },
        {
          label: 'Completed trips',
          value: row.completedTrips.toLocaleString('en-PH'),
          numeric: true,
        },
        {
          label: 'Completed distance',
          value: `${formatReportNumber(row.completedDistance, 1)} km`,
          numeric: true,
        },
      ];
    case 'BUDGET_ALLOCATION_ACTIVITY':
      return [
        { label: 'Allocation', value: row.budgetAllocation.label },
        { label: 'Office', value: row.office.label },
        { label: 'Fiscal period', value: `Q${row.quarter} ${row.fiscalYear}` },
        { label: 'Issuances', value: row.issuanceCount.toLocaleString('en-PH'), numeric: true },
        { label: 'Issued', value: `${formatReportNumber(row.issuedLiters)} L`, numeric: true },
        { label: 'Fuel amount', value: formatReportCurrency(row.totalAmount), numeric: true },
      ];
    default:
      return [];
  }
}
