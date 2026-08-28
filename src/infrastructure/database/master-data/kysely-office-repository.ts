import { sql, type Kysely, type Selectable } from 'kysely';

import type {
  OfficeListQuery,
  OfficeOperationalPage,
  OfficePage,
} from '@/application/office/dto/office-dtos';
import type { OfficeRepository } from '@/application/office/ports/office-repository';
import { Office } from '@/domain/office/entities/office';
import { OfficeAbbreviation } from '@/domain/office/value-objects/office-abbreviation';
import { OfficeName } from '@/domain/office/value-objects/office-name';
import { OfficeStatus } from '@/domain/office/value-objects/office-status';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import type { Database, OfficesTable } from '@/infrastructure/database/types';
import { binaryToPublicId, publicIdToBinary } from '@/infrastructure/database/uuid-binary';

import { MasterDataCursorCodec } from './master-data-cursor-codec';
import {
  escapeLikeLiteral,
  keysetOperator,
  mapDuplicateConstraint,
  normalizeKeysetPage,
} from './master-data-repository-utils';

type OfficeRow = Selectable<OfficesTable> & { deleted_by_public_id: Buffer | null };

export class KyselyOfficeRepository implements OfficeRepository {
  constructor(
    private readonly database: Kysely<Database>,
    private readonly cursors = new MasterDataCursorCodec(),
  ) {}

  findCurrentByPublicId(publicId: string): Promise<Office | null> {
    return this.find(publicId, 'current', false);
  }

  findIncludingDeletedByPublicId(publicId: string): Promise<Office | null> {
    return this.find(publicId, 'all', false);
  }

  findCurrentByPublicIdForUpdate(publicId: string): Promise<Office | null> {
    return this.find(publicId, 'current', true);
  }

  findDeletedByPublicIdForUpdate(publicId: string): Promise<Office | null> {
    return this.find(publicId, 'deleted', true);
  }

  async insert(office: Office): Promise<void> {
    try {
      await this.database
        .insertInto('offices')
        .values({
          public_id: publicIdToBinary(office.publicId),
          office_name: office.name.toString(),
          abbreviation: office.abbreviation.toString(),
          status: office.status.toString(),
          deleted_at: null,
          deleted_by_user_id: null,
          delete_reason: null,
          created_at: office.createdAt,
          updated_at: office.updatedAt,
        })
        .execute();
    } catch (error) {
      mapDuplicateConstraint(error);
    }
  }

  async updateDetails(office: Office): Promise<void> {
    try {
      await this.database
        .updateTable('offices')
        .set({
          office_name: office.name.toString(),
          abbreviation: office.abbreviation.toString(),
          updated_at: office.updatedAt,
        })
        .where('public_id', '=', publicIdToBinary(office.publicId))
        .where('deleted_at', 'is', null)
        .executeTakeFirst();
    } catch (error) {
      mapDuplicateConstraint(error);
    }
  }

  async updateStatus(office: Office): Promise<void> {
    await this.database
      .updateTable('offices')
      .set({ status: office.status.toString(), updated_at: office.updatedAt })
      .where('public_id', '=', publicIdToBinary(office.publicId))
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  }

  async softDelete(office: Office): Promise<void> {
    const actorId = await this.actorId(office.deletedByActorPublicId);
    await this.database
      .updateTable('offices')
      .set({
        deleted_at: office.deletedAt,
        deleted_by_user_id: actorId,
        delete_reason: office.deleteReason,
        updated_at: office.updatedAt,
      })
      .where('public_id', '=', publicIdToBinary(office.publicId))
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  }

  async restore(office: Office): Promise<void> {
    await this.database
      .updateTable('offices')
      .set({
        status: office.status.toString(),
        deleted_at: null,
        deleted_by_user_id: null,
        delete_reason: null,
        updated_at: office.updatedAt,
      })
      .where('public_id', '=', publicIdToBinary(office.publicId))
      .where('deleted_at', 'is not', null)
      .executeTakeFirst();
  }

  async listAdmin(query: OfficeListQuery): Promise<OfficePage> {
    let builder = this.database
      .selectFrom('offices')
      .leftJoin('users as deleted_by', 'deleted_by.id', 'offices.deleted_by_user_id')
      .selectAll('offices')
      .select('deleted_by.public_id as deleted_by_public_id');
    if (query.lifecycle === 'current') builder = builder.where('offices.deleted_at', 'is', null);
    if (query.lifecycle === 'deleted')
      builder = builder.where('offices.deleted_at', 'is not', null);
    if (query.status !== null) {
      builder = builder.where('offices.status', '=', OfficeStatus.from(query.status).toString());
    }
    if (query.query !== null) {
      const pattern = `%${escapeLikeLiteral(query.query)}%`;
      builder = builder.where((expression) =>
        expression.or([
          sql<boolean>`offices.office_name like ${pattern} escape '\\'`,
          sql<boolean>`offices.abbreviation like ${pattern} escape '\\'`,
        ]),
      );
    }
    const cursor =
      query.cursor === null ? null : this.cursors.decode(query.cursor, 'office', query);
    if (cursor !== null) {
      const operator = keysetOperator(cursor.direction);
      builder = builder.where((expression) =>
        expression.or([
          expression('offices.office_name', operator, cursor.sortValue),
          expression.and([
            expression('offices.office_name', '=', cursor.sortValue),
            expression(
              'offices.public_id',
              operator,
              publicIdToBinary(PublicId.from(cursor.publicId)),
            ),
          ]),
        ]),
      );
    }
    const direction = cursor?.direction ?? 'next';
    const rows = await builder
      .orderBy('offices.office_name', direction === 'previous' ? 'desc' : 'asc')
      .orderBy('offices.public_id', direction === 'previous' ? 'desc' : 'asc')
      .limit(query.pageSize + 1)
      .execute();
    const hasExtra = rows.length > query.pageSize;
    const pageRows = normalizeKeysetPage(rows.slice(0, query.pageSize), direction);
    return this.officePage(pageRows, query, cursor !== null, hasExtra, direction);
  }

  async listOperational(query: OfficeListQuery): Promise<OfficeOperationalPage> {
    const adminPage = await this.listAdmin({
      ...query,
      mode: 'operational',
      lifecycle: 'current',
      status: 'ACTIVE',
    });
    return {
      items: adminPage.items.map((office) => ({
        publicId: office.publicId,
        name: office.name,
        abbreviation: office.abbreviation,
      })),
      nextCursor: adminPage.nextCursor,
      previousCursor: adminPage.previousCursor,
    };
  }

  private async find(
    publicId: string,
    lifecycle: 'current' | 'deleted' | 'all',
    lock: boolean,
  ): Promise<Office | null> {
    let query = this.database
      .selectFrom('offices')
      .leftJoin('users as deleted_by', 'deleted_by.id', 'offices.deleted_by_user_id')
      .selectAll('offices')
      .select('deleted_by.public_id as deleted_by_public_id')
      .where('offices.public_id', '=', publicIdToBinary(PublicId.from(publicId)));
    if (lifecycle === 'current') query = query.where('offices.deleted_at', 'is', null);
    if (lifecycle === 'deleted') query = query.where('offices.deleted_at', 'is not', null);
    const row = await (lock ? query.forUpdate() : query).executeTakeFirst();
    return row === undefined ? null : this.map(row);
  }

  private map(row: OfficeRow): Office {
    return new Office({
      publicId: binaryToPublicId(row.public_id),
      name: OfficeName.from(row.office_name),
      abbreviation: OfficeAbbreviation.from(row.abbreviation),
      status: OfficeStatus.from(row.status),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
      deletedByActorPublicId:
        row.deleted_by_public_id === null ? null : binaryToPublicId(row.deleted_by_public_id),
      deleteReason: row.delete_reason,
    });
  }

  private officePage(
    rows: readonly OfficeRow[],
    query: OfficeListQuery,
    hadCursor: boolean,
    hasExtra: boolean,
    direction: 'next' | 'previous',
  ): OfficePage {
    const items = rows
      .map((row) => this.map(row))
      .map((office) => ({
        publicId: office.publicId.toString(),
        name: office.name.toString(),
        abbreviation: office.abbreviation.toString(),
        status: office.status.toString(),
        operational: office.isOperational(),
        createdAt: office.createdAt.toISOString(),
        updatedAt: office.updatedAt.toISOString(),
        deletedAt: office.deletedAt?.toISOString() ?? null,
        deletedByActorPublicId: office.deletedByActorPublicId?.toString() ?? null,
        deleteReason: office.deleteReason,
      }));
    const first = items[0];
    const last = items.at(-1);
    return {
      items,
      previousCursor:
        first !== undefined && (hadCursor || (direction === 'previous' && hasExtra))
          ? this.cursors.encode({
              resource: 'office',
              direction: 'previous',
              sortValue: first.name,
              publicId: first.publicId,
              query,
            })
          : null,
      nextCursor:
        last !== undefined && (hasExtra || direction === 'previous')
          ? this.cursors.encode({
              resource: 'office',
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
