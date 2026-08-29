'use client';

import { FileClock } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { ExportJobDto } from '@/application/reporting/dto/export-job-dtos';
import type { ReportType } from '@/application/reporting/dto/report-dtos';
import { getReportDefinition } from '@/application/reporting/services/report-catalogue';
import { readApiResponse } from '@/components/forms/auth-form-utils';
import { ExportDownloadButton } from '@/components/reporting/export-download-button';
import { ExportJobStatusBadge } from '@/components/reporting/export-job-status-badge';
import { formatReportDateTime, reportPeriodLabel } from '@/components/reporting/report-formatting';
import { Card, CardContent } from '@/components/ui/card';

export function RecentExportJobs({
  initialJobs,
  csrfToken,
  downloadableReportTypes,
}: {
  readonly initialJobs: readonly ExportJobDto[];
  readonly csrfToken: string;
  readonly downloadableReportTypes: readonly ReportType[];
}) {
  const [jobs, setJobs] = useState(initialJobs);
  const downloadable = new Set(downloadableReportTypes);

  useEffect(() => {
    if (!jobs.some((job) => job.status === 'QUEUED' || job.status === 'RUNNING')) return;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let active = true;

    async function poll(): Promise<void> {
      try {
        const response = await fetch('/api/report-exports?limit=20', {
          cache: 'no-store',
          signal: controller.signal,
        });
        const nextJobs = await readApiResponse<readonly ExportJobDto[]>(response);
        if (!active) return;
        setJobs(nextJobs);
        if (nextJobs.some((job) => job.status === 'QUEUED' || job.status === 'RUNNING')) {
          timeout = setTimeout(poll, document.hidden ? 15_000 : 3_000);
        }
      } catch {
        if (active && !controller.signal.aborted) {
          timeout = setTimeout(poll, document.hidden ? 30_000 : 10_000);
        }
      }
    }

    timeout = setTimeout(poll, document.hidden ? 15_000 : 3_000);
    return () => {
      active = false;
      controller.abort();
      if (timeout !== undefined) clearTimeout(timeout);
    };
  }, [jobs]);

  return (
    <section className="space-y-4" aria-labelledby="recent-exports-heading">
      <div>
        <h2 id="recent-exports-heading" className="font-heading text-xl font-semibold">
          Recent exports
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Private workbooks requested by your account. Completed files expire after seven days.
        </p>
      </div>
      {jobs.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-36 flex-col items-center justify-center gap-2 text-center">
            <FileClock className="size-8 text-muted-foreground" aria-hidden="true" />
            <h3 className="font-heading text-lg font-semibold">No exports requested</h3>
            <p className="text-sm text-muted-foreground">
              Open a report and use Export XLSX when you need a private workbook.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {jobs.map((job) => (
            <ExportJobCard
              key={job.publicId}
              job={job}
              csrfToken={csrfToken}
              canDownload={downloadable.has(job.reportType)}
            />
          ))}
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {jobs.some((job) => job.status === 'QUEUED' || job.status === 'RUNNING')
          ? 'Export progress is updating.'
          : 'Export progress is current.'}
      </p>
    </section>
  );
}

function ExportJobCard({
  job,
  csrfToken,
  canDownload,
}: {
  readonly job: ExportJobDto;
  readonly csrfToken: string;
  readonly canDownload: boolean;
}) {
  const downloadable =
    job.status === 'COMPLETED' &&
    canDownload &&
    job.fileExpiresAt !== null &&
    new Date(job.fileExpiresAt) > new Date();
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading font-semibold">
              {getReportDefinition(job.reportType).label}
            </h3>
            <ExportJobStatusBadge status={job.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Requested {formatReportDateTime(job.requestedAt)} · {reportPeriodLabel(job.periodType)}{' '}
            · {job.mode === 'SYNCHRONOUS' ? 'Immediate' : 'Queued'} · Attempt {job.attempts} of{' '}
            {job.maxAttempts}
          </p>
          {job.fileExpiresAt === null ? null : (
            <p className="text-sm text-muted-foreground">
              File expires {formatReportDateTime(job.fileExpiresAt)}
            </p>
          )}
          {job.failureMessage === null ? null : (
            <p className="text-sm text-destructive" role="alert">
              {job.failureMessage}
            </p>
          )}
          {job.status === 'EXPIRED' ? (
            <p className="text-sm text-muted-foreground">
              Regenerate this workbook from the report filters.
            </p>
          ) : null}
        </div>
        {downloadable ? (
          <ExportDownloadButton exportJobPublicId={job.publicId} csrfToken={csrfToken} />
        ) : null}
      </CardContent>
    </Card>
  );
}
