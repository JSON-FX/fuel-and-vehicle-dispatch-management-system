import { ArrowRight, Gauge, ReceiptText, Route } from 'lucide-react';
import Link from 'next/link';

import type { ReportResultDto } from '@/application/reporting/dto/report-dtos';
import { SummaryReportResults } from '@/components/reporting/summary-report-results';
import { formatReportCurrency, formatReportNumber } from '@/components/reporting/report-formatting';
import { Card, CardContent } from '@/components/ui/card';

export function ReportOverview({ reports }: { readonly reports: readonly ReportResultDto[] }) {
  if (reports.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <h2 className="font-heading text-xl font-semibold">No report families available</h2>
          <p className="mt-2 text-muted-foreground">
            Ask an administrator for fuel or dispatch reporting access.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <section className="space-y-6" aria-labelledby="report-overview-heading">
      <div>
        <h2 id="report-overview-heading" className="font-heading text-xl font-semibold">
          Operational overview
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Authorized summaries for the selected period and office.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {reports.map((report) => (
          <OverviewCard key={report.reportType} report={report} />
        ))}
      </div>
      <div className="space-y-6">
        {reports.map((report) => (
          <article
            key={report.reportType}
            className="space-y-3"
            aria-labelledby={`overview-${report.reportType}`}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3
                id={`overview-${report.reportType}`}
                className="font-heading text-lg font-semibold"
              >
                {report.label}
              </h3>
              <Link
                className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-accent focus-visible:ring-2 focus-visible:ring-ring"
                href={reportHref(report)}
              >
                Open report <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            {report.rows.length === 0 ? (
              <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
                No activity for this period and office.
              </p>
            ) : (
              <SummaryReportResults report={report} />
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function OverviewCard({ report }: { readonly report: ReportResultDto }) {
  const Icon =
    report.reportType === 'VEHICLE_UTILIZATION'
      ? Gauge
      : report.reportType === 'DISPATCH_COUNT_BY_OFFICE'
        ? Route
        : ReceiptText;
  const measure =
    report.reportType === 'DISPATCH_COUNT_BY_OFFICE'
      ? (report.totals.dispatchCount ?? 0).toLocaleString('en-PH')
      : report.reportType === 'VEHICLE_UTILIZATION'
        ? `${formatReportNumber(report.totals.completedDistance ?? '0', 1)} km`
        : report.totals.totalAmount !== null
          ? formatReportCurrency(report.totals.totalAmount)
          : report.totals.issuedLiters !== null
            ? `${formatReportNumber(report.totals.issuedLiters)} L`
            : report.totals.rowCount.toLocaleString('en-PH');
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-muted-foreground">{report.label}</p>
          <Icon className="size-5 shrink-0 text-accent" aria-hidden="true" />
        </div>
        <p className="font-heading text-2xl font-semibold tabular-nums">{measure}</p>
        <p className="text-sm text-muted-foreground">
          {report.totals.rowCount.toLocaleString('en-PH')} grouped rows
        </p>
      </CardContent>
    </Card>
  );
}

function reportHref(report: ReportResultDto): string {
  const params = new URLSearchParams({
    report: report.reportType,
    periodType: report.period.periodType,
    pageSize: String(report.filters.pageSize),
  });
  if (report.filters.requestingOfficePublicId !== null)
    params.set('requestingOfficePublicId', report.filters.requestingOfficePublicId);
  if (report.period.periodType === 'CUSTOM') {
    params.set('startDate', report.period.startDate);
    params.set('endDate', report.period.endDate);
  } else if (report.period.referenceDate !== null)
    params.set('referenceDate', report.period.referenceDate);
  return `/reports?${params.toString()}`;
}
