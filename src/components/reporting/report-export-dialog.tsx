'use client';

import { FileSpreadsheet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { ExportJobDto } from '@/application/reporting/dto/export-job-dtos';
import type { NormalizedReportFilters } from '@/application/reporting/dto/report-dtos';
import { readApiResponse } from '@/components/forms/auth-form-utils';
import { periodRange } from '@/components/reporting/report-period-summary';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function ReportExportDialog({
  filters,
  label,
  officeLabel,
  csrfToken,
}: {
  readonly filters: NormalizedReportFilters;
  readonly label: string;
  readonly officeLabel: string;
  readonly csrfToken: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  async function requestExport(): Promise<void> {
    setPending(true);
    setMessage('');
    try {
      const response = await fetch('/api/report-exports', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({
          reportType: filters.reportType,
          requestingOfficePublicId: filters.requestingOfficePublicId ?? undefined,
          periodType: filters.periodType,
          referenceDate: filters.referenceDate ?? undefined,
          startDate: filters.periodType === 'CUSTOM' ? filters.startDate : undefined,
          endDate: filters.periodType === 'CUSTOM' ? filters.endDate : undefined,
          status: filters.status ?? undefined,
        }),
      });
      const job = await readApiResponse<ExportJobDto>(response);
      setMessage(
        job.status === 'COMPLETED'
          ? 'The workbook is ready in recent exports.'
          : 'The export is queued. Recent exports will update automatically.',
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The export could not be requested.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">
          <FileSpreadsheet aria-hidden="true" /> Export XLSX
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export {label}</DialogTitle>
          <DialogDescription>
            Confirm the normalized filters before creating a private workbook.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid gap-3 rounded-md border bg-muted/40 p-4 text-sm sm:grid-cols-2">
          <Details label="Period">
            {periodRange({
              periodType: filters.periodType,
              startDate: filters.startDate,
              endDate: filters.endDate,
              referenceDate: filters.referenceDate,
              timeZone: 'Asia/Manila',
            })}
          </Details>
          <Details label="Office">{officeLabel}</Details>
          <Details label="Hard row limit">100,000 rows</Details>
          <Details label="Hard file limit">50 MiB</Details>
        </dl>
        <p className="min-h-6 text-sm text-muted-foreground" aria-live="polite">
          {message}
        </p>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </DialogClose>
          <Button type="button" onClick={requestExport} disabled={pending}>
            {pending ? 'Requesting…' : 'Request export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Details({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="font-semibold">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
