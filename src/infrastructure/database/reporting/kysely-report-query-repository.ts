import { createHash } from 'node:crypto';

import { sql, type Kysely } from 'kysely';

import type {
  BudgetAllocationActivityReportRow,
  DispatchCountByOfficeReportRow,
  DispatchReportRow,
  FuelAmountByPeriodReportRow,
  FuelByOfficeReportRow,
  FuelByVehicleReportRow,
  FuelIssuanceReportRow,
  FuelTypeTotalsReportRow,
  NormalizedReportFilters,
  ReportFilterOptionsDto,
  ReportResultDto,
  ReportRow,
  ReportTotalsDto,
  VehicleUtilizationReportRow,
} from '@/application/reporting/dto/report-dtos';
import type { ReportQueryRepository } from '@/application/reporting/ports/report-query-repository';
import { getReportDefinition } from '@/application/reporting/services/report-catalogue';
import { ValidationError } from '@/application/shared/errors/application-error';
import { DecimalValue } from '@/domain/shared/value-objects/decimal-value';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import type { Database } from '@/infrastructure/database/types';
import { binaryToPublicId, publicIdToBinary } from '@/infrastructure/database/uuid-binary';

interface ReportCursor {
  readonly version: 1;
  readonly reportType: NormalizedReportFilters['reportType'];
  readonly fingerprint: string;
  readonly date: string | null;
  readonly key: string;
}

interface PageRows {
  readonly rows: readonly ReportRow[];
  readonly nextCursor: string | null;
}

const fuelSummaryStatuses = ['POSTED'] as const;
const dispatchSummaryStatuses = ['DISPATCHED', 'COMPLETED'] as const;
const completedDispatchStatuses = ['COMPLETED'] as const;

export class KyselyReportQueryRepository implements ReportQueryRepository {
  constructor(private readonly database: Kysely<Database>) {}

  async getReport(filters: NormalizedReportFilters, generatedAt: Date): Promise<ReportResultDto> {
    const page = await this.fetchPage(filters);
    const office = await this.resolveOffice(filters.requestingOfficePublicId);
    const totals = await this.getTotals(filters);

    return Object.freeze({
      reportType: filters.reportType,
      label: getReportDefinition(filters.reportType).label,
      filters,
      period: {
        periodType: filters.periodType,
        startDate: filters.startDate,
        endDate: filters.endDate,
        referenceDate: filters.referenceDate,
        timeZone: 'Asia/Manila' as const,
      },
      office,
      rows: page.rows,
      totals,
      generatedAt: generatedAt.toISOString(),
      dataAsOf: generatedAt.toISOString(),
      nextCursor: page.nextCursor,
      truncated: false,
    });
  }

  async getFilterOptions(): Promise<ReportFilterOptionsDto> {
    const rows = await this.database
      .selectFrom('offices')
      .select(['public_id', 'office_name', 'abbreviation'])
      .where('status', '=', 'ACTIVE')
      .where('deleted_at', 'is', null)
      .orderBy('office_name')
      .orderBy('public_id')
      .execute();

    return {
      offices: rows.map((row) => ({
        publicId: binaryToPublicId(row.public_id).toString(),
        label: `${row.office_name} (${row.abbreviation})`,
      })),
    };
  }

  async estimateRows(filters: NormalizedReportFilters, cap: number): Promise<number> {
    const bounded = Math.max(1, cap) + 1;
    switch (filters.reportType) {
      case 'FUEL_ISSUANCE':
        return this.countFuelDetails(filters, bounded);
      case 'DISPATCH':
        return this.countDispatchDetails(filters, bounded);
      case 'FUEL_BY_OFFICE':
        return this.countFuelGroups(filters, 'office', bounded);
      case 'FUEL_BY_VEHICLE':
        return this.countFuelGroups(filters, 'vehicle', bounded);
      case 'FUEL_TYPE_TOTALS':
        return this.countFuelGroups(filters, 'fuelType', bounded);
      case 'FUEL_AMOUNT_BY_PERIOD':
        return this.countFuelGroups(filters, 'period', bounded);
      case 'DISPATCH_COUNT_BY_OFFICE':
        return this.countDispatchGroups(filters, 'office', bounded);
      case 'VEHICLE_UTILIZATION':
        return this.countDispatchGroups(filters, 'vehicle', bounded);
      case 'BUDGET_ALLOCATION_ACTIVITY':
        return this.countFuelGroups(filters, 'allocation', bounded);
    }
  }

  async *streamRows(
    filters: NormalizedReportFilters,
    signal?: AbortSignal,
  ): AsyncIterable<ReportRow> {
    let cursor: string | null = null;
    do {
      throwIfAborted(signal);
      const pageFilters = { ...filters, cursor, pageSize: Math.min(filters.pageSize, 200) };
      const page = await this.fetchPage(pageFilters);
      for (const row of page.rows) {
        throwIfAborted(signal);
        yield row;
      }
      cursor = page.nextCursor;
    } while (cursor !== null);
  }

  private async fetchPage(filters: NormalizedReportFilters): Promise<PageRows> {
    const cursor = this.decodeCursor(filters);
    switch (filters.reportType) {
      case 'FUEL_ISSUANCE':
        return this.fuelIssuancePage(filters, cursor);
      case 'DISPATCH':
        return this.dispatchPage(filters, cursor);
      case 'FUEL_BY_OFFICE':
        return this.fuelByOfficePage(filters, cursor);
      case 'FUEL_BY_VEHICLE':
        return this.fuelByVehiclePage(filters, cursor);
      case 'FUEL_TYPE_TOTALS':
        return this.fuelTypeTotalsPage(filters, cursor);
      case 'FUEL_AMOUNT_BY_PERIOD':
        return this.fuelAmountByPeriodPage(filters, cursor);
      case 'DISPATCH_COUNT_BY_OFFICE':
        return this.dispatchCountByOfficePage(filters, cursor);
      case 'VEHICLE_UTILIZATION':
        return this.vehicleUtilizationPage(filters, cursor);
      case 'BUDGET_ALLOCATION_ACTIVITY':
        return this.budgetAllocationActivityPage(filters, cursor);
    }
  }

  private fuelBase(filters: NormalizedReportFilters, statuses: readonly ('POSTED' | 'VOIDED')[]) {
    let query = this.database
      .selectFrom('fuel_issuances as fi')
      .innerJoin('drivers as driver', 'driver.id', 'fi.driver_id')
      .innerJoin('vehicles as vehicle', 'vehicle.id', 'fi.vehicle_id')
      .innerJoin('budget_allocations as allocation', 'allocation.id', 'fi.budget_allocation_id')
      .innerJoin('offices as office', 'office.id', 'allocation.office_id')
      .where('fi.entry_date', '>=', filters.startDate)
      .where('fi.entry_date', '<=', filters.endDate)
      .where('fi.status', 'in', statuses);
    if (filters.requestingOfficePublicId !== null) {
      query = query.where(
        'office.public_id',
        '=',
        publicIdToBinary(PublicId.from(filters.requestingOfficePublicId)),
      );
    }
    return query;
  }

  private dispatchBase(
    filters: NormalizedReportFilters,
    statuses: readonly ('DRAFT' | 'DISPATCHED' | 'COMPLETED' | 'CANCELLED')[],
  ) {
    let query = this.database
      .selectFrom('vehicle_dispatches as dispatch')
      .innerJoin('drivers as driver', 'driver.id', 'dispatch.driver_id')
      .innerJoin('vehicles as vehicle', 'vehicle.id', 'dispatch.vehicle_id')
      .innerJoin('offices as office', 'office.id', 'dispatch.requesting_office_id')
      .where('dispatch.travel_date', '>=', filters.startDate)
      .where('dispatch.travel_date', '<=', filters.endDate)
      .where('dispatch.status', 'in', statuses);
    if (filters.requestingOfficePublicId !== null) {
      query = query.where(
        'office.public_id',
        '=',
        publicIdToBinary(PublicId.from(filters.requestingOfficePublicId)),
      );
    }
    return query;
  }

  private fuelStatuses(filters: NormalizedReportFilters): readonly ('POSTED' | 'VOIDED')[] {
    return filters.status === null ? ['POSTED', 'VOIDED'] : [filters.status as 'POSTED' | 'VOIDED'];
  }

  private dispatchStatuses(
    filters: NormalizedReportFilters,
  ): readonly ('DRAFT' | 'DISPATCHED' | 'COMPLETED' | 'CANCELLED')[] {
    return filters.status === null
      ? ['DRAFT', 'DISPATCHED', 'COMPLETED', 'CANCELLED']
      : [filters.status as 'DRAFT' | 'DISPATCHED' | 'COMPLETED' | 'CANCELLED'];
  }

  private async fuelIssuancePage(
    filters: NormalizedReportFilters,
    cursor: ReportCursor | null,
  ): Promise<PageRows> {
    let query = this.fuelBase(filters, this.fuelStatuses(filters)).select([
      'fi.public_id',
      'fi.ris_number',
      'fi.purchase_request_number',
      'fi.entry_date',
      'fi.destination',
      'fi.purpose',
      'fi.fuel_type',
      'fi.issued_liters',
      'fi.unit_price',
      'fi.total_amount',
      'fi.status',
      'driver.public_id as driver_public_id',
      'driver.full_name as driver_name',
      'vehicle.public_id as vehicle_public_id',
      'vehicle.model_brand as vehicle_name',
      'vehicle.plate_no as plate_number',
      'office.public_id as office_public_id',
      'office.office_name as office_name',
      'allocation.public_id as allocation_public_id',
      'allocation.ppmp_number as allocation_number',
    ]);
    if (cursor !== null) {
      const cursorId = publicIdToBinary(PublicId.from(cursor.key));
      query = query.where((expression) =>
        expression.or([
          expression('fi.entry_date', '<', cursor.date!),
          expression.and([
            expression('fi.entry_date', '=', cursor.date!),
            expression('fi.public_id', '<', cursorId),
          ]),
        ]),
      );
    }
    const rows = await query
      .orderBy('fi.entry_date', 'desc')
      .orderBy('fi.public_id', 'desc')
      .limit(filters.pageSize + 1)
      .execute();
    return this.page(
      rows.map((row): FuelIssuanceReportRow => ({
        reportType: 'FUEL_ISSUANCE',
        publicId: id(row.public_id),
        risNumber: row.ris_number,
        purchaseRequestNumber: row.purchase_request_number,
        entryDate: row.entry_date,
        driver: { publicId: id(row.driver_public_id), label: row.driver_name },
        vehicle: {
          publicId: id(row.vehicle_public_id),
          label: row.vehicle_name,
          plateNumber: row.plate_number,
        },
        destination: row.destination,
        purpose: row.purpose,
        fuelType: row.fuel_type,
        issuedLiters: decimal(row.issued_liters ?? '0', 3),
        unitPrice: decimal(row.unit_price, 4),
        totalAmount: decimal(row.total_amount ?? '0', 2),
        office: { publicId: id(row.office_public_id), label: row.office_name },
        budgetAllocation: {
          publicId: id(row.allocation_public_id),
          label: row.allocation_number,
        },
        status: row.status as 'POSTED' | 'VOIDED',
      })),
      filters,
    );
  }

  private async dispatchPage(
    filters: NormalizedReportFilters,
    cursor: ReportCursor | null,
  ): Promise<PageRows> {
    let query = this.dispatchBase(filters, this.dispatchStatuses(filters)).select([
      'dispatch.public_id',
      'dispatch.entry_date',
      'dispatch.travel_date',
      'dispatch.destination',
      'dispatch.purpose',
      'dispatch.odo_before',
      'dispatch.odo_after',
      'dispatch.passenger_count',
      'dispatch.status',
      'driver.public_id as driver_public_id',
      'driver.full_name as driver_name',
      'vehicle.public_id as vehicle_public_id',
      'vehicle.model_brand as vehicle_name',
      'vehicle.plate_no as plate_number',
      'office.public_id as office_public_id',
      'office.office_name as office_name',
    ]);
    if (cursor !== null) {
      const cursorId = publicIdToBinary(PublicId.from(cursor.key));
      query = query.where((expression) =>
        expression.or([
          expression('dispatch.travel_date', '<', cursor.date!),
          expression.and([
            expression('dispatch.travel_date', '=', cursor.date!),
            expression('dispatch.public_id', '<', cursorId),
          ]),
        ]),
      );
    }
    const rows = await query
      .orderBy('dispatch.travel_date', 'desc')
      .orderBy('dispatch.public_id', 'desc')
      .limit(filters.pageSize + 1)
      .execute();
    return this.page(
      rows.map((row): DispatchReportRow => ({
        reportType: 'DISPATCH',
        publicId: id(row.public_id),
        entryDate: row.entry_date,
        travelDate: row.travel_date,
        driver: { publicId: id(row.driver_public_id), label: row.driver_name },
        vehicle: {
          publicId: id(row.vehicle_public_id),
          label: row.vehicle_name,
          plateNumber: row.plate_number,
        },
        office: { publicId: id(row.office_public_id), label: row.office_name },
        destination: row.destination,
        purpose: row.purpose,
        odoBefore: decimal(row.odo_before, 1),
        odoAfter: row.odo_after === null ? null : decimal(row.odo_after, 1),
        distance:
          row.status !== 'COMPLETED' || row.odo_after === null
            ? null
            : DecimalValue.from(row.odo_after)
                .subtract(DecimalValue.from(row.odo_before))
                .toFixed(1),
        passengerCount: row.passenger_count,
        status: row.status,
      })),
      filters,
    );
  }

  private async fuelByOfficePage(
    filters: NormalizedReportFilters,
    cursor: ReportCursor | null,
  ): Promise<PageRows> {
    let query = this.fuelBase(filters, fuelSummaryStatuses)
      .select([
        'office.public_id',
        'office.office_name',
        sql<string>`count(*)`.as('issuance_count'),
        sql<string>`coalesce(sum(fi.issued_liters), 0)`.as('issued_liters'),
        sql<string>`coalesce(sum(fi.total_amount), 0)`.as('total_amount'),
      ])
      .groupBy(['office.public_id', 'office.office_name']);
    if (cursor !== null) {
      query = query.where('office.public_id', '>', publicIdToBinary(PublicId.from(cursor.key)));
    }
    const rows = await query
      .orderBy('office.public_id')
      .limit(filters.pageSize + 1)
      .execute();
    return this.page(
      rows.map((row): FuelByOfficeReportRow => ({
        reportType: 'FUEL_BY_OFFICE',
        office: { publicId: id(row.public_id), label: row.office_name },
        issuanceCount: integer(row.issuance_count),
        issuedLiters: decimal(row.issued_liters, 3),
        totalAmount: decimal(row.total_amount, 2),
      })),
      filters,
    );
  }

  private async fuelByVehiclePage(
    filters: NormalizedReportFilters,
    cursor: ReportCursor | null,
  ): Promise<PageRows> {
    let query = this.fuelBase(filters, fuelSummaryStatuses)
      .select([
        'vehicle.public_id',
        'vehicle.model_brand',
        'vehicle.plate_no',
        sql<string>`count(*)`.as('issuance_count'),
        sql<string>`coalesce(sum(fi.issued_liters), 0)`.as('issued_liters'),
        sql<string>`coalesce(sum(fi.total_amount), 0)`.as('total_amount'),
      ])
      .groupBy(['vehicle.public_id', 'vehicle.model_brand', 'vehicle.plate_no']);
    if (cursor !== null) {
      query = query.where('vehicle.public_id', '>', publicIdToBinary(PublicId.from(cursor.key)));
    }
    const rows = await query
      .orderBy('vehicle.public_id')
      .limit(filters.pageSize + 1)
      .execute();
    return this.page(
      rows.map((row): FuelByVehicleReportRow => ({
        reportType: 'FUEL_BY_VEHICLE',
        vehicle: {
          publicId: id(row.public_id),
          label: row.model_brand,
          plateNumber: row.plate_no,
        },
        issuanceCount: integer(row.issuance_count),
        issuedLiters: decimal(row.issued_liters, 3),
        totalAmount: decimal(row.total_amount, 2),
      })),
      filters,
    );
  }

  private async fuelTypeTotalsPage(
    filters: NormalizedReportFilters,
    cursor: ReportCursor | null,
  ): Promise<PageRows> {
    let query = this.fuelBase(filters, fuelSummaryStatuses)
      .select([
        'fi.fuel_type',
        sql<string>`count(*)`.as('issuance_count'),
        sql<string>`coalesce(sum(fi.issued_liters), 0)`.as('issued_liters'),
        sql<string>`coalesce(sum(fi.total_amount), 0)`.as('total_amount'),
      ])
      .groupBy('fi.fuel_type');
    if (cursor !== null) query = query.where('fi.fuel_type', '>', cursor.key as 'DIESEL');
    const rows = await query
      .orderBy('fi.fuel_type')
      .limit(filters.pageSize + 1)
      .execute();
    return this.page(
      rows.map((row): FuelTypeTotalsReportRow => ({
        reportType: 'FUEL_TYPE_TOTALS',
        fuelType: row.fuel_type,
        issuanceCount: integer(row.issuance_count),
        issuedLiters: decimal(row.issued_liters, 3),
        totalAmount: decimal(row.total_amount, 2),
      })),
      filters,
    );
  }

  private async fuelAmountByPeriodPage(
    filters: NormalizedReportFilters,
    cursor: ReportCursor | null,
  ): Promise<PageRows> {
    const bucket = this.periodBucket(filters);
    let query = this.fuelBase(filters, fuelSummaryStatuses)
      .select([
        bucket.as('period_start'),
        sql<string>`count(*)`.as('issuance_count'),
        sql<string>`coalesce(sum(fi.total_amount), 0)`.as('total_amount'),
      ])
      .groupBy(bucket);
    if (cursor !== null) query = query.having(bucket, '>', cursor.key);
    const rows = await query
      .orderBy('period_start')
      .limit(filters.pageSize + 1)
      .execute();
    return this.page(
      rows.map((row): FuelAmountByPeriodReportRow => {
        const periodStart = String(row.period_start);
        const monthly = filters.periodType === 'ANNUAL';
        return {
          reportType: 'FUEL_AMOUNT_BY_PERIOD',
          periodLabel: monthly ? periodStart.slice(0, 7) : periodStart,
          periodStart,
          periodEnd: monthly ? monthEnd(periodStart) : periodStart,
          issuanceCount: integer(row.issuance_count),
          totalAmount: decimal(row.total_amount, 2),
        };
      }),
      filters,
    );
  }

  private async dispatchCountByOfficePage(
    filters: NormalizedReportFilters,
    cursor: ReportCursor | null,
  ): Promise<PageRows> {
    let query = this.dispatchBase(filters, dispatchSummaryStatuses)
      .select([
        'office.public_id',
        'office.office_name',
        sql<string>`count(*)`.as('dispatch_count'),
      ])
      .groupBy(['office.public_id', 'office.office_name']);
    if (cursor !== null) {
      query = query.where('office.public_id', '>', publicIdToBinary(PublicId.from(cursor.key)));
    }
    const rows = await query
      .orderBy('office.public_id')
      .limit(filters.pageSize + 1)
      .execute();
    return this.page(
      rows.map((row): DispatchCountByOfficeReportRow => ({
        reportType: 'DISPATCH_COUNT_BY_OFFICE',
        office: { publicId: id(row.public_id), label: row.office_name },
        dispatchCount: integer(row.dispatch_count),
      })),
      filters,
    );
  }

  private async vehicleUtilizationPage(
    filters: NormalizedReportFilters,
    cursor: ReportCursor | null,
  ): Promise<PageRows> {
    let query = this.dispatchBase(filters, completedDispatchStatuses)
      .where('dispatch.odo_after', 'is not', null)
      .select([
        'vehicle.public_id',
        'vehicle.model_brand',
        'vehicle.plate_no',
        sql<string>`count(*)`.as('completed_trips'),
        sql<string>`coalesce(sum(dispatch.odo_after - dispatch.odo_before), 0)`.as(
          'completed_distance',
        ),
      ])
      .groupBy(['vehicle.public_id', 'vehicle.model_brand', 'vehicle.plate_no']);
    if (cursor !== null) {
      query = query.where('vehicle.public_id', '>', publicIdToBinary(PublicId.from(cursor.key)));
    }
    const rows = await query
      .orderBy('vehicle.public_id')
      .limit(filters.pageSize + 1)
      .execute();
    return this.page(
      rows.map((row): VehicleUtilizationReportRow => ({
        reportType: 'VEHICLE_UTILIZATION',
        vehicle: {
          publicId: id(row.public_id),
          label: row.model_brand,
          plateNumber: row.plate_no,
        },
        completedTrips: integer(row.completed_trips),
        completedDistance: decimal(row.completed_distance, 1),
      })),
      filters,
    );
  }

  private async budgetAllocationActivityPage(
    filters: NormalizedReportFilters,
    cursor: ReportCursor | null,
  ): Promise<PageRows> {
    let query = this.fuelBase(filters, fuelSummaryStatuses)
      .select([
        'allocation.public_id',
        'allocation.ppmp_number',
        'allocation.fiscal_year',
        'allocation.quarter',
        'office.public_id as office_public_id',
        'office.office_name',
        sql<string>`count(*)`.as('issuance_count'),
        sql<string>`coalesce(sum(fi.issued_liters), 0)`.as('issued_liters'),
        sql<string>`coalesce(sum(fi.total_amount), 0)`.as('total_amount'),
      ])
      .groupBy([
        'allocation.public_id',
        'allocation.ppmp_number',
        'allocation.fiscal_year',
        'allocation.quarter',
        'office.public_id',
        'office.office_name',
      ]);
    if (cursor !== null) {
      query = query.where('allocation.public_id', '>', publicIdToBinary(PublicId.from(cursor.key)));
    }
    const rows = await query
      .orderBy('allocation.public_id')
      .limit(filters.pageSize + 1)
      .execute();
    return this.page(
      rows.map((row): BudgetAllocationActivityReportRow => ({
        reportType: 'BUDGET_ALLOCATION_ACTIVITY',
        budgetAllocation: { publicId: id(row.public_id), label: row.ppmp_number },
        office: { publicId: id(row.office_public_id), label: row.office_name },
        fiscalYear: row.fiscal_year,
        quarter: row.quarter,
        issuanceCount: integer(row.issuance_count),
        issuedLiters: decimal(row.issued_liters, 3),
        totalAmount: decimal(row.total_amount, 2),
      })),
      filters,
    );
  }

  private page(rows: readonly ReportRow[], filters: NormalizedReportFilters): PageRows {
    const hasExtra = rows.length > filters.pageSize;
    const items = rows.slice(0, filters.pageSize);
    const last = items.at(-1);
    return {
      rows: items,
      nextCursor: hasExtra && last !== undefined ? this.encodeCursor(filters, last) : null,
    };
  }

  private encodeCursor(filters: NormalizedReportFilters, row: ReportRow): string {
    const payload: ReportCursor = {
      version: 1,
      reportType: filters.reportType,
      fingerprint: filterFingerprint(filters),
      ...rowCursor(row),
    };
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  }

  private decodeCursor(filters: NormalizedReportFilters): ReportCursor | null {
    if (filters.cursor === null) return null;
    try {
      const text = Buffer.from(filters.cursor, 'base64url').toString('utf8');
      if (Buffer.from(text, 'utf8').toString('base64url') !== filters.cursor) throw new Error();
      const value = JSON.parse(text) as Partial<ReportCursor>;
      if (
        value.version !== 1 ||
        value.reportType !== filters.reportType ||
        value.fingerprint !== filterFingerprint(filters) ||
        typeof value.key !== 'string' ||
        !(typeof value.date === 'string' || value.date === null)
      ) {
        throw new Error();
      }
      return value as ReportCursor;
    } catch {
      throw new ValidationError([{ field: 'cursor', reason: 'Cursor is invalid or stale.' }]);
    }
  }

  private async getTotals(filters: NormalizedReportFilters): Promise<ReportTotalsDto> {
    const rowCount = await this.estimateRows(filters, 100_000);
    if (isFuelReport(filters.reportType)) {
      const statuses =
        filters.reportType === 'FUEL_ISSUANCE' ? this.fuelStatuses(filters) : fuelSummaryStatuses;
      const totals = await this.fuelBase(filters, statuses)
        .select([
          sql<string>`coalesce(sum(fi.issued_liters), 0)`.as('issued_liters'),
          sql<string>`coalesce(sum(fi.total_amount), 0)`.as('total_amount'),
        ])
        .executeTakeFirstOrThrow();
      return {
        rowCount,
        issuedLiters: decimal(totals.issued_liters, 3),
        totalAmount: decimal(totals.total_amount, 2),
        dispatchCount: null,
        completedDistance: null,
      };
    }

    const statuses =
      filters.reportType === 'DISPATCH'
        ? this.dispatchStatuses(filters)
        : filters.reportType === 'VEHICLE_UTILIZATION'
          ? completedDispatchStatuses
          : dispatchSummaryStatuses;
    const totals = await this.dispatchBase(filters, statuses)
      .select([
        sql<string>`count(*)`.as('dispatch_count'),
        sql<string>`coalesce(sum(case when dispatch.status = 'COMPLETED'
          and dispatch.odo_after is not null then dispatch.odo_after - dispatch.odo_before else 0 end), 0)`.as(
          'completed_distance',
        ),
      ])
      .executeTakeFirstOrThrow();
    return {
      rowCount,
      issuedLiters: null,
      totalAmount: null,
      dispatchCount: integer(totals.dispatch_count),
      completedDistance: decimal(totals.completed_distance, 1),
    };
  }

  private async countFuelDetails(filters: NormalizedReportFilters, limit: number): Promise<number> {
    const rows = await this.fuelBase(filters, this.fuelStatuses(filters))
      .select('fi.id')
      .limit(limit)
      .execute();
    return rows.length;
  }

  private async countDispatchDetails(
    filters: NormalizedReportFilters,
    limit: number,
  ): Promise<number> {
    const rows = await this.dispatchBase(filters, this.dispatchStatuses(filters))
      .select('dispatch.id')
      .limit(limit)
      .execute();
    return rows.length;
  }

  private async countFuelGroups(
    filters: NormalizedReportFilters,
    group: 'office' | 'vehicle' | 'fuelType' | 'period' | 'allocation',
    limit: number,
  ): Promise<number> {
    const groupExpression =
      group === 'office'
        ? sql`office.public_id`
        : group === 'vehicle'
          ? sql`vehicle.public_id`
          : group === 'fuelType'
            ? sql`fi.fuel_type`
            : group === 'allocation'
              ? sql`allocation.public_id`
              : this.periodBucket(filters);
    const rows = await this.fuelBase(filters, fuelSummaryStatuses)
      .select(groupExpression.as('group_key'))
      .groupBy(groupExpression)
      .limit(limit)
      .execute();
    return rows.length;
  }

  private async countDispatchGroups(
    filters: NormalizedReportFilters,
    group: 'office' | 'vehicle',
    limit: number,
  ): Promise<number> {
    const statuses = group === 'vehicle' ? completedDispatchStatuses : dispatchSummaryStatuses;
    const groupExpression = group === 'office' ? sql`office.public_id` : sql`vehicle.public_id`;
    const rows = await this.dispatchBase(filters, statuses)
      .select(groupExpression.as('group_key'))
      .groupBy(groupExpression)
      .limit(limit)
      .execute();
    return rows.length;
  }

  private periodBucket(filters: NormalizedReportFilters) {
    return filters.periodType === 'ANNUAL'
      ? sql<string>`date_format(fi.entry_date, '%Y-%m-01')`
      : sql<string>`date_format(fi.entry_date, '%Y-%m-%d')`;
  }

  private async resolveOffice(publicId: string | null) {
    if (publicId === null) return null;
    const row = await this.database
      .selectFrom('offices')
      .select(['public_id', 'office_name'])
      .where('public_id', '=', publicIdToBinary(PublicId.from(publicId)))
      .executeTakeFirst();
    return row === undefined ? null : { publicId: id(row.public_id), label: row.office_name };
  }
}

function filterFingerprint(filters: NormalizedReportFilters): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        reportType: filters.reportType,
        requestingOfficePublicId: filters.requestingOfficePublicId,
        periodType: filters.periodType,
        referenceDate: filters.referenceDate,
        startDate: filters.startDate,
        endDate: filters.endDate,
        status: filters.status,
        pageSize: filters.pageSize,
      }),
    )
    .digest('base64url');
}

function rowCursor(row: ReportRow): Pick<ReportCursor, 'date' | 'key'> {
  switch (row.reportType) {
    case 'FUEL_ISSUANCE':
      return { date: row.entryDate, key: row.publicId };
    case 'DISPATCH':
      return { date: row.travelDate, key: row.publicId };
    case 'FUEL_BY_OFFICE':
    case 'DISPATCH_COUNT_BY_OFFICE':
      return { date: null, key: row.office.publicId };
    case 'FUEL_BY_VEHICLE':
    case 'VEHICLE_UTILIZATION':
      return { date: null, key: row.vehicle.publicId };
    case 'FUEL_TYPE_TOTALS':
      return { date: null, key: row.fuelType };
    case 'FUEL_AMOUNT_BY_PERIOD':
      return { date: null, key: row.periodStart };
    case 'BUDGET_ALLOCATION_ACTIVITY':
      return { date: null, key: row.budgetAllocation.publicId };
  }
}

function isFuelReport(reportType: NormalizedReportFilters['reportType']): boolean {
  return !['DISPATCH', 'DISPATCH_COUNT_BY_OFFICE', 'VEHICLE_UTILIZATION'].includes(reportType);
}

function id(value: Uint8Array): string {
  return binaryToPublicId(value).toString();
}

function decimal(value: string | number, scale: number): string {
  return DecimalValue.from(String(value)).toFixed(scale);
}

function integer(value: string | number): number {
  return Number(value);
}

function monthEnd(startDate: string): string {
  const [year, month] = startDate.split('-').map(Number);
  return new Date(Date.UTC(year!, month!, 0)).toISOString().slice(0, 10);
}

function abortError(): Error {
  const error = new Error('Report streaming was aborted.');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}
