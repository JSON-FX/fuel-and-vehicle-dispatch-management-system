import { Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import Decimal from 'decimal.js';
import ExcelJS from 'exceljs';

import type {
  NormalizedReportFilters,
  ReportRow,
  ReportType,
} from '@/application/reporting/dto/report-dtos';
import type {
  ReportExporter,
  ReportExportResult,
} from '@/application/reporting/ports/report-exporter';
import { getReportDefinition } from '@/application/reporting/services/report-catalogue';

import { sanitizeSpreadsheetText } from './spreadsheet-text-sanitizer';

const workbookMimeType =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' as const;

interface ExportLimits {
  readonly maxRows: number;
  readonly maxBytes: number;
  readonly timeoutMs: number;
}

interface ColumnDefinition {
  readonly heading: string;
  readonly width: number;
  readonly kind: 'text' | 'integer' | 'decimal';
  readonly numberFormat?: string;
}

interface Totals {
  rowCount: number;
  issuedLiters: Decimal;
  totalAmount: Decimal;
  dispatchCount: number;
  completedDistance: Decimal;
}

const defaultLimits: ExportLimits = {
  maxRows: 100_000,
  maxBytes: 50 * 1024 * 1024,
  timeoutMs: 15 * 60_000,
};

export class ReportExportLimitError extends Error {
  constructor(
    readonly code: 'ROW_LIMIT_EXCEEDED' | 'FILE_LIMIT_EXCEEDED' | 'GENERATION_TIMEOUT',
    message: string,
  ) {
    super(message);
    this.name = 'ReportExportLimitError';
  }
}

export class ExcelJsReportExporter implements ReportExporter {
  private readonly limits: ExportLimits;

  constructor(limits: Partial<ExportLimits> = {}) {
    this.limits = { ...defaultLimits, ...limits };
  }

  async export(input: Parameters<ReportExporter['export']>[0]): Promise<ReportExportResult> {
    const output = Writable.fromWeb(input.sink.writable);
    let byteLength = 0;
    const byteGuard = new Transform({
      transform: (chunk: Buffer, _encoding, callback) => {
        byteLength += chunk.byteLength;
        if (byteLength > this.limits.maxBytes) {
          callback(
            new ReportExportLimitError(
              'FILE_LIMIT_EXCEEDED',
              'The workbook exceeded the 50 MiB export limit.',
            ),
          );
          return;
        }
        callback(null, chunk);
      },
    });
    const outputPipeline = pipeline(byteGuard, output);
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: byteGuard,
      useSharedStrings: false,
      useStyles: true,
    });
    const timeout = setTimeout(() => {
      byteGuard.destroy(
        new ReportExportLimitError(
          'GENERATION_TIMEOUT',
          'The workbook exceeded the 15-minute generation limit.',
        ),
      );
    }, this.limits.timeoutMs);
    timeout.unref();

    try {
      const columns = columnsFor(input.reportType);
      const report = workbook.addWorksheet('Report', {
        views: [{ state: 'frozen', ySplit: 6 }],
        properties: { defaultRowHeight: 18 },
      });
      report.columns = columns.map((column) => ({ width: column.width }));
      addReportHeader(report, input.reportType, columns.length, input);

      const heading = report.addRow(columns.map((column) => column.heading));
      styleHeading(heading);
      heading.commit();
      report.autoFilter = {
        from: { row: 6, column: 1 },
        to: { row: 6, column: columns.length },
      };

      const totals = emptyTotals();
      let rowCount = 0;
      for await (const reportRow of input.rows) {
        throwIfAborted(input.signal);
        rowCount += 1;
        if (rowCount > this.limits.maxRows) {
          throw new ReportExportLimitError(
            'ROW_LIMIT_EXCEEDED',
            'The report exceeded the 100,000-row export limit.',
          );
        }
        const values = valuesFor(reportRow);
        const row = report.addRow(values.map((value, index) => cellValue(value, columns[index]!)));
        formatDataRow(row, columns);
        row.commit();
        collectTotals(totals, reportRow);
      }

      const totalRow = report.addRow(totalValues(input.reportType, totals));
      styleTotals(totalRow, columns);
      totalRow.commit();
      report.commit();

      const filters = workbook.addWorksheet('Filters', {
        views: [{ state: 'frozen', ySplit: 1 }],
      });
      filters.columns = [{ width: 28 }, { width: 42 }];
      const filterHeading = filters.addRow(['Field', 'Value']);
      styleHeading(filterHeading);
      filterHeading.commit();
      for (const [label, value] of filterRows(input)) {
        const row = filters.addRow([
          sanitizeSpreadsheetText(label),
          sanitizeSpreadsheetText(value),
        ]);
        row.eachCell((cell) => {
          cell.numFmt = '@';
        });
        row.commit();
      }
      filters.commit();

      await workbook.commit();
      await outputPipeline;
      return {
        rowCount,
        filename: safeFilename(input.reportType, input.filters, input.generatedAt),
        mimeType: workbookMimeType,
      };
    } catch (error) {
      byteGuard.destroy();
      output.destroy();
      await outputPipeline.catch(() => undefined);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function addReportHeader(
  worksheet: ExcelJS.Worksheet,
  reportType: ReportType,
  columnCount: number,
  input: Parameters<ReportExporter['export']>[0],
): void {
  const title = worksheet.addRow([getReportDefinition(reportType).label]);
  worksheet.mergeCells(1, 1, 1, columnCount);
  title.font = { bold: true, size: 16, color: { argb: 'FF0F172A' } };
  title.commit();
  addMetadataRow(worksheet, 'Generated at', input.generatedAt.toISOString(), columnCount);
  addMetadataRow(worksheet, 'Data as of', input.dataAsOf.toISOString(), columnCount);
  addMetadataRow(
    worksheet,
    'Inclusive period',
    `${input.period.startDate} to ${input.period.endDate} (${input.period.timeZone})`,
    columnCount,
  );
  worksheet.addRow([]).commit();
}

function addMetadataRow(
  worksheet: ExcelJS.Worksheet,
  label: string,
  value: string,
  columnCount: number,
): void {
  const row = worksheet.addRow([label, value]);
  if (columnCount > 2) worksheet.mergeCells(row.number, 2, row.number, columnCount);
  row.getCell(1).font = { bold: true };
  row.getCell(1).numFmt = '@';
  row.getCell(2).numFmt = '@';
  row.commit();
}

function styleHeading(row: ExcelJS.Row): void {
  row.height = 24;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4C81' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
    cell.numFmt = '@';
  });
}

function formatDataRow(row: ExcelJS.Row, columns: readonly ColumnDefinition[]): void {
  columns.forEach((column, index) => {
    const cell = row.getCell(index + 1);
    cell.alignment = { vertical: 'top', wrapText: column.kind === 'text' };
    cell.numFmt = column.kind === 'text' ? '@' : (column.numberFormat ?? '0');
  });
}

function styleTotals(row: ExcelJS.Row, columns: readonly ColumnDefinition[]): void {
  row.font = { bold: true };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  formatDataRow(row, columns);
}

function cellValue(value: string | number | null, column: ColumnDefinition): string | number {
  if (column.kind === 'text') return sanitizeSpreadsheetText(value === null ? '' : String(value));
  if (value === null || value === '') return 0;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || Math.abs(numeric) > Number.MAX_SAFE_INTEGER) {
    throw new ReportExportLimitError(
      'FILE_LIMIT_EXCEEDED',
      'A numeric report value is outside the safe workbook range.',
    );
  }
  return numeric;
}

function columnsFor(reportType: ReportType): readonly ColumnDefinition[] {
  const text = (heading: string, width: number): ColumnDefinition => ({
    heading,
    width,
    kind: 'text',
  });
  const integer = (heading: string, width = 14): ColumnDefinition => ({
    heading,
    width,
    kind: 'integer',
    numberFormat: '0',
  });
  const decimal = (heading: string, format: string, width = 16): ColumnDefinition => ({
    heading,
    width,
    kind: 'decimal',
    numberFormat: format,
  });

  switch (reportType) {
    case 'FUEL_ISSUANCE':
      return [
        text('RIS number', 20),
        text('Purchase request', 20),
        text('Entry date', 14),
        text('Driver', 24),
        text('Vehicle', 22),
        text('Plate number', 16),
        text('Office', 26),
        text('Destination', 28),
        text('Purpose', 32),
        text('Fuel type', 14),
        decimal('Issued liters', '#,##0.000'),
        decimal('Unit price', '#,##0.0000'),
        decimal('Total amount', '#,##0.00'),
        text('Status', 14),
      ];
    case 'DISPATCH':
      return [
        text('Entry date', 14),
        text('Travel date', 14),
        text('Driver', 24),
        text('Vehicle', 22),
        text('Plate number', 16),
        text('Office', 26),
        text('Destination', 28),
        text('Purpose', 32),
        integer('Passengers'),
        decimal('Odometer before', '#,##0.0'),
        decimal('Odometer after', '#,##0.0'),
        decimal('Distance', '#,##0.0'),
        text('Status', 14),
      ];
    case 'FUEL_BY_OFFICE':
      return [
        text('Office', 30),
        integer('Issuances'),
        decimal('Issued liters', '#,##0.000'),
        decimal('Total amount', '#,##0.00'),
      ];
    case 'FUEL_BY_VEHICLE':
      return [
        text('Vehicle', 26),
        text('Plate number', 16),
        integer('Issuances'),
        decimal('Issued liters', '#,##0.000'),
        decimal('Total amount', '#,##0.00'),
      ];
    case 'FUEL_TYPE_TOTALS':
      return [
        text('Fuel type', 16),
        integer('Issuances'),
        decimal('Issued liters', '#,##0.000'),
        decimal('Total amount', '#,##0.00'),
      ];
    case 'FUEL_AMOUNT_BY_PERIOD':
      return [
        text('Period', 18),
        text('Period start', 14),
        text('Period end', 14),
        integer('Issuances'),
        decimal('Total amount', '#,##0.00'),
      ];
    case 'DISPATCH_COUNT_BY_OFFICE':
      return [text('Office', 30), integer('Dispatches')];
    case 'VEHICLE_UTILIZATION':
      return [
        text('Vehicle', 26),
        text('Plate number', 16),
        integer('Completed trips'),
        decimal('Completed distance', '#,##0.0', 20),
      ];
    case 'BUDGET_ALLOCATION_ACTIVITY':
      return [
        text('PPMP number', 22),
        text('Office', 30),
        integer('Fiscal year'),
        integer('Quarter'),
        integer('Issuances'),
        decimal('Issued liters', '#,##0.000'),
        decimal('Total amount', '#,##0.00'),
      ];
  }
}

function valuesFor(row: ReportRow): readonly (string | number | null)[] {
  switch (row.reportType) {
    case 'FUEL_ISSUANCE':
      return [
        row.risNumber,
        row.purchaseRequestNumber,
        row.entryDate,
        row.driver.label,
        row.vehicle.label,
        row.vehicle.plateNumber,
        row.office.label,
        row.destination,
        row.purpose,
        row.fuelType,
        row.issuedLiters,
        row.unitPrice,
        row.totalAmount,
        row.status,
      ];
    case 'DISPATCH':
      return [
        row.entryDate,
        row.travelDate,
        row.driver.label,
        row.vehicle.label,
        row.vehicle.plateNumber,
        row.office.label,
        row.destination,
        row.purpose,
        row.passengerCount,
        row.odoBefore,
        row.odoAfter,
        row.distance,
        row.status,
      ];
    case 'FUEL_BY_OFFICE':
      return [row.office.label, row.issuanceCount, row.issuedLiters, row.totalAmount];
    case 'FUEL_BY_VEHICLE':
      return [
        row.vehicle.label,
        row.vehicle.plateNumber,
        row.issuanceCount,
        row.issuedLiters,
        row.totalAmount,
      ];
    case 'FUEL_TYPE_TOTALS':
      return [row.fuelType, row.issuanceCount, row.issuedLiters, row.totalAmount];
    case 'FUEL_AMOUNT_BY_PERIOD':
      return [row.periodLabel, row.periodStart, row.periodEnd, row.issuanceCount, row.totalAmount];
    case 'DISPATCH_COUNT_BY_OFFICE':
      return [row.office.label, row.dispatchCount];
    case 'VEHICLE_UTILIZATION':
      return [
        row.vehicle.label,
        row.vehicle.plateNumber,
        row.completedTrips,
        row.completedDistance,
      ];
    case 'BUDGET_ALLOCATION_ACTIVITY':
      return [
        row.budgetAllocation.label,
        row.office.label,
        row.fiscalYear,
        row.quarter,
        row.issuanceCount,
        row.issuedLiters,
        row.totalAmount,
      ];
  }
}

function emptyTotals(): Totals {
  return {
    rowCount: 0,
    issuedLiters: new Decimal(0),
    totalAmount: new Decimal(0),
    dispatchCount: 0,
    completedDistance: new Decimal(0),
  };
}

function collectTotals(totals: Totals, row: ReportRow): void {
  totals.rowCount += 1;
  switch (row.reportType) {
    case 'FUEL_ISSUANCE':
    case 'FUEL_BY_OFFICE':
    case 'FUEL_BY_VEHICLE':
    case 'FUEL_TYPE_TOTALS':
    case 'BUDGET_ALLOCATION_ACTIVITY':
      totals.issuedLiters = totals.issuedLiters.add(row.issuedLiters);
      totals.totalAmount = totals.totalAmount.add(row.totalAmount);
      break;
    case 'FUEL_AMOUNT_BY_PERIOD':
      totals.totalAmount = totals.totalAmount.add(row.totalAmount);
      break;
    case 'DISPATCH':
      totals.dispatchCount += 1;
      if (row.distance !== null)
        totals.completedDistance = totals.completedDistance.add(row.distance);
      break;
    case 'DISPATCH_COUNT_BY_OFFICE':
      totals.dispatchCount += row.dispatchCount;
      break;
    case 'VEHICLE_UTILIZATION':
      totals.dispatchCount += row.completedTrips;
      totals.completedDistance = totals.completedDistance.add(row.completedDistance);
      break;
  }
}

function totalValues(reportType: ReportType, totals: Totals): readonly (string | number)[] {
  switch (reportType) {
    case 'FUEL_ISSUANCE':
      return [
        'Totals',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        totals.issuedLiters.toNumber(),
        '',
        totals.totalAmount.toNumber(),
        '',
      ];
    case 'DISPATCH':
      return [
        'Totals',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        totals.dispatchCount,
        '',
        '',
        totals.completedDistance.toNumber(),
        '',
      ];
    case 'FUEL_BY_OFFICE':
      return [
        'Totals',
        totals.rowCount,
        totals.issuedLiters.toNumber(),
        totals.totalAmount.toNumber(),
      ];
    case 'FUEL_BY_VEHICLE':
    case 'FUEL_TYPE_TOTALS':
      return [
        'Totals',
        '',
        totals.rowCount,
        totals.issuedLiters.toNumber(),
        totals.totalAmount.toNumber(),
      ];
    case 'FUEL_AMOUNT_BY_PERIOD':
      return ['Totals', '', '', totals.rowCount, totals.totalAmount.toNumber()];
    case 'DISPATCH_COUNT_BY_OFFICE':
      return ['Totals', totals.dispatchCount];
    case 'VEHICLE_UTILIZATION':
      return ['Totals', '', totals.dispatchCount, totals.completedDistance.toNumber()];
    case 'BUDGET_ALLOCATION_ACTIVITY':
      return [
        'Totals',
        '',
        '',
        '',
        totals.rowCount,
        totals.issuedLiters.toNumber(),
        totals.totalAmount.toNumber(),
      ];
  }
}

function filterRows(
  input: Parameters<ReportExporter['export']>[0],
): readonly (readonly [string, string])[] {
  return [
    ['Report type', input.reportType],
    ['Period type', input.period.periodType],
    ['Start date', input.period.startDate],
    ['End date', input.period.endDate],
    ['Office public ID', input.filters.requestingOfficePublicId ?? 'All offices'],
    ['Status', input.filters.status ?? 'All included statuses'],
    ['Generated at', input.generatedAt.toISOString()],
    ['Data as of', input.dataAsOf.toISOString()],
  ];
}

function safeFilename(
  reportType: ReportType,
  filters: NormalizedReportFilters,
  generatedAt: Date,
): string {
  const slug = reportType.toLowerCase().replaceAll('_', '-');
  const timestamp = generatedAt
    .toISOString()
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace('.000', '');
  return `${slug}-${filters.startDate}-to-${filters.endDate}-${timestamp}.xlsx`;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const error = new Error('Report export was aborted.');
    error.name = 'AbortError';
    throw error;
  }
}
