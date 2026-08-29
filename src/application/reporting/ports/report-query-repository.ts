import type {
  NormalizedReportFilters,
  ReportFilterOptionsDto,
  ReportResultDto,
  ReportRow,
} from '@/application/reporting/dto/report-dtos';

export interface ReportQueryRepository {
  getReport(filters: NormalizedReportFilters, generatedAt: Date): Promise<ReportResultDto>;
  getFilterOptions(): Promise<ReportFilterOptionsDto>;
  estimateRows(filters: NormalizedReportFilters, cap: number): Promise<number>;
  streamRows(filters: NormalizedReportFilters, signal?: AbortSignal): AsyncIterable<ReportRow>;
}
