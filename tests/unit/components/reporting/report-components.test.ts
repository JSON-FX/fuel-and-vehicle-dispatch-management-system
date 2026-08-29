import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { ExportJobDto } from '@/application/reporting/dto/export-job-dtos';
import type { ReportResultDto } from '@/application/reporting/dto/report-dtos';
import { DispatchReportResults } from '@/components/reporting/dispatch-report-results';
import { ExportJobStatusBadge } from '@/components/reporting/export-job-status-badge';
import { FuelReportResults } from '@/components/reporting/fuel-report-results';
import { RecentExportJobs } from '@/components/reporting/recent-export-jobs';
import { ReportFilterForm } from '@/components/reporting/report-filter-form';
import { ReportOverview } from '@/components/reporting/report-overview';
import { SummaryReportResults } from '@/components/reporting/summary-report-results';

const filters = {
  reportType: 'FUEL_ISSUANCE' as const,
  requestingOfficePublicId: null,
  periodType: 'MONTHLY' as const,
  referenceDate: '2026-08-29',
  startDate: '2026-08-01',
  endDate: '2026-08-31',
  status: null,
  cursor: null,
  pageSize: 100,
};

describe('reporting components', () => {
  it('renders concise, visible report filters with native GET fields', () => {
    const html = renderToStaticMarkup(
      createElement(ReportFilterForm, {
        values: {
          report: 'FUEL_ISSUANCE',
          requestingOfficePublicId: '',
          periodType: 'MONTHLY',
          referenceDate: '2026-08-29',
          startDate: '',
          endDate: '',
          status: '',
          pageSize: '100',
        },
        offices: [{ publicId: '01900000-0000-7000-8000-000000000001', label: 'Engineering' }],
        reportTypes: ['FUEL_ISSUANCE', 'FUEL_BY_OFFICE'],
      }),
    );
    expect(html).toContain('action="/reports"');
    expect(html).toContain('>Report<');
    expect(html).toContain('>Office<');
    expect(html).toContain('>Reference date<');
    expect(html).toContain('>Status<');
    expect(html).toContain('Apply filters');
    expect(html).not.toContain('Start date');
  });

  it('keeps complete fuel and dispatch detail in desktop tables and mobile cards', () => {
    const fuel = report({
      reportType: 'FUEL_ISSUANCE',
      rows: [
        {
          reportType: 'FUEL_ISSUANCE',
          publicId: '01900000-0000-7000-8000-000000000010',
          risNumber: 'RIS-2026-001',
          purchaseRequestNumber: 'PR-001',
          entryDate: '2026-08-29',
          driver: { publicId: 'driver', label: 'Juan Dela Cruz' },
          vehicle: { publicId: 'vehicle', label: 'Hilux', plateNumber: 'ABC-123' },
          destination: 'Valencia',
          purpose: 'Post qualification',
          fuelType: 'DIESEL',
          issuedLiters: '30.000',
          unitPrice: '61.2500',
          totalAmount: '1837.50',
          office: { publicId: 'office', label: 'Engineering' },
          budgetAllocation: { publicId: 'allocation', label: 'PPMP-2026-01' },
          status: 'POSTED',
        },
      ],
    });
    const dispatch = report({
      reportType: 'DISPATCH',
      rows: [
        {
          reportType: 'DISPATCH',
          publicId: '01900000-0000-7000-8000-000000000011',
          entryDate: '2026-08-28',
          travelDate: '2026-08-29',
          driver: { publicId: 'driver', label: 'Maria Santos' },
          vehicle: { publicId: 'vehicle', label: 'Van', plateNumber: 'XYZ-789' },
          office: { publicId: 'office', label: 'General Services' },
          destination: 'Capitol',
          purpose: 'Official travel',
          odoBefore: '1000.0',
          odoAfter: '1035.5',
          distance: '35.5',
          passengerCount: 4,
          status: 'COMPLETED',
        },
      ],
    });
    const html = renderToStaticMarkup(
      createElement('div', null, [
        createElement(FuelReportResults, { key: 'fuel', report: fuel }),
        createElement(DispatchReportResults, { key: 'dispatch', report: dispatch }),
      ]),
    );
    expect(html).toContain('Juan Dela Cruz');
    expect(html).toContain('PR-001');
    expect(html).toContain('Maria Santos');
    expect(html).toContain('35.5 km');
    expect(html.match(/Fuel issuance report results/g)?.length).toBe(2);
  });

  it('renders semantic summary results and authorized overview sections without charts', () => {
    const summary = report({
      reportType: 'FUEL_BY_OFFICE',
      rows: [
        {
          reportType: 'FUEL_BY_OFFICE',
          office: { publicId: 'office', label: 'Engineering' },
          issuanceCount: 2,
          issuedLiters: '55.000',
          totalAmount: '3300.00',
        },
      ],
    });
    const html = renderToStaticMarkup(
      createElement('div', null, [
        createElement(SummaryReportResults, { key: 'summary', report: summary }),
        createElement(ReportOverview, { key: 'overview', reports: [summary] }),
      ]),
    );
    expect(html).toContain('Engineering');
    expect(html).toContain('55.000 L');
    expect(html).toContain('₱3,300.00');
    expect(html).not.toContain('<canvas');
  });

  it('labels every job status and shows safe recent-job details', () => {
    const job = exportJob();
    const html = renderToStaticMarkup(
      createElement('div', null, [
        createElement(ExportJobStatusBadge, { key: 'status', status: 'COMPLETED' }),
        createElement(RecentExportJobs, {
          key: 'jobs',
          initialJobs: [job],
          csrfToken: 'csrf',
          downloadableReportTypes: ['FUEL_ISSUANCE'],
        }),
      ]),
    );
    expect(html).toContain('Completed');
    expect(html).toContain('Fuel issuance detail');
    expect(html).toContain('Attempt 1 of 3');
    expect(html).toContain('Download');
    expect(html).not.toContain('private/storage');
  });
});

function report(input: Pick<ReportResultDto, 'reportType' | 'rows'>): ReportResultDto {
  return {
    reportType: input.reportType,
    label: input.reportType === 'DISPATCH' ? 'Dispatch detail' : 'Fuel issuance detail',
    filters: { ...filters, reportType: input.reportType },
    period: {
      periodType: 'MONTHLY',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      referenceDate: '2026-08-29',
      timeZone: 'Asia/Manila',
    },
    office: null,
    rows: input.rows,
    totals: {
      rowCount: input.rows.length,
      issuedLiters: '55.000',
      totalAmount: '3300.00',
      dispatchCount: null,
      completedDistance: null,
    },
    generatedAt: '2026-08-29T00:00:00.000Z',
    dataAsOf: '2026-08-29T00:00:00.000Z',
    nextCursor: null,
    truncated: false,
  };
}

function exportJob(): ExportJobDto {
  return {
    publicId: '01900000-0000-7000-8000-000000000010',
    requesterPublicId: '01900000-0000-7000-8000-000000000001',
    reportType: 'FUEL_ISSUANCE',
    periodType: 'MONTHLY',
    filters,
    mode: 'SYNCHRONOUS',
    status: 'COMPLETED',
    estimatedRows: 1,
    actualRows: 1,
    attempts: 1,
    maxAttempts: 3,
    filename: 'fuel-report.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    byteLength: 1024,
    sha256: 'a'.repeat(64),
    failureCode: null,
    failureMessage: null,
    requestedAt: '2026-08-29T00:00:00.000Z',
    startedAt: '2026-08-29T00:00:00.000Z',
    finishedAt: '2026-08-29T00:00:01.000Z',
    fileExpiresAt: '2026-09-05T00:00:01.000Z',
  };
}
