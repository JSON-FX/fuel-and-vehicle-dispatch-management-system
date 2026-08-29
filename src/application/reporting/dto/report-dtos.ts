export const REPORT_TYPES = [
  'FUEL_ISSUANCE',
  'DISPATCH',
  'FUEL_BY_OFFICE',
  'FUEL_BY_VEHICLE',
  'FUEL_TYPE_TOTALS',
  'FUEL_AMOUNT_BY_PERIOD',
  'DISPATCH_COUNT_BY_OFFICE',
  'VEHICLE_UTILIZATION',
  'BUDGET_ALLOCATION_ACTIVITY',
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];
export type ReportPageType = 'OVERVIEW' | ReportType;

export const REPORT_PERIOD_TYPES = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'CUSTOM'] as const;

export type ReportPeriodType = (typeof REPORT_PERIOD_TYPES)[number];
export type FuelReportStatus = 'POSTED' | 'VOIDED';
export type DispatchReportStatus = 'DRAFT' | 'DISPATCHED' | 'COMPLETED' | 'CANCELLED';
export type ReportDetailStatus = FuelReportStatus | DispatchReportStatus;

export interface ResolvedReportPeriod {
  readonly periodType: ReportPeriodType;
  readonly startDate: string;
  readonly endDate: string;
  readonly referenceDate: string | null;
  readonly timeZone: 'Asia/Manila';
}

export interface NormalizedReportFilters {
  readonly reportType: ReportType;
  readonly requestingOfficePublicId: string | null;
  readonly periodType: ReportPeriodType;
  readonly referenceDate: string | null;
  readonly startDate: string;
  readonly endDate: string;
  readonly status: ReportDetailStatus | null;
  readonly cursor: string | null;
  readonly pageSize: number;
}

export interface ReportReferenceDto {
  readonly publicId: string;
  readonly label: string;
}

export interface FuelIssuanceReportRow {
  readonly reportType: 'FUEL_ISSUANCE';
  readonly publicId: string;
  readonly risNumber: string | null;
  readonly purchaseRequestNumber: string;
  readonly entryDate: string;
  readonly driver: ReportReferenceDto;
  readonly vehicle: ReportReferenceDto & { readonly plateNumber: string };
  readonly destination: string;
  readonly purpose: string;
  readonly fuelType: 'DIESEL' | 'GASOLINE';
  readonly issuedLiters: string;
  readonly unitPrice: string;
  readonly totalAmount: string;
  readonly office: ReportReferenceDto;
  readonly budgetAllocation: ReportReferenceDto;
  readonly status: FuelReportStatus;
}

export interface DispatchReportRow {
  readonly reportType: 'DISPATCH';
  readonly publicId: string;
  readonly entryDate: string;
  readonly travelDate: string;
  readonly driver: ReportReferenceDto;
  readonly vehicle: ReportReferenceDto & { readonly plateNumber: string };
  readonly office: ReportReferenceDto;
  readonly destination: string;
  readonly purpose: string;
  readonly odoBefore: string;
  readonly odoAfter: string | null;
  readonly distance: string | null;
  readonly passengerCount: number;
  readonly status: DispatchReportStatus;
}

export interface FuelByOfficeReportRow {
  readonly reportType: 'FUEL_BY_OFFICE';
  readonly office: ReportReferenceDto;
  readonly issuanceCount: number;
  readonly issuedLiters: string;
  readonly totalAmount: string;
}

export interface FuelByVehicleReportRow {
  readonly reportType: 'FUEL_BY_VEHICLE';
  readonly vehicle: ReportReferenceDto & { readonly plateNumber: string };
  readonly issuanceCount: number;
  readonly issuedLiters: string;
  readonly totalAmount: string;
}

export interface FuelTypeTotalsReportRow {
  readonly reportType: 'FUEL_TYPE_TOTALS';
  readonly fuelType: 'DIESEL' | 'GASOLINE';
  readonly issuanceCount: number;
  readonly issuedLiters: string;
  readonly totalAmount: string;
}

export interface FuelAmountByPeriodReportRow {
  readonly reportType: 'FUEL_AMOUNT_BY_PERIOD';
  readonly periodLabel: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly issuanceCount: number;
  readonly totalAmount: string;
}

export interface DispatchCountByOfficeReportRow {
  readonly reportType: 'DISPATCH_COUNT_BY_OFFICE';
  readonly office: ReportReferenceDto;
  readonly dispatchCount: number;
}

export interface VehicleUtilizationReportRow {
  readonly reportType: 'VEHICLE_UTILIZATION';
  readonly vehicle: ReportReferenceDto & { readonly plateNumber: string };
  readonly completedTrips: number;
  readonly completedDistance: string;
}

export interface BudgetAllocationActivityReportRow {
  readonly reportType: 'BUDGET_ALLOCATION_ACTIVITY';
  readonly budgetAllocation: ReportReferenceDto;
  readonly office: ReportReferenceDto;
  readonly fiscalYear: number;
  readonly quarter: number;
  readonly issuanceCount: number;
  readonly issuedLiters: string;
  readonly totalAmount: string;
}

export type ReportRow =
  | FuelIssuanceReportRow
  | DispatchReportRow
  | FuelByOfficeReportRow
  | FuelByVehicleReportRow
  | FuelTypeTotalsReportRow
  | FuelAmountByPeriodReportRow
  | DispatchCountByOfficeReportRow
  | VehicleUtilizationReportRow
  | BudgetAllocationActivityReportRow;

export interface ReportTotalsDto {
  readonly rowCount: number;
  readonly issuedLiters: string | null;
  readonly totalAmount: string | null;
  readonly dispatchCount: number | null;
  readonly completedDistance: string | null;
}

export interface ReportResultDto {
  readonly reportType: ReportType;
  readonly label: string;
  readonly filters: NormalizedReportFilters;
  readonly period: ResolvedReportPeriod;
  readonly office: ReportReferenceDto | null;
  readonly rows: readonly ReportRow[];
  readonly totals: ReportTotalsDto;
  readonly generatedAt: string;
  readonly dataAsOf: string;
  readonly nextCursor: string | null;
  readonly truncated: boolean;
}

export interface ReportFilterOptionsDto {
  readonly offices: readonly ReportReferenceDto[];
}

export interface ReportRequestContext {
  readonly principal: CurrentPrincipal;
  readonly requestId: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}
import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
