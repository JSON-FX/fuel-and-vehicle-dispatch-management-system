import { FileSpreadsheet, SearchX } from 'lucide-react';
import Link from 'next/link';

import {
  REPORT_TYPES,
  type NormalizedReportFilters,
  type ReportResultDto,
  type ReportType,
} from '@/application/reporting/dto/report-dtos';
import { ValidationError } from '@/application/shared/errors/application-error';
import { BudgetAllocationActivityResults } from '@/components/reporting/budget-allocation-activity-results';
import { DispatchReportResults } from '@/components/reporting/dispatch-report-results';
import { FuelReportResults } from '@/components/reporting/fuel-report-results';
import { RecentExportJobs } from '@/components/reporting/recent-export-jobs';
import { ReportExportDialog } from '@/components/reporting/report-export-dialog';
import { ReportFilterForm } from '@/components/reporting/report-filter-form';
import { ReportOverview } from '@/components/reporting/report-overview';
import { ReportPeriodSummary } from '@/components/reporting/report-period-summary';
import { SummaryReportResults } from '@/components/reporting/summary-report-results';
import { ReferencePageHeader } from '@/components/master-data/reference-page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getServerAuthentication } from '@/lib/auth/server-authentication';
import { manilaCivilDate } from '@/lib/dispatch/calendar-date';
import {
  parseReportPageQuery,
  reportPageHref,
  type ReportPageSearchParams,
} from '@/lib/reporting/page-query';
import { authorizeReportPageAccess } from '@/lib/reporting/server-report-access';

export const dynamic = 'force-dynamic';

const overviewReportTypes = [
  'FUEL_BY_OFFICE',
  'FUEL_BY_VEHICLE',
  'FUEL_TYPE_TOTALS',
  'FUEL_AMOUNT_BY_PERIOD',
  'BUDGET_ALLOCATION_ACTIVITY',
  'DISPATCH_COUNT_BY_OFFICE',
  'VEHICLE_UTILIZATION',
] as const satisfies readonly ReportType[];

export default async function ReportsPage({
  searchParams,
}: {
  readonly searchParams: Promise<ReportPageSearchParams>;
}) {
  const { composition, session, bearerToken } = await getServerAuthentication();
  const access = await authorizeReportPageAccess(composition, session.principal, '/reports');
  if (access === null)
    return (
      <ReportMessage
        title="Report access denied"
        body="Your account cannot view operational reports."
      />
    );

  let parsed: ReturnType<typeof parseReportPageQuery>;
  try {
    parsed = parseReportPageQuery(await searchParams, manilaCivilDate());
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    return <InvalidFilters details={error.details} />;
  }

  const readableReportTypes = REPORT_TYPES.filter((reportType) =>
    composition.reportPermissions.canRead(session.principal, reportType),
  );
  const downloadableReportTypes = REPORT_TYPES.filter((reportType) =>
    composition.reportPermissions.canExport(session.principal, reportType),
  );
  const reportPromise =
    parsed.filters === null
      ? Promise.all(
          overviewReportTypes
            .filter((reportType) => readableReportTypes.includes(reportType))
            .map((reportType) =>
              composition.getReport.execute({
                context: access,
                filters: overviewFilters(reportType, parsed),
              }),
            ),
        )
      : composition.getReport.execute({ context: access, filters: parsed.filters });
  const [reportOrOverview, filterOptions, jobs, current] = await Promise.all([
    reportPromise,
    composition.getReportFilterOptions.execute(access),
    composition.listOwnExportJobs.execute({ context: access, limit: 20 }),
    composition.getCurrentPrincipal.execute(bearerToken),
  ]);
  const selectedReport = parsed.filters === null ? null : (reportOrOverview as ReportResultDto);
  const overview = parsed.filters === null ? (reportOrOverview as readonly ReportResultDto[]) : [];
  const canExport =
    selectedReport !== null && downloadableReportTypes.includes(selectedReport.reportType);

  return (
    <div className="space-y-6">
      <ReferencePageHeader
        title="Operational reports"
        description="Review bounded fuel, dispatch, vehicle, and budget-allocation activity from stored operational facts."
        action={
          canExport ? (
            <ReportExportDialog
              filters={selectedReport.filters}
              label={selectedReport.label}
              officeLabel={selectedReport.office?.label ?? 'All requesting offices'}
              csrfToken={current.csrfToken}
            />
          ) : undefined
        }
      />
      <ReportFilterForm
        values={parsed.values}
        offices={filterOptions.offices}
        reportTypes={readableReportTypes}
      />
      {selectedReport === null ? (
        <>
          {overview[0] === undefined ? null : <ReportPeriodSummary report={overview[0]} />}
          <ReportOverview reports={overview} />
        </>
      ) : (
        <SelectedReport report={selectedReport} values={parsed.values} />
      )}
      <RecentExportJobs
        key={jobs.map((job) => `${job.publicId}:${job.status}`).join('|')}
        initialJobs={jobs}
        csrfToken={current.csrfToken}
        downloadableReportTypes={downloadableReportTypes}
      />
    </div>
  );
}

function SelectedReport({
  report,
  values,
}: {
  readonly report: ReportResultDto;
  readonly values: ReturnType<typeof parseReportPageQuery>['values'];
}) {
  return (
    <section className="space-y-4" aria-labelledby="selected-report-heading">
      <ReportPeriodSummary report={report} />
      <div>
        <h2 id="selected-report-heading" className="font-heading text-xl font-semibold">
          {report.label}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {report.rows.length} record{report.rows.length === 1 ? '' : 's'} on this page.
        </p>
      </div>
      {report.rows.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-44 flex-col items-center justify-center gap-2 text-center">
            <SearchX className="size-8 text-muted-foreground" aria-hidden="true" />
            <h3 className="font-heading text-lg font-semibold">No matching report activity</h3>
            <p className="text-sm text-muted-foreground">
              Choose another office or period, or clear the filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ReportResults report={report} />
      )}
      {report.truncated ? (
        <p className="rounded-md border border-warning/40 bg-warning/10 p-4 text-sm" role="status">
          This result reached its enforced bound. Choose a narrower period or office.
        </p>
      ) : null}
      {report.nextCursor === null ? null : (
        <div className="flex justify-end">
          <Button asChild variant="outline">
            <Link href={reportPageHref(values, report.nextCursor)}>Next page</Link>
          </Button>
        </div>
      )}
    </section>
  );
}

function ReportResults({ report }: { readonly report: ReportResultDto }) {
  if (report.reportType === 'FUEL_ISSUANCE') return <FuelReportResults report={report} />;
  if (report.reportType === 'DISPATCH') return <DispatchReportResults report={report} />;
  if (report.reportType === 'BUDGET_ALLOCATION_ACTIVITY') {
    return <BudgetAllocationActivityResults report={report} />;
  }
  return <SummaryReportResults report={report} />;
}

function overviewFilters(
  reportType: ReportType,
  parsed: ReturnType<typeof parseReportPageQuery>,
): NormalizedReportFilters {
  return {
    reportType,
    requestingOfficePublicId: parsed.values.requestingOfficePublicId || null,
    periodType: parsed.resolvedPeriod.periodType,
    referenceDate: parsed.resolvedPeriod.referenceDate,
    startDate: parsed.resolvedPeriod.startDate,
    endDate: parsed.resolvedPeriod.endDate,
    status: null,
    cursor: null,
    pageSize: Number(parsed.values.pageSize),
  };
}

function InvalidFilters({
  details,
}: {
  readonly details: readonly { readonly field?: string; readonly reason: string }[];
}) {
  const detail = details[0];
  return (
    <Card role="alert">
      <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
        <FileSpreadsheet className="size-9 text-destructive" aria-hidden="true" />
        <h1 className="font-heading text-2xl font-semibold">Invalid report filters</h1>
        <p className="text-muted-foreground">
          {detail?.field === undefined
            ? (detail?.reason ?? 'Clear the filters and try again.')
            : `${detail.field}: ${detail.reason}`}
        </p>
        <Button asChild variant="outline">
          <Link href="/reports">Clear filters</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function ReportMessage({ title, body }: { readonly title: string; readonly body: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <h1 className="font-heading text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}
