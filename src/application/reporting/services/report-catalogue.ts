import type { ReportDetailStatus, ReportType } from '@/application/reporting/dto/report-dtos';

export interface ReportDefinition {
  readonly type: ReportType;
  readonly label: string;
  readonly description: string;
  readonly family: 'FUEL' | 'DISPATCH' | 'BUDGET';
  readonly readPermission: 'fuel.read' | 'dispatch.read';
  readonly exportPermission: 'fuel.export' | 'report.export';
  readonly includedStatuses: readonly ReportDetailStatus[];
  readonly supportsStatusFilter: boolean;
}

export const REPORT_DEFINITIONS: Readonly<Record<ReportType, ReportDefinition>> = Object.freeze({
  FUEL_ISSUANCE: definition(
    'FUEL_ISSUANCE',
    'Fuel issuance detail',
    'Fuel',
    'fuel.read',
    'fuel.export',
    ['POSTED', 'VOIDED'],
    true,
  ),
  DISPATCH: definition(
    'DISPATCH',
    'Dispatch detail',
    'Dispatch',
    'dispatch.read',
    'report.export',
    ['DRAFT', 'DISPATCHED', 'COMPLETED', 'CANCELLED'],
    true,
  ),
  FUEL_BY_OFFICE: definition(
    'FUEL_BY_OFFICE',
    'Fuel consumption by office',
    'Fuel',
    'fuel.read',
    'fuel.export',
    ['POSTED'],
  ),
  FUEL_BY_VEHICLE: definition(
    'FUEL_BY_VEHICLE',
    'Fuel consumption by vehicle',
    'Fuel',
    'fuel.read',
    'fuel.export',
    ['POSTED'],
  ),
  FUEL_TYPE_TOTALS: definition(
    'FUEL_TYPE_TOTALS',
    'Fuel type totals',
    'Fuel',
    'fuel.read',
    'fuel.export',
    ['POSTED'],
  ),
  FUEL_AMOUNT_BY_PERIOD: definition(
    'FUEL_AMOUNT_BY_PERIOD',
    'Total fuel amount by period',
    'Fuel',
    'fuel.read',
    'fuel.export',
    ['POSTED'],
  ),
  DISPATCH_COUNT_BY_OFFICE: definition(
    'DISPATCH_COUNT_BY_OFFICE',
    'Dispatch count by office',
    'Dispatch',
    'dispatch.read',
    'report.export',
    ['DISPATCHED', 'COMPLETED'],
  ),
  VEHICLE_UTILIZATION: definition(
    'VEHICLE_UTILIZATION',
    'Vehicle utilization',
    'Dispatch',
    'dispatch.read',
    'report.export',
    ['COMPLETED'],
  ),
  BUDGET_ALLOCATION_ACTIVITY: definition(
    'BUDGET_ALLOCATION_ACTIVITY',
    'Fuel activity by budget allocation',
    'Budget',
    'fuel.read',
    'report.export',
    ['POSTED'],
  ),
});

export function getReportDefinition(reportType: ReportType): ReportDefinition {
  return REPORT_DEFINITIONS[reportType];
}

function definition(
  type: ReportType,
  label: string,
  familyLabel: 'Fuel' | 'Dispatch' | 'Budget',
  readPermission: ReportDefinition['readPermission'],
  exportPermission: ReportDefinition['exportPermission'],
  includedStatuses: readonly ReportDetailStatus[],
  supportsStatusFilter = false,
): ReportDefinition {
  return Object.freeze({
    type,
    label,
    description: `${familyLabel} activity for the selected office and period.`,
    family: familyLabel.toUpperCase() as ReportDefinition['family'],
    readPermission,
    exportPermission,
    includedStatuses: Object.freeze([...includedStatuses]),
    supportsStatusFilter,
  });
}
