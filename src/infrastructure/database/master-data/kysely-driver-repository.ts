import { sql, type Kysely, type Selectable } from 'kysely';

import type {
  DriverListQuery,
  DriverOperationalPage,
  DriverPage,
} from '@/application/driver/dto/driver-dtos';
import type { DriverRepository } from '@/application/driver/ports/driver-repository';
import { Driver } from '@/domain/driver/entities/driver';
import { DriverContactNumber } from '@/domain/driver/value-objects/driver-contact-number';
import { DriverName } from '@/domain/driver/value-objects/driver-name';
import { DriverStatus } from '@/domain/driver/value-objects/driver-status';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import type { Database, DriversTable } from '@/infrastructure/database/types';
import { binaryToPublicId, publicIdToBinary } from '@/infrastructure/database/uuid-binary';

import { MasterDataCursorCodec } from './master-data-cursor-codec';
import {
  escapeLikeLiteral,
  keysetOperator,
  normalizeKeysetPage,
} from './master-data-repository-utils';

type DriverRow = Selectable<DriversTable> & { deleted_by_public_id: Buffer | null };

export class KyselyDriverRepository implements DriverRepository {
  constructor(
    private readonly database: Kysely<Database>,
    private readonly cursors = new MasterDataCursorCodec(),
  ) {}

  findCurrentByPublicId(publicId: string): Promise<Driver | null> {
    return this.find(publicId, 'current', false);
  }

  findIncludingDeletedByPublicId(publicId: string): Promise<Driver | null> {
    return this.find(publicId, 'all', false);
  }

  findCurrentByPublicIdForUpdate(publicId: string): Promise<Driver | null> {
    return this.find(publicId, 'current', true);
  }

  findDeletedByPublicIdForUpdate(publicId: string): Promise<Driver | null> {
    return this.find(publicId, 'deleted', true);
  }

  async insert(driver: Driver): Promise<void> {
    await this.database
      .insertInto('drivers')
      .values({
        public_id: publicIdToBinary(driver.publicId),
        full_name: driver.name.toString(),
        contact_no: driver.contactNumber?.toString() ?? null,
        status: driver.status.toString(),
        deleted_at: null,
        deleted_by_user_id: null,
        delete_reason: null,
        created_at: driver.createdAt,
        updated_at: driver.updatedAt,
      })
      .execute();
  }

  async updateDetails(driver: Driver): Promise<void> {
    await this.database
      .updateTable('drivers')
      .set({
        full_name: driver.name.toString(),
        contact_no: driver.contactNumber?.toString() ?? null,
        updated_at: driver.updatedAt,
      })
      .where('public_id', '=', publicIdToBinary(driver.publicId))
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  }

  async updateStatus(driver: Driver): Promise<void> {
    await this.database
      .updateTable('drivers')
      .set({ status: driver.status.toString(), updated_at: driver.updatedAt })
      .where('public_id', '=', publicIdToBinary(driver.publicId))
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  }

  async softDelete(driver: Driver): Promise<void> {
    await this.database
      .updateTable('drivers')
      .set({
        deleted_at: driver.deletedAt,
        deleted_by_user_id: await this.actorId(driver.deletedByActorPublicId),
        delete_reason: driver.deleteReason,
        updated_at: driver.updatedAt,
      })
      .where('public_id', '=', publicIdToBinary(driver.publicId))
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  }

  async restore(driver: Driver): Promise<void> {
    await this.database
      .updateTable('drivers')
      .set({
        status: driver.status.toString(),
        deleted_at: null,
        deleted_by_user_id: null,
        delete_reason: null,
        updated_at: driver.updatedAt,
      })
      .where('public_id', '=', publicIdToBinary(driver.publicId))
      .where('deleted_at', 'is not', null)
      .executeTakeFirst();
  }

  async listAdmin(query: DriverListQuery): Promise<DriverPage> {
    let builder = this.database
      .selectFrom('drivers')
      .leftJoin('users as deleted_by', 'deleted_by.id', 'drivers.deleted_by_user_id')
      .selectAll('drivers')
      .select('deleted_by.public_id as deleted_by_public_id');
    if (query.lifecycle === 'current') builder = builder.where('drivers.deleted_at', 'is', null);
    if (query.lifecycle === 'deleted')
      builder = builder.where('drivers.deleted_at', 'is not', null);
    if (query.status !== null) {
      builder = builder.where('drivers.status', '=', DriverStatus.from(query.status).toString());
    }
    if (query.query !== null) {
      const pattern = `%${escapeLikeLiteral(query.query)}%`;
      builder = builder.where(sql<boolean>`drivers.full_name like ${pattern} escape '\\'`);
    }
    const cursor =
      query.cursor === null ? null : this.cursors.decode(query.cursor, 'driver', query);
    if (cursor !== null) {
      const operator = keysetOperator(cursor.direction);
      builder = builder.where((expression) =>
        expression.or([
          expression('drivers.full_name', operator, cursor.sortValue),
          expression.and([
            expression('drivers.full_name', '=', cursor.sortValue),
            expression(
              'drivers.public_id',
              operator,
              publicIdToBinary(PublicId.from(cursor.publicId)),
            ),
          ]),
        ]),
      );
    }
    const direction = cursor?.direction ?? 'next';
    const rows = await builder
      .orderBy('drivers.full_name', direction === 'previous' ? 'desc' : 'asc')
      .orderBy('drivers.public_id', direction === 'previous' ? 'desc' : 'asc')
      .limit(query.pageSize + 1)
      .execute();
    const hasExtra = rows.length > query.pageSize;
    const pageRows = normalizeKeysetPage(rows.slice(0, query.pageSize), direction);
    return this.driverPage(pageRows, query, cursor !== null, hasExtra, direction);
  }

  async listOperational(query: DriverListQuery): Promise<DriverOperationalPage> {
    const page = await this.listAdmin({
      ...query,
      mode: 'operational',
      lifecycle: 'current',
      status: 'ACTIVE',
    });
    return {
      items: page.items.map((driver) => ({ publicId: driver.publicId, name: driver.name })),
      nextCursor: page.nextCursor,
      previousCursor: page.previousCursor,
    };
  }

  private async find(
    publicId: string,
    lifecycle: 'current' | 'deleted' | 'all',
    lock: boolean,
  ): Promise<Driver | null> {
    let query = this.database
      .selectFrom('drivers')
      .leftJoin('users as deleted_by', 'deleted_by.id', 'drivers.deleted_by_user_id')
      .selectAll('drivers')
      .select('deleted_by.public_id as deleted_by_public_id')
      .where('drivers.public_id', '=', publicIdToBinary(PublicId.from(publicId)));
    if (lifecycle === 'current') query = query.where('drivers.deleted_at', 'is', null);
    if (lifecycle === 'deleted') query = query.where('drivers.deleted_at', 'is not', null);
    const row = await (lock ? query.forUpdate() : query).executeTakeFirst();
    return row === undefined ? null : this.map(row);
  }

  private map(row: DriverRow): Driver {
    return new Driver({
      publicId: binaryToPublicId(row.public_id),
      name: DriverName.from(row.full_name),
      contactNumber: DriverContactNumber.optional(row.contact_no),
      status: DriverStatus.from(row.status),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
      deletedByActorPublicId:
        row.deleted_by_public_id === null ? null : binaryToPublicId(row.deleted_by_public_id),
      deleteReason: row.delete_reason,
    });
  }

  private driverPage(
    rows: readonly DriverRow[],
    query: DriverListQuery,
    hadCursor: boolean,
    hasExtra: boolean,
    direction: 'next' | 'previous',
  ): DriverPage {
    const items = rows
      .map((row) => this.map(row))
      .map((driver) => ({
        publicId: driver.publicId.toString(),
        name: driver.name.toString(),
        contactNumber: driver.contactNumber?.toString() ?? null,
        status: driver.status.toString(),
        operational: driver.isOperational(),
        createdAt: driver.createdAt.toISOString(),
        updatedAt: driver.updatedAt.toISOString(),
        deletedAt: driver.deletedAt?.toISOString() ?? null,
        deletedByActorPublicId: driver.deletedByActorPublicId?.toString() ?? null,
        deleteReason: driver.deleteReason,
      }));
    const first = items[0];
    const last = items.at(-1);
    return {
      items,
      previousCursor:
        first !== undefined && (hadCursor || (direction === 'previous' && hasExtra))
          ? this.cursors.encode({
              resource: 'driver',
              direction: 'previous',
              sortValue: first.name,
              publicId: first.publicId,
              query,
            })
          : null,
      nextCursor:
        last !== undefined && (hasExtra || direction === 'previous')
          ? this.cursors.encode({
              resource: 'driver',
              direction: 'next',
              sortValue: last.name,
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
