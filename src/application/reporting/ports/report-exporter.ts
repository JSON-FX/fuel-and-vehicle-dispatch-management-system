import type {
  NormalizedReportFilters,
  ReportRow,
  ReportType,
  ResolvedReportPeriod,
} from '@/application/reporting/dto/report-dtos';

export interface ReportExportSink {
  readonly storageKey: string;
  readonly writable: WritableStream<Uint8Array>;
}

export interface ReportExportResult {
  readonly rowCount: number;
  readonly filename: string;
  readonly mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}

export interface ReportExporter {
  export(input: {
    readonly reportType: ReportType;
    readonly filters: NormalizedReportFilters;
    readonly period: ResolvedReportPeriod;
    readonly generatedAt: Date;
    readonly dataAsOf: Date;
    readonly rows: AsyncIterable<ReportRow>;
    readonly sink: ReportExportSink;
    readonly signal?: AbortSignal;
  }): Promise<ReportExportResult>;
}
