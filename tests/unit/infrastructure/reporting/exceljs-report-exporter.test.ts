import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import type {
  FuelIssuanceReportRow,
  NormalizedReportFilters,
  ReportRow,
} from '@/application/reporting/dto/report-dtos';
import {
  ExcelJsReportExporter,
  ReportExportLimitError,
} from '@/infrastructure/reporting/exceljs-report-exporter';

const filters: NormalizedReportFilters = {
  reportType: 'FUEL_ISSUANCE',
  requestingOfficePublicId: null,
  periodType: 'MONTHLY',
  referenceDate: '2026-08-29',
  startDate: '2026-08-01',
  endDate: '2026-08-31',
  status: null,
  cursor: null,
  pageSize: 100,
};

function row(index: number): FuelIssuanceReportRow {
  return {
    reportType: 'FUEL_ISSUANCE',
    publicId: `01900000-0000-7000-8000-${String(index).padStart(12, '0')}`,
    risNumber: `RIS-${index}`,
    purchaseRequestNumber: `PR-${index}`,
    entryDate: '2026-08-29',
    driver: {
      publicId: '01900000-0000-7000-8000-000000000001',
      label: '=SUM(A1:A2)',
    },
    vehicle: {
      publicId: '01900000-0000-7000-8000-000000000002',
      label: 'Toyota Hiace',
      plateNumber: 'ABC-123',
    },
    destination: '\t=CMD()',
    purpose: 'Official delivery',
    fuelType: 'DIESEL',
    issuedLiters: '20.500',
    unitPrice: '60.0000',
    totalAmount: '1230.00',
    office: {
      publicId: '01900000-0000-7000-8000-000000000003',
      label: 'Provincial Services Office',
    },
    budgetAllocation: {
      publicId: '01900000-0000-7000-8000-000000000004',
      label: 'PPMP-2026-01',
    },
    status: 'POSTED',
  };
}

function collectingSink() {
  const chunks: Uint8Array[] = [];
  return {
    chunks,
    writable: new WritableStream<Uint8Array>({
      write(chunk) {
        chunks.push(new Uint8Array(chunk));
      },
    }),
  };
}

async function* rows(count: number): AsyncIterable<ReportRow> {
  for (let index = 1; index <= count; index += 1) yield row(index);
}

async function* selectedRows(input: readonly ReportRow[]): AsyncIterable<ReportRow> {
  yield* input;
}

describe('ExcelJS report exporter', () => {
  it('streams more than 1,000 rows into two stable worksheets and preserves text cell types', async () => {
    const sink = collectingSink();
    const exporter = new ExcelJsReportExporter();
    const result = await exporter.export({
      reportType: 'FUEL_ISSUANCE',
      filters,
      period: {
        periodType: 'MONTHLY',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        referenceDate: '2026-08-29',
        timeZone: 'Asia/Manila',
      },
      generatedAt: new Date('2026-08-29T02:03:04.000Z'),
      dataAsOf: new Date('2026-08-29T02:03:00.000Z'),
      rows: rows(1_001),
      sink: { storageKey: 'opaque-key', writable: sink.writable },
    });

    expect(result).toMatchObject({
      rowCount: 1_001,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: 'fuel-issuance-2026-08-01-to-2026-08-31-20260829T020304Z.xlsx',
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.concat(sink.chunks) as never);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Report', 'Filters']);
    const report = workbook.getWorksheet('Report')!;
    expect(report.views[0]).toMatchObject({ state: 'frozen', ySplit: 6 });
    expect(report.autoFilter).toBeDefined();
    expect(report.getCell('D7').value).toBe("'=SUM(A1:A2)");
    expect(report.getCell('D7').type).toBe(ExcelJS.ValueType.String);
    expect(report.getCell('H7').value).toBe("'=CMD()");
    expect(report.getCell('H7').type).toBe(ExcelJS.ValueType.String);
    expect(report.getCell('K7').type).toBe(ExcelJS.ValueType.Number);
    expect(report.getRow(report.rowCount).values).not.toContainEqual(
      expect.objectContaining({ formula: expect.any(String) }),
    );
    expect(workbook.getWorksheet('Filters')!.getCell('B2').value).toBe('FUEL_ISSUANCE');
  }, 30_000);

  it('rejects row and byte limits without publishing a workbook', async () => {
    const rowSink = collectingSink();
    const rowLimited = new ExcelJsReportExporter({ maxRows: 1 });
    await expect(
      rowLimited.export({
        reportType: 'FUEL_ISSUANCE',
        filters,
        period: {
          periodType: 'MONTHLY',
          startDate: '2026-08-01',
          endDate: '2026-08-31',
          referenceDate: '2026-08-29',
          timeZone: 'Asia/Manila',
        },
        generatedAt: new Date('2026-08-29T02:03:04.000Z'),
        dataAsOf: new Date('2026-08-29T02:03:00.000Z'),
        rows: rows(2),
        sink: { storageKey: 'row-limit', writable: rowSink.writable },
      }),
    ).rejects.toBeInstanceOf(ReportExportLimitError);

    const byteSink = collectingSink();
    const byteLimited = new ExcelJsReportExporter({ maxBytes: 100 });
    await expect(
      byteLimited.export({
        reportType: 'FUEL_ISSUANCE',
        filters,
        period: {
          periodType: 'MONTHLY',
          startDate: '2026-08-01',
          endDate: '2026-08-31',
          referenceDate: '2026-08-29',
          timeZone: 'Asia/Manila',
        },
        generatedAt: new Date('2026-08-29T02:03:04.000Z'),
        dataAsOf: new Date('2026-08-29T02:03:00.000Z'),
        rows: rows(1),
        sink: { storageKey: 'byte-limit', writable: byteSink.writable },
      }),
    ).rejects.toBeInstanceOf(ReportExportLimitError);

    const numericSink = collectingSink();
    await expect(
      new ExcelJsReportExporter().export({
        reportType: 'FUEL_ISSUANCE',
        filters,
        period: {
          periodType: 'MONTHLY',
          startDate: '2026-08-01',
          endDate: '2026-08-31',
          referenceDate: '2026-08-29',
          timeZone: 'Asia/Manila',
        },
        generatedAt: new Date('2026-08-29T02:03:04.000Z'),
        dataAsOf: new Date('2026-08-29T02:03:00.000Z'),
        rows: selectedRows([{ ...row(1), issuedLiters: 'Infinity' }]),
        sink: { storageKey: 'numeric-limit', writable: numericSink.writable },
      }),
    ).rejects.toBeInstanceOf(ReportExportLimitError);
  });

  it('writes every accepted row shape with report-specific totals', async () => {
    const reference = {
      publicId: '01900000-0000-7000-8000-000000000011',
      label: 'Operations',
    };
    const vehicle = { ...reference, plateNumber: 'ABC-123' };
    const cases: readonly {
      readonly reportType: ReportRow['reportType'];
      readonly rows: ReportRow[];
    }[] = [
      {
        reportType: 'DISPATCH',
        rows: [
          {
            reportType: 'DISPATCH',
            publicId: '01900000-0000-7000-8000-000000000021',
            entryDate: '2026-08-01',
            travelDate: '2026-08-02',
            driver: reference,
            vehicle,
            office: reference,
            destination: 'Capitol',
            purpose: 'Official travel',
            odoBefore: '100.0',
            odoAfter: '112.5',
            distance: '12.5',
            passengerCount: 2,
            status: 'COMPLETED',
          },
          {
            reportType: 'DISPATCH',
            publicId: '01900000-0000-7000-8000-000000000022',
            entryDate: '2026-08-03',
            travelDate: '2026-08-04',
            driver: reference,
            vehicle,
            office: reference,
            destination: 'Warehouse',
            purpose: 'Pickup',
            odoBefore: '112.5',
            odoAfter: null,
            distance: null,
            passengerCount: 1,
            status: 'DISPATCHED',
          },
        ],
      },
      {
        reportType: 'FUEL_BY_OFFICE',
        rows: [
          {
            reportType: 'FUEL_BY_OFFICE',
            office: reference,
            issuanceCount: 2,
            issuedLiters: '40.000',
            totalAmount: '2400.00',
          },
        ],
      },
      {
        reportType: 'FUEL_BY_VEHICLE',
        rows: [
          {
            reportType: 'FUEL_BY_VEHICLE',
            vehicle,
            issuanceCount: 2,
            issuedLiters: '40.000',
            totalAmount: '2400.00',
          },
        ],
      },
      {
        reportType: 'FUEL_TYPE_TOTALS',
        rows: [
          {
            reportType: 'FUEL_TYPE_TOTALS',
            fuelType: 'DIESEL',
            issuanceCount: 2,
            issuedLiters: '40.000',
            totalAmount: '2400.00',
          },
        ],
      },
      {
        reportType: 'FUEL_AMOUNT_BY_PERIOD',
        rows: [
          {
            reportType: 'FUEL_AMOUNT_BY_PERIOD',
            periodLabel: '2026-08',
            periodStart: '2026-08-01',
            periodEnd: '2026-08-31',
            issuanceCount: 2,
            totalAmount: '2400.00',
          },
        ],
      },
      {
        reportType: 'DISPATCH_COUNT_BY_OFFICE',
        rows: [{ reportType: 'DISPATCH_COUNT_BY_OFFICE', office: reference, dispatchCount: 3 }],
      },
      {
        reportType: 'VEHICLE_UTILIZATION',
        rows: [
          {
            reportType: 'VEHICLE_UTILIZATION',
            vehicle,
            completedTrips: 2,
            completedDistance: '24.5',
          },
        ],
      },
      {
        reportType: 'BUDGET_ALLOCATION_ACTIVITY',
        rows: [
          {
            reportType: 'BUDGET_ALLOCATION_ACTIVITY',
            budgetAllocation: { ...reference, label: 'PPMP-2026-01' },
            office: reference,
            fiscalYear: 2026,
            quarter: 3,
            issuanceCount: 2,
            issuedLiters: '40.000',
            totalAmount: '2400.00',
          },
        ],
      },
    ];

    for (const current of cases) {
      const sink = collectingSink();
      await expect(
        new ExcelJsReportExporter().export({
          reportType: current.reportType,
          filters: {
            ...filters,
            reportType: current.reportType,
            requestingOfficePublicId: reference.publicId,
            status: current.reportType === 'DISPATCH' ? 'COMPLETED' : null,
          },
          period: {
            periodType: 'MONTHLY',
            startDate: '2026-08-01',
            endDate: '2026-08-31',
            referenceDate: '2026-08-29',
            timeZone: 'Asia/Manila',
          },
          generatedAt: new Date('2026-08-29T02:03:04.000Z'),
          dataAsOf: new Date('2026-08-29T02:03:00.000Z'),
          rows: selectedRows(current.rows),
          sink: { storageKey: current.reportType, writable: sink.writable },
        }),
      ).resolves.toMatchObject({ rowCount: current.rows.length });
      expect(Buffer.concat(sink.chunks).byteLength).toBeGreaterThan(0);
    }
  });
});
