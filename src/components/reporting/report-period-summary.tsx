import { AlertCircle, CalendarRange } from 'lucide-react';

import type {
  ReportResultDto,
  ResolvedReportPeriod,
} from '@/application/reporting/dto/report-dtos';
import { Badge } from '@/components/ui/badge';
import {
  formatReportCivilDate,
  formatReportDateTime,
  reportPeriodLabel,
} from '@/components/reporting/report-formatting';

export function ReportPeriodSummary({ report }: { readonly report: ReportResultDto }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <CalendarRange className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
        <div>
          <p className="font-semibold">
            {reportPeriodLabel(report.period.periodType)} · {periodRange(report.period)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {report.office?.label ?? 'All requesting offices'} · Generated{' '}
            {formatReportDateTime(report.generatedAt)} · Data as of{' '}
            {formatReportDateTime(report.dataAsOf)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{report.totals.rowCount.toLocaleString('en-PH')} rows</Badge>
        {report.truncated ? (
          <Badge className="border-warning/40 bg-warning/10 text-warning">
            <AlertCircle className="mr-1 size-3" aria-hidden="true" /> Bounded result
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

export function periodRange(period: ResolvedReportPeriod): string {
  return `${formatReportCivilDate(period.startDate)} to ${formatReportCivilDate(period.endDate)}`;
}
