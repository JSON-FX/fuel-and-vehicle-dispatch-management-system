import { sql, type Kysely, type Selectable } from 'kysely';

import type {
  DispatchCursorPage,
  DispatchListQuery,
  DispatchRecordPage,
  DispatchReferenceRecord,
} from '@/application/dispatch/dto/dispatch-dtos';
import type { DispatchRepository } from '@/application/dispatch/ports/dispatch-repository';
import { ConflictError } from '@/application/shared/errors/application-error';
import { VehicleDispatch } from '@/domain/dispatch/entities/vehicle-dispatch';
import { DispatchDate } from '@/domain/dispatch/value-objects/dispatch-date';
import { DispatchStatus } from '@/domain/dispatch/value-objects/dispatch-status';
import { OdometerReading } from '@/domain/dispatch/value-objects/odometer-reading';
import { PassengerCount } from '@/domain/dispatch/value-objects/passenger-count';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import type { Database, VehicleDispatchesTable } from '@/infrastructure/database/types';
import { binaryToPublicId, publicIdToBinary } from '@/infrastructure/database/uuid-binary';
import { escapeLikeLiteral } from '@/infrastructure/database/master-data/master-data-repository-utils';

import { DispatchCursorCodec } from './dispatch-cursor-codec';

type DispatchJoinedRow = Selectable<VehicleDispatchesTable> & {
  driver_public_id: Buffer;
  driver_name: string;
  vehicle_public_id: Buffer;
  vehicle_plate_number: string;
  vehicle_model_brand: string;
  vehicle_type: string;
  office_public_id: Buffer;
  office_name: string;
  office_abbreviation: string;
  created_by_public_id: Buffer;
  cancelled_by_public_id: Buffer | null;
};

export class KyselyDispatchRepository implements DispatchRepository {
  constructor(
    private readonly database: Kysely<Database>,
    private readonly cursors = new DispatchCursorCodec(),
  ) {}

  async findByPublicId(publicId: string): Promise<DispatchReferenceRecord | null> {
    const row = await this.baseQuery()
      .where('vd.public_id', '=', publicIdToBinary(PublicId.from(publicId)))
      .executeTakeFirst();
    return row === undefined ? null : this.record(row as DispatchJoinedRow);
  }

  async findByPublicIdForUpdate(publicId: string): Promise<VehicleDispatch | null> {
    const locked = await this.database
      .selectFrom('vehicle_dispatches')
      .select('id')
      .where('public_id', '=', publicIdToBinary(PublicId.from(publicId)))
      .forUpdate()
      .executeTakeFirst();
    if (locked === undefined) return null;

    const row = await this.baseQuery().where('vd.id', '=', locked.id).executeTakeFirstOrThrow();
    return this.map(row as DispatchJoinedRow);
  }

  async insert(dispatch: VehicleDispatch): Promise<void> {
    try {
      await this.database
        .insertInto('vehicle_dispatches')
        .values({
          public_id: publicIdToBinary(dispatch.publicId),
          driver_id: await this.referenceId('drivers', dispatch.driverPublicId),
          vehicle_id: await this.referenceId('vehicles', dispatch.vehiclePublicId),
          requesting_office_id: await this.referenceId(
            'offices',
            dispatch.requestingOfficePublicId,
          ),
          entry_date: dispatch.entryDate.toString(),
          travel_date: dispatch.travelDate.toString(),
          travel_start_at: null,
          travel_end_at: null,
          destination: dispatch.destination,
          purpose: dispatch.purpose,
          odo_before: dispatch.odoBefore.toString(),
          odo_after: null,
          passenger_count: dispatch.passengerCount.toNumber(),
          status: dispatch.status.toString(),
          created_by_user_id: await this.referenceId('users', dispatch.createdByActorPublicId),
          dispatched_at: null,
          completed_at: null,
          cancelled_at: null,
          cancelled_by_user_id: null,
          cancellation_reason: null,
          created_at: dispatch.createdAt,
          updated_at: dispatch.updatedAt,
        })
        .execute();
    } catch (error) {
      this.mapDuplicate(error);
    }
  }

  async updateDetails(dispatch: VehicleDispatch): Promise<void> {
    await this.database
      .updateTable('vehicle_dispatches')
      .set({
        driver_id: await this.referenceId('drivers', dispatch.driverPublicId),
        vehicle_id: await this.referenceId('vehicles', dispatch.vehiclePublicId),
        requesting_office_id: await this.referenceId('offices', dispatch.requestingOfficePublicId),
        entry_date: dispatch.entryDate.toString(),
        travel_date: dispatch.travelDate.toString(),
        destination: dispatch.destination,
        purpose: dispatch.purpose,
        odo_before: dispatch.odoBefore.toString(),
        passenger_count: dispatch.passengerCount.toNumber(),
        updated_at: dispatch.updatedAt,
      })
      .where('public_id', '=', publicIdToBinary(dispatch.publicId))
      .where('status', '=', 'DRAFT')
      .executeTakeFirst();
  }

  async updateLifecycle(dispatch: VehicleDispatch): Promise<void> {
    await this.database
      .updateTable('vehicle_dispatches')
      .set({
        status: dispatch.status.toString(),
        odo_after: dispatch.odoAfter?.toString() ?? null,
        dispatched_at: dispatch.dispatchedAt,
        completed_at: dispatch.completedAt,
        cancelled_at: dispatch.cancelledAt,
        cancelled_by_user_id:
          dispatch.cancelledByActorPublicId === null
            ? null
            : await this.referenceId('users', dispatch.cancelledByActorPublicId),
        cancellation_reason: dispatch.cancellationReason,
        updated_at: dispatch.updatedAt,
      })
      .where('public_id', '=', publicIdToBinary(dispatch.publicId))
      .executeTakeFirst();
  }

  async list(query: DispatchListQuery): Promise<DispatchRecordPage> {
    let builder = this.baseQuery();
    if (query.status !== null) builder = builder.where('vd.status', '=', query.status);
    if (query.requestingOfficePublicId !== null) {
      builder = builder.where(
        'office.public_id',
        '=',
        publicIdToBinary(PublicId.from(query.requestingOfficePublicId)),
      );
    }
    if (query.travelDateFrom !== null) {
      builder = builder.where('vd.travel_date', '>=', query.travelDateFrom);
    }
    if (query.travelDateTo !== null) {
      builder = builder.where('vd.travel_date', '<=', query.travelDateTo);
    }
    if (query.query !== null) {
      const pattern = `%${escapeLikeLiteral(query.query)}%`;
      builder = builder.where((expression) =>
        expression.or([
          sql<boolean>`vd.destination like ${pattern} escape '\\\\'`,
          sql<boolean>`vd.purpose like ${pattern} escape '\\\\'`,
          sql<boolean>`driver.full_name like ${pattern} escape '\\\\'`,
          sql<boolean>`vehicle.plate_no like ${pattern} escape '\\\\'`,
          sql<boolean>`office.office_name like ${pattern} escape '\\\\'`,
          sql<boolean>`office.abbreviation like ${pattern} escape '\\\\'`,
        ]),
      );
    }

    const cursor = query.cursor === null ? null : this.cursors.decode(query.cursor, query);
    if (cursor !== null) {
      const next = cursor.direction === 'next';
      builder = builder.where((expression) =>
        expression.or([
          expression('vd.travel_date', next ? '<' : '>', cursor.travelDate),
          expression.and([
            expression('vd.travel_date', '=', cursor.travelDate),
            expression(
              'vd.public_id',
              next ? '<' : '>',
              publicIdToBinary(PublicId.from(cursor.publicId)),
            ),
          ]),
        ]),
      );
    }

    const direction = cursor?.direction ?? 'next';
    const pageSize = Math.min(Math.max(query.pageSize, 1), 200);
    const rows = await builder
      .orderBy('vd.travel_date', direction === 'previous' ? 'asc' : 'desc')
      .orderBy('vd.public_id', direction === 'previous' ? 'asc' : 'desc')
      .limit(pageSize + 1)
      .execute();
    const hasExtra = rows.length > pageSize;
    const pageRows = rows.slice(0, pageSize) as DispatchJoinedRow[];
    if (direction === 'previous') pageRows.reverse();
    const items = pageRows.map((row) => this.record(row));
    return this.page(items, query, cursor !== null, hasExtra, direction);
  }

  private baseQuery() {
    return this.database
      .selectFrom('vehicle_dispatches as vd')
      .innerJoin('drivers as driver', 'driver.id', 'vd.driver_id')
      .innerJoin('vehicles as vehicle', 'vehicle.id', 'vd.vehicle_id')
      .innerJoin('offices as office', 'office.id', 'vd.requesting_office_id')
      .innerJoin('users as created_by', 'created_by.id', 'vd.created_by_user_id')
      .leftJoin('users as cancelled_by', 'cancelled_by.id', 'vd.cancelled_by_user_id')
      .selectAll('vd')
      .select([
        'driver.public_id as driver_public_id',
        'driver.full_name as driver_name',
        'vehicle.public_id as vehicle_public_id',
        'vehicle.plate_no as vehicle_plate_number',
        'vehicle.model_brand as vehicle_model_brand',
        'vehicle.vehicle_type as vehicle_type',
        'office.public_id as office_public_id',
        'office.office_name as office_name',
        'office.abbreviation as office_abbreviation',
        'created_by.public_id as created_by_public_id',
        'cancelled_by.public_id as cancelled_by_public_id',
      ]);
  }

  private map(row: DispatchJoinedRow): VehicleDispatch {
    return new VehicleDispatch({
      publicId: binaryToPublicId(row.public_id),
      entryDate: DispatchDate.from(row.entry_date),
      travelDate: DispatchDate.from(row.travel_date),
      driverPublicId: binaryToPublicId(row.driver_public_id),
      vehiclePublicId: binaryToPublicId(row.vehicle_public_id),
      requestingOfficePublicId: binaryToPublicId(row.office_public_id),
      destination: row.destination,
      purpose: row.purpose,
      odoBefore: OdometerReading.from(row.odo_before),
      odoAfter: row.odo_after === null ? null : OdometerReading.from(row.odo_after),
      passengerCount: PassengerCount.from(row.passenger_count),
      status: DispatchStatus.from(row.status),
      createdByActorPublicId: binaryToPublicId(row.created_by_public_id),
      dispatchedAt: row.dispatched_at,
      completedAt: row.completed_at,
      cancelledAt: row.cancelled_at,
      cancelledByActorPublicId:
        row.cancelled_by_public_id === null ? null : binaryToPublicId(row.cancelled_by_public_id),
      cancellationReason: row.cancellation_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private record(row: DispatchJoinedRow): DispatchReferenceRecord {
    return {
      dispatch: this.map(row),
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
      requestingOffice: {
        publicId: binaryToPublicId(row.office_public_id).toString(),
        name: row.office_name,
        abbreviation: row.office_abbreviation,
      },
    };
  }

  private page(
    items: readonly DispatchReferenceRecord[],
    query: DispatchListQuery,
    hadCursor: boolean,
    hasExtra: boolean,
    direction: 'next' | 'previous',
  ): DispatchCursorPage<DispatchReferenceRecord> {
    const first = items[0];
    const last = items.at(-1);
    const encode = (item: DispatchReferenceRecord, cursorDirection: 'next' | 'previous') =>
      this.cursors.encode({
        direction: cursorDirection,
        travelDate: item.dispatch.travelDate.toString(),
        publicId: item.dispatch.publicId.toString(),
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
    table: 'drivers' | 'vehicles' | 'offices' | 'users',
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
    const candidate = error as { code?: unknown };
    if (candidate.code !== 'ER_DUP_ENTRY') throw error;
    throw new ConflictError('A vehicle dispatch with this public identifier already exists.');
  }
}
