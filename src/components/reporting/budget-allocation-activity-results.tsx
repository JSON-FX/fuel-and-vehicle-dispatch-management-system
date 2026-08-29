import type { ReportResultDto } from '@/application/reporting/dto/report-dtos';
import { SummaryReportResults } from '@/components/reporting/summary-report-results';

export function BudgetAllocationActivityResults({ report }: { readonly report: ReportResultDto }) {
  return <SummaryReportResults report={report} />;
}
