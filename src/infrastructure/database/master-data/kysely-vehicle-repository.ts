import { sql, type Kysely, type Selectable } from 'kysely';

import type {
  VehicleListQuery,
  VehicleOperationalPage,
  VehiclePage,
} from '@/application/vehicle/dto/vehicle-dtos';
import type { VehicleRepository } from '@/application/vehicle/ports/vehicle-repository';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import { Vehicle } from '@/domain/vehicle/entities/vehicle';
import { ModelBrand } from '@/domain/vehicle/value-objects/model-brand';
import { PlateNumber } from '@/domain/vehicle/value-objects/plate-number';
import { VehicleRemarks } from '@/domain/vehicle/value-objects/vehicle-remarks';
import { VehicleStatus } from '@/domain/vehicle/value-objects/vehicle-status';
import { VehicleType } from '@/domain/vehicle/value-objects/vehicle-type';
import type { Database, VehiclesTable } from '@/infrastructure/database/types';
import { binaryToPublicId, publicIdToBinary } from '@/infrastructure/database/uuid-binary';

import { MasterDataCursorCodec } from './master-data-cursor-codec';
import {
  escapeLikeLiteral,
  keysetOperator,
  mapDuplicateConstraint,
  normalizeKeysetPage,
} from './master-data-repository-utils';

type VehicleRow = Selectable<VehiclesTable> & { deleted_by_public_id: Buffer | null };

export class KyselyVehicleRepository implements VehicleRepository {
  constructor(
    private readonly database: Kysely<Database>,
    private readonly cursors = new MasterDataCursorCodec(),
  ) {}

  findCurrentByPublicId(publicId: string): Promise<Vehicle | null> {
    return this.find(publicId, 'current', false);
  }

  findIncludingDeletedByPublicId(publicId: string): Promise<Vehicle | null> {
    return this.find(publicId, 'all', false);
  }

  findCurrentByPublicIdForUpdate(publicId: string): Promise<Vehicle | null> {
    return this.find(publicId, 'current', true);
  }

  findDeletedByPublicIdForUpdate(publicId: string): Promise<Vehicle | null> {
    return this.find(publicId, 'deleted', true);
  }

  async insert(vehicle: Vehicle): Promise<void> {
    try {
      await this.database
        .insertInto('vehicles')
        .values({
          public_id: publicIdToBinary(vehicle.publicId),
          model_brand: vehicle.modelBrand.toString(),
          vehicle_type: vehicle.vehicleType.toString(),
          plate_no: vehicle.plateNumber.toString(),
          status: vehicle.status.toString(),
          remarks: vehicle.remarks?.toString() ?? null,
          deleted_at: null,
          deleted_by_user_id: null,
          delete_reason: null,
          created_at: vehicle.createdAt,
          updated_at: vehicle.updatedAt,
        })
        .execute();
    } catch (error) {
      mapDuplicateConstraint(error);
    }
  }

  async updateDetails(vehicle: Vehicle): Promise<void> {
    try {
      await this.database
        .updateTable('vehicles')
        .set({
          model_brand: vehicle.modelBrand.toString(),
          vehicle_type: vehicle.vehicleType.toString(),
          plate_no: vehicle.plateNumber.toString(),
          remarks: vehicle.remarks?.toString() ?? null,
          updated_at: vehicle.updatedAt,
        })
        .where('public_id', '=', publicIdToBinary(vehicle.publicId))
        .where('deleted_at', 'is', null)
        .executeTakeFirst();
    } catch (error) {
      mapDuplicateConstraint(error);
    }
  }

  async updateStatus(vehicle: Vehicle): Promise<void> {
    await this.database
      .updateTable('vehicles')
      .set({ status: vehicle.status.toString(), updated_at: vehicle.updatedAt })
      .where('public_id', '=', publicIdToBinary(vehicle.publicId))
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  }

  async softDelete(vehicle: Vehicle): Promise<void> {
    await this.database
      .updateTable('vehicles')
      .set({
        deleted_at: vehicle.deletedAt,
        deleted_by_user_id: await this.actorId(vehicle.deletedByActorPublicId),
        delete_reason: vehicle.deleteReason,
        updated_at: vehicle.updatedAt,
      })
      .where('public_id', '=', publicIdToBinary(vehicle.publicId))
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  }

  async restore(vehicle: Vehicle): Promise<void> {
    await this.database
      .updateTable('vehicles')
      .set({
        status: vehicle.status.toString(),
        deleted_at: null,
        deleted_by_user_id: null,
        delete_reason: null,
        updated_at: vehicle.updatedAt,
      })
      .where('public_id', '=', publicIdToBinary(vehicle.publicId))
      .where('deleted_at', 'is not', null)
      .executeTakeFirst();
  }

  async listAdmin(query: VehicleListQuery): Promise<VehiclePage> {
    let builder = this.database
      .selectFrom('vehicles')
      .leftJoin('users as deleted_by', 'deleted_by.id', 'vehicles.deleted_by_user_id')
      .selectAll('vehicles')
      .select('deleted_by.public_id as deleted_by_public_id');
    if (query.lifecycle === 'current') builder = builder.where('vehicles.deleted_at', 'is', null);
    if (query.lifecycle === 'deleted')
      builder = builder.where('vehicles.deleted_at', 'is not', null);
    if (query.status !== null) {
      builder = builder.where('vehicles.status', '=', VehicleStatus.from(query.status).toString());
    }
    if (query.query !== null) {
      const pattern = `%${escapeLikeLiteral(query.query)}%`;
      builder = builder.where((expression) =>
        expression.or([
          sql<boolean>`vehicles.plate_no like ${pattern} escape '\\'`,
          sql<boolean>`vehicles.model_brand like ${pattern} escape '\\'`,
          sql<boolean>`vehicles.vehicle_type like ${pattern} escape '\\'`,
        ]),
      );
    }
    const cursor =
      query.cursor === null ? null : this.cursors.decode(query.cursor, 'vehicle', query);
    if (cursor !== null) {
      const operator = keysetOperator(cursor.direction);
      builder = builder.where((expression) =>
        expression.or([
          expression('vehicles.plate_no', operator, cursor.sortValue),
          expression.and([
            expression('vehicles.plate_no', '=', cursor.sortValue),
            expression(
              'vehicles.public_id',
              operator,
              publicIdToBinary(PublicId.from(cursor.publicId)),
            ),
          ]),
        ]),
      );
    }
    const direction = cursor?.direction ?? 'next';
    const rows = await builder
      .orderBy('vehicles.plate_no', direction === 'previous' ? 'desc' : 'asc')
      .orderBy('vehicles.public_id', direction === 'previous' ? 'desc' : 'asc')
      .limit(query.pageSize + 1)
      .execute();
    const hasExtra = rows.length > query.pageSize;
    const pageRows = normalizeKeysetPage(rows.slice(0, query.pageSize), direction);
    return this.vehiclePage(pageRows, query, cursor !== null, hasExtra, direction);
  }

  async listOperational(query: VehicleListQuery): Promise<VehicleOperationalPage> {
    const page = await this.listAdmin({
      ...query,
      mode: 'operational',
      lifecycle: 'current',
      status: 'SERVICEABLE',
    });
    return {
      items: page.items.map((vehicle) => ({
        publicId: vehicle.publicId,
        label: `${vehicle.plateNumber} · ${vehicle.modelBrand}`,
        plateNumber: vehicle.plateNumber,
      })),
      nextCursor: page.nextCursor,
      previousCursor: page.previousCursor,
    };
  }

  private async find(
    publicId: string,
    lifecycle: 'current' | 'deleted' | 'all',
    lock: boolean,
  ): Promise<Vehicle | null> {
    let query = this.database
      .selectFrom('vehicles')
      .leftJoin('users as deleted_by', 'deleted_by.id', 'vehicles.deleted_by_user_id')
      .selectAll('vehicles')
      .select('deleted_by.public_id as deleted_by_public_id')
      .where('vehicles.public_id', '=', publicIdToBinary(PublicId.from(publicId)));
    if (lifecycle === 'current') query = query.where('vehicles.deleted_at', 'is', null);
    if (lifecycle === 'deleted') query = query.where('vehicles.deleted_at', 'is not', null);
    const row = await (lock ? query.forUpdate() : query).executeTakeFirst();
    return row === undefined ? null : this.map(row);
  }

  private map(row: VehicleRow): Vehicle {
    return new Vehicle({
      publicId: binaryToPublicId(row.public_id),
      modelBrand: ModelBrand.from(row.model_brand),
      vehicleType: VehicleType.from(row.vehicle_type),
      plateNumber: PlateNumber.from(row.plate_no),
      status: VehicleStatus.from(row.status),
      remarks: VehicleRemarks.optional(row.remarks),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
      deletedByActorPublicId:
        row.deleted_by_public_id === null ? null : binaryToPublicId(row.deleted_by_public_id),
      deleteReason: row.delete_reason,
    });
  }

  private vehiclePage(
    rows: readonly VehicleRow[],
    query: VehicleListQuery,
    hadCursor: boolean,
    hasExtra: boolean,
    direction: 'next' | 'previous',
  ): VehiclePage {
    const items = rows
      .map((row) => this.map(row))
      .map((vehicle) => ({
        publicId: vehicle.publicId.toString(),
        modelBrand: vehicle.modelBrand.toString(),
        vehicleType: vehicle.vehicleType.toString(),
        plateNumber: vehicle.plateNumber.toString(),
        status: vehicle.status.toString(),
        remarks: vehicle.remarks?.toString() ?? null,
        operational: vehicle.isOperational(),
        createdAt: vehicle.createdAt.toISOString(),
        updatedAt: vehicle.updatedAt.toISOString(),
        deletedAt: vehicle.deletedAt?.toISOString() ?? null,
        deletedByActorPublicId: vehicle.deletedByActorPublicId?.toString() ?? null,
        deleteReason: vehicle.deleteReason,
      }));
    const first = items[0];
    const last = items.at(-1);
    return {
      items,
      previousCursor:
        first !== undefined && (hadCursor || (direction === 'previous' && hasExtra))
          ? this.cursors.encode({
              resource: 'vehicle',
              direction: 'previous',
              sortValue: first.plateNumber,
              publicId: first.publicId,
              query,
            })
          : null,
      nextCursor:
        last !== undefined && (hasExtra || direction === 'previous')
          ? this.cursors.encode({
              resource: 'vehicle',
              direction: 'next',
              sortValue: last.plateNumber,
              publicId: last.publicId,
              query,
            })
          : null,
    };
  }

  private async actorId(publicId: PublicId | null): Promise<string> {
    if (publicId === null) throw new Error('Soft deletion requires an actor.');
    const actor = await this.database
      .selectFrom('users')
      .select('id')
      .where('public_id', '=', publicIdToBinary(publicId))
      .executeTakeFirstOrThrow();
    return actor.id;
  }
}
