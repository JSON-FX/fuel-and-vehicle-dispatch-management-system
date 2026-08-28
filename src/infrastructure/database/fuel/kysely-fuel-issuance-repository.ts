import { sql, type Kysely, type Selectable } from 'kysely';

import type {
  FuelCursorPage,
  FuelIssuanceDetailRecord,
  FuelIssuanceListQuery,
  FuelIssuanceRecordPage,
  FuelIssuanceReferenceRecord,
} from '@/application/fuel/dto/fuel-dtos';
import type { FuelIssuanceRepository } from '@/application/fuel/ports/fuel-issuance-repository';
import { ConflictError } from '@/application/shared/errors/application-error';
import { FuelIssuance } from '@/domain/fuel/entities/fuel-issuance';
import { EntryDate } from '@/domain/fuel/value-objects/entry-date';
import { FuelIssuanceStatus } from '@/domain/fuel/value-objects/fuel-issuance-status';
import { FuelQuantity } from '@/domain/fuel/value-objects/fuel-quantity';
import { FuelTotal } from '@/domain/fuel/value-objects/fuel-total';
import { FuelType } from '@/domain/fuel/value-objects/fuel-type';
import { PurchaseRequestNumber } from '@/domain/fuel/value-objects/purchase-request-number';
import { RisNumber } from '@/domain/fuel/value-objects/ris-number';
import { UnitPrice } from '@/domain/fuel/value-objects/unit-price';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import type { Database, FuelIssuancesTable } from '@/infrastructure/database/types';
import { binaryToPublicId, publicIdToBinary } from '@/infrastructure/database/uuid-binary';
import { escapeLikeLiteral } from '@/infrastructure/database/master-data/master-data-repository-utils';

import { FuelIssuanceCursorCodec } from './fuel-issuance-cursor-codec';
import { KyselyFuelLedgerRepository } from './kysely-fuel-ledger-repository';

type FuelIssuanceJoinedRow = Selectable<FuelIssuancesTable> & {
  driver_public_id: Buffer;
  driver_name: string;
  vehicle_public_id: Buffer;
  vehicle_plate_number: string;
  vehicle_model_brand: string;
  vehicle_type: string;
  allocation_public_id: Buffer;
  allocation_ppmp_number: string;
  allocation_quarter: number;
  allocation_fiscal_year: number;
  office_public_id: Buffer;
  office_name: string;
  office_abbreviation: string;
  created_by_public_id: Buffer;
  voided_by_public_id: Buffer | null;
};

export class KyselyFuelIssuanceRepository implements FuelIssuanceRepository {
  constructor(
    private readonly database: Kysely<Database>,
    private readonly cursors = new FuelIssuanceCursorCodec(),
    private readonly ledger = new KyselyFuelLedgerRepository(database),
  ) {}

  async findByPublicId(publicId: string): Promise<FuelIssuanceReferenceRecord | null> {
    const row = await this.baseQuery()
      .where('fi.public_id', '=', publicIdToBinary(PublicId.from(publicId)))
      .executeTakeFirst();
    return row === undefined ? null : this.record(row as FuelIssuanceJoinedRow);
  }

  async findDetailByPublicId(publicId: string): Promise<FuelIssuanceDetailRecord | null> {
    const record = await this.findByPublicId(publicId);
    if (record === null) return null;
    return { ...record, ledgerEntries: await this.ledger.listForIssuance(publicId) };
  }

  async findByPublicIdForUpdate(publicId: string): Promise<FuelIssuance | null> {
    const publicIdBinary = publicIdToBinary(PublicId.from(publicId));
    const locked = await this.database
      .selectFrom('fuel_issuances')
      .select('id')
      .where('public_id', '=', publicIdBinary)
      .forUpdate()
      .executeTakeFirst();
    if (locked === undefined) return null;
    const row = await this.baseQuery().where('fi.id', '=', locked.id).executeTakeFirstOrThrow();
    return this.map(row as FuelIssuanceJoinedRow);
  }

  async insert(issuance: FuelIssuance): Promise<void> {
    try {
      await this.database
        .insertInto('fuel_issuances')
        .values({
          public_id: publicIdToBinary(issuance.publicId),
          ris_number: null,
          purchase_request_number: issuance.purchaseRequestNumber.toString(),
          entry_date: issuance.entryDate.toString(),
          driver_id: await this.referenceId('drivers', issuance.driverPublicId),
          destination: issuance.destination,
          purpose: issuance.purpose,
          vehicle_id: await this.referenceId('vehicles', issuance.vehiclePublicId),
          requested_liters: issuance.requestedLiters?.toString() ?? null,
          is_full_tank: issuance.isFullTank,
          issued_liters: issuance.issuedLiters?.toString() ?? null,
          unit_price: issuance.unitPrice.toString(),
          total_amount: null,
          budget_allocation_id: await this.referenceId(
            'budget_allocations',
            issuance.budgetAllocationPublicId,
          ),
          fuel_type: issuance.fuelType.toString(),
          status: issuance.status.toString(),
          created_by_user_id: await this.referenceId('users', issuance.createdByActorPublicId),
          posted_at: null,
          voided_at: null,
          voided_by_user_id: null,
          void_reason: null,
          created_at: issuance.createdAt,
          updated_at: issuance.updatedAt,
        })
        .execute();
    } catch (error) {
      this.mapDuplicate(error);
    }
  }

  async updateDraft(issuance: FuelIssuance): Promise<void> {
    await this.database
      .updateTable('fuel_issuances')
      .set({
        purchase_request_number: issuance.purchaseRequestNumber.toString(),
        entry_date: issuance.entryDate.toString(),
        driver_id: await this.referenceId('drivers', issuance.driverPublicId),
        destination: issuance.destination,
        purpose: issuance.purpose,
        vehicle_id: await this.referenceId('vehicles', issuance.vehiclePublicId),
        requested_liters: issuance.requestedLiters?.toString() ?? null,
        is_full_tank: issuance.isFullTank,
        issued_liters: issuance.issuedLiters?.toString() ?? null,
        unit_price: issuance.unitPrice.toString(),
        budget_allocation_id: await this.referenceId(
          'budget_allocations',
          issuance.budgetAllocationPublicId,
        ),
        fuel_type: issuance.fuelType.toString(),
        updated_at: issuance.updatedAt,
      })
      .where('public_id', '=', publicIdToBinary(issuance.publicId))
      .where('status', '=', 'DRAFT')
      .executeTakeFirst();
  }

  async markPosted(issuance: FuelIssuance): Promise<void> {
    await this.database
      .updateTable('fuel_issuances')
      .set({
        ris_number: issuance.risNumber!.toString(),
        issued_liters: issuance.issuedLiters!.toString(),
        total_amount: issuance.totalAmount!.toString(),
        status: issuance.status.toString(),
        posted_at: issuance.postedAt,
        updated_at: issuance.updatedAt,
      })
      .where('public_id', '=', publicIdToBinary(issuance.publicId))
      .where('status', '=', 'DRAFT')
      .executeTakeFirst();
  }

  async markVoided(issuance: FuelIssuance): Promise<void> {
    await this.database
      .updateTable('fuel_issuances')
      .set({
        status: issuance.status.toString(),
        voided_at: issuance.voidedAt,
        voided_by_user_id: await this.referenceId('users', issuance.voidedByActorPublicId!),
        void_reason: issuance.voidReason,
        updated_at: issuance.updatedAt,
      })
      .where('public_id', '=', publicIdToBinary(issuance.publicId))
      .where('status', '=', 'POSTED')
      .executeTakeFirst();
  }

  async list(query: FuelIssuanceListQuery): Promise<FuelIssuanceRecordPage> {
    let builder = this.baseQuery();
    if (query.status !== null) builder = builder.where('fi.status', '=', query.status);
    if (query.fuelType !== null) builder = builder.where('fi.fuel_type', '=', query.fuelType);
    if (query.startDate !== null) builder = builder.where('fi.entry_date', '>=', query.startDate);
    if (query.endDate !== null) builder = builder.where('fi.entry_date', '<=', query.endDate);
    if (query.query !== null) {
      const pattern = `%${escapeLikeLiteral(query.query)}%`;
      builder = builder.where((expression) =>
        expression.or([
          sql<boolean>`fi.ris_number like ${pattern} escape '\\'`,
          sql<boolean>`fi.purchase_request_number like ${pattern} escape '\\'`,
          sql<boolean>`driver.full_name like ${pattern} escape '\\'`,
          sql<boolean>`vehicle.plate_no like ${pattern} escape '\\'`,
        ]),
      );
    }
    const cursor = query.cursor === null ? null : this.cursors.decode(query.cursor, query);
    if (cursor !== null) {
      const next = cursor.direction === 'next';
      builder = builder.where((expression) =>
        expression.or([
          expression('fi.entry_date', next ? '<' : '>', cursor.entryDate),
          expression.and([
            expression('fi.entry_date', '=', cursor.entryDate),
            expression(
              'fi.public_id',
              next ? '<' : '>',
              publicIdToBinary(PublicId.from(cursor.publicId)),
            ),
          ]),
        ]),
      );
    }
    const direction = cursor?.direction ?? 'next';
    const rows = await builder
      .orderBy('fi.entry_date', direction === 'previous' ? 'asc' : 'desc')
      .orderBy('fi.public_id', direction === 'previous' ? 'asc' : 'desc')
      .limit(query.pageSize + 1)
      .execute();
    const hasExtra = rows.length > query.pageSize;
    const pageRows = rows.slice(0, query.pageSize) as FuelIssuanceJoinedRow[];
    if (direction === 'previous') pageRows.reverse();
    const items = pageRows.map((row) => this.record(row));
    return this.page(items, query, cursor !== null, hasExtra, direction);
  }

  private baseQuery() {
    return this.database
      .selectFrom('fuel_issuances as fi')
      .innerJoin('drivers as driver', 'driver.id', 'fi.driver_id')
      .innerJoin('vehicles as vehicle', 'vehicle.id', 'fi.vehicle_id')
      .innerJoin('budget_allocations as allocation', 'allocation.id', 'fi.budget_allocation_id')
      .innerJoin('offices as office', 'office.id', 'allocation.office_id')
      .innerJoin('users as created_by', 'created_by.id', 'fi.created_by_user_id')
      .leftJoin('users as voided_by', 'voided_by.id', 'fi.voided_by_user_id')
      .selectAll('fi')
      .select([
        'driver.public_id as driver_public_id',
        'driver.full_name as driver_name',
        'vehicle.public_id as vehicle_public_id',
        'vehicle.plate_no as vehicle_plate_number',
        'vehicle.model_brand as vehicle_model_brand',
        'vehicle.vehicle_type as vehicle_type',
        'allocation.public_id as allocation_public_id',
        'allocation.ppmp_number as allocation_ppmp_number',
        'allocation.quarter as allocation_quarter',
        'allocation.fiscal_year as allocation_fiscal_year',
        'office.public_id as office_public_id',
        'office.office_name as office_name',
        'office.abbreviation as office_abbreviation',
        'created_by.public_id as created_by_public_id',
        'voided_by.public_id as voided_by_public_id',
      ]);
  }

  private map(row: FuelIssuanceJoinedRow): FuelIssuance {
    return new FuelIssuance({
      publicId: binaryToPublicId(row.public_id),
      risNumber: row.ris_number === null ? null : RisNumber.from(row.ris_number),
      purchaseRequestNumber: PurchaseRequestNumber.from(row.purchase_request_number),
      entryDate: EntryDate.from(row.entry_date),
      driverPublicId: binaryToPublicId(row.driver_public_id),
      destination: row.destination,
      purpose: row.purpose,
      vehiclePublicId: binaryToPublicId(row.vehicle_public_id),
      requestedLiters:
        row.requested_liters === null ? null : FuelQuantity.from(row.requested_liters),
      isFullTank: Boolean(row.is_full_tank),
      issuedLiters: row.issued_liters === null ? null : FuelQuantity.from(row.issued_liters),
      unitPrice: UnitPrice.from(row.unit_price),
      totalAmount: row.total_amount === null ? null : FuelTotal.from(row.total_amount),
      budgetAllocationPublicId: binaryToPublicId(row.allocation_public_id),
      fuelType: FuelType.from(row.fuel_type),
      status: FuelIssuanceStatus.from(row.status),
      createdByActorPublicId: binaryToPublicId(row.created_by_public_id),
      postedAt: row.posted_at,
      voidedAt: row.voided_at,
      voidedByActorPublicId:
        row.voided_by_public_id === null ? null : binaryToPublicId(row.voided_by_public_id),
      voidReason: row.void_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private record(row: FuelIssuanceJoinedRow): FuelIssuanceReferenceRecord {
    return {
      issuance: this.map(row),
      driver: {
        publicId: binaryToPublicId(row.driver_public_id).toString(),
        name: row.driver_name,
      },
      vehicle: {
        publicId: binaryToPublicId(row.vehicle_public_id).toString(),
        plateNumber: row.vehicle_plate_number,
        modelBrand: row.vehicle_model_brand,
        vehicleType: row.vehicle_type,
      },
      allocation: {
        publicId: binaryToPublicId(row.allocation_public_id).toString(),
        ppmpNumber: row.allocation_ppmp_number,
        office: {
          publicId: binaryToPublicId(row.office_public_id).toString(),
          name: row.office_name,
          abbreviation: row.office_abbreviation,
        },
        quarter: row.allocation_quarter,
        fiscalYear: row.allocation_fiscal_year,
      },
    };
  }

  private page(
    items: readonly FuelIssuanceReferenceRecord[],
    query: FuelIssuanceListQuery,
    hadCursor: boolean,
    hasExtra: boolean,
    direction: 'next' | 'previous',
  ): FuelCursorPage<FuelIssuanceReferenceRecord> {
    const first = items[0];
    const last = items.at(-1);
    const encode = (item: FuelIssuanceReferenceRecord, cursorDirection: 'next' | 'previous') =>
      this.cursors.encode({
        direction: cursorDirection,
        entryDate: item.issuance.entryDate.toString(),
        publicId: item.issuance.publicId.toString(),
        query,
      });
    return {
      items,
      previousCursor:
        first !== undefined && (hadCursor || (direction === 'previous' && hasExtra))
          ? encode(first, 'previous')
          : null,
      nextCursor:
        last !== undefined && (hasExtra || direction === 'previous') ? encode(last, 'next') : null,
    };
  }

  private async referenceId(
    table: 'drivers' | 'vehicles' | 'budget_allocations' | 'users',
    publicId: PublicId,
  ): Promise<string> {
    const row = await this.database
      .selectFrom(table)
      .select('id')
      .where('public_id', '=', publicIdToBinary(publicId))
      .executeTakeFirstOrThrow();
    return row.id;
  }

  private mapDuplicate(error: unknown): never {
    const candidate = error as { code?: unknown; message?: unknown; sqlMessage?: unknown };
    if (candidate.code !== 'ER_DUP_ENTRY') throw error;
    const message = `${String(candidate.message ?? '')} ${String(candidate.sqlMessage ?? '')}`;
    if (message.includes('uq_fuel_issuances_ris_number')) {
      throw new ConflictError('The RIS number has already been assigned.');
    }
    throw new ConflictError('A unique fuel issuance value already exists.');
  }
}
