import { sql, type Kysely, type Selectable } from 'kysely';

import type {
  BudgetAllocationListQuery,
  BudgetAllocationOfficeDto,
  BudgetCursorPage,
  OperationalBudgetAllocationListQuery,
  OperationalBudgetAllocationPage,
} from '@/application/budget/dto/budget-allocation-dtos';
import type {
  BudgetAllocationAdminRecord,
  BudgetAllocationAdminRecordPage,
  BudgetAllocationRepository,
} from '@/application/budget/ports/budget-allocation-repository';
import { ConflictError } from '@/application/shared/errors/application-error';
import { BudgetAllocation } from '@/domain/budget/entities/budget-allocation';
import { BudgetAllocationStatus } from '@/domain/budget/value-objects/budget-allocation-status';
import { FiscalYear } from '@/domain/budget/value-objects/fiscal-year';
import { PpmpNumber } from '@/domain/budget/value-objects/ppmp-number';
import { Quarter } from '@/domain/budget/value-objects/quarter';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import type { BudgetAllocationsTable, Database } from '@/infrastructure/database/types';
import { binaryToPublicId, publicIdToBinary } from '@/infrastructure/database/uuid-binary';
import {
  escapeLikeLiteral,
  normalizeKeysetPage,
} from '@/infrastructure/database/master-data/master-data-repository-utils';

import {
  BudgetAllocationCursorCodec,
  type BudgetCursorQuery,
} from './budget-allocation-cursor-codec';

type BudgetRow = Selectable<BudgetAllocationsTable> & {
  deleted_by_public_id: Buffer | null;
  office_public_id: Buffer;
};
type BudgetAdminRow = BudgetRow & {
  office_public_id: Buffer;
  office_name: string;
  office_abbreviation: string;
  office_status: 'ACTIVE' | 'INACTIVE';
  office_deleted_at: Date | null;
};

export class KyselyBudgetAllocationRepository implements BudgetAllocationRepository {
  constructor(
    private readonly database: Kysely<Database>,
    private readonly cursors = new BudgetAllocationCursorCodec(),
  ) {}

  findCurrentByPublicId(publicId: string): Promise<BudgetAllocation | null> {
    return this.find(publicId, 'current', false);
  }

  findIncludingDeletedByPublicId(publicId: string): Promise<BudgetAllocation | null> {
    return this.find(publicId, 'all', false);
  }

  findCurrentByPublicIdForUpdate(publicId: string): Promise<BudgetAllocation | null> {
    return this.find(publicId, 'current', true);
  }

  findDeletedByPublicIdForUpdate(publicId: string): Promise<BudgetAllocation | null> {
    return this.find(publicId, 'deleted', true);
  }

  async insert(allocation: BudgetAllocation): Promise<void> {
    try {
      await this.database
        .insertInto('budget_allocations')
        .values({
          public_id: publicIdToBinary(allocation.publicId),
          ppmp_number: allocation.ppmpNumber.toString(),
          office_id: await this.officeId(allocation.officePublicId),
          quarter: allocation.quarter.toNumber(),
          fiscal_year: allocation.fiscalYear.toNumber(),
          status: allocation.status.toString(),
          deleted_at: null,
          deleted_by_user_id: null,
          delete_reason: null,
          created_at: allocation.createdAt,
          updated_at: allocation.updatedAt,
        })
        .execute();
    } catch (error) {
      this.mapDuplicate(error);
    }
  }

  async updateDetails(allocation: BudgetAllocation): Promise<void> {
    try {
      await this.database
        .updateTable('budget_allocations')
        .set({
          ppmp_number: allocation.ppmpNumber.toString(),
          office_id: await this.officeId(allocation.officePublicId),
          quarter: allocation.quarter.toNumber(),
          fiscal_year: allocation.fiscalYear.toNumber(),
          updated_at: allocation.updatedAt,
        })
        .where('public_id', '=', publicIdToBinary(allocation.publicId))
        .where('deleted_at', 'is', null)
        .executeTakeFirst();
    } catch (error) {
      this.mapDuplicate(error);
    }
  }

  async updateStatus(allocation: BudgetAllocation): Promise<void> {
    await this.database
      .updateTable('budget_allocations')
      .set({ status: allocation.status.toString(), updated_at: allocation.updatedAt })
      .where('public_id', '=', publicIdToBinary(allocation.publicId))
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  }

  async softDelete(allocation: BudgetAllocation): Promise<void> {
    await this.database
      .updateTable('budget_allocations')
      .set({
        deleted_at: allocation.deletedAt,
        deleted_by_user_id: await this.actorId(allocation.deletedByActorPublicId),
        delete_reason: allocation.deleteReason,
        updated_at: allocation.updatedAt,
      })
      .where('public_id', '=', publicIdToBinary(allocation.publicId))
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  }

  async restore(allocation: BudgetAllocation): Promise<void> {
    await this.database
      .updateTable('budget_allocations')
      .set({
        status: allocation.status.toString(),
        deleted_at: null,
        deleted_by_user_id: null,
        delete_reason: null,
        updated_at: allocation.updatedAt,
      })
      .where('public_id', '=', publicIdToBinary(allocation.publicId))
      .where('deleted_at', 'is not', null)
      .executeTakeFirst();
  }

  async listAdmin(query: BudgetAllocationListQuery): Promise<BudgetAllocationAdminRecordPage> {
    let builder = this.database
      .selectFrom('budget_allocations as ba')
      .innerJoin('offices as office', 'office.id', 'ba.office_id')
      .leftJoin('users as deleted_by', 'deleted_by.id', 'ba.deleted_by_user_id')
      .selectAll('ba')
      .select([
        'deleted_by.public_id as deleted_by_public_id',
        'office.public_id as office_public_id',
        'office.office_name as office_name',
        'office.abbreviation as office_abbreviation',
        'office.status as office_status',
        'office.deleted_at as office_deleted_at',
      ]);
    if (query.lifecycle === 'current') builder = builder.where('ba.deleted_at', 'is', null);
    if (query.lifecycle === 'deleted') builder = builder.where('ba.deleted_at', 'is not', null);
    if (query.fiscalYear !== null) builder = builder.where('ba.fiscal_year', '=', query.fiscalYear);
    if (query.quarter !== null) builder = builder.where('ba.quarter', '=', query.quarter);
    if (query.status !== null) builder = builder.where('ba.status', '=', query.status);
    if (query.query !== null) {
      const pattern = `%${escapeLikeLiteral(query.query)}%`;
      builder = builder.where((expression) =>
        expression.or([
          sql<boolean>`ba.ppmp_number like ${pattern} escape '\\\\'`,
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
          expression('ba.fiscal_year', next ? '<' : '>', cursor.fiscalYear),
          expression.and([
            expression('ba.fiscal_year', '=', cursor.fiscalYear),
            expression('ba.quarter', next ? '<' : '>', cursor.quarter),
          ]),
          expression.and([
            expression('ba.fiscal_year', '=', cursor.fiscalYear),
            expression('ba.quarter', '=', cursor.quarter),
            expression('ba.ppmp_number', next ? '>' : '<', cursor.ppmpNumber),
          ]),
          expression.and([
            expression('ba.fiscal_year', '=', cursor.fiscalYear),
            expression('ba.quarter', '=', cursor.quarter),
            expression('ba.ppmp_number', '=', cursor.ppmpNumber),
            expression(
              'ba.public_id',
              next ? '>' : '<',
              publicIdToBinary(PublicId.from(cursor.publicId)),
            ),
          ]),
        ]),
      );
    }
    const direction = cursor?.direction ?? 'next';
    const rows = await builder
      .orderBy('ba.fiscal_year', direction === 'previous' ? 'asc' : 'desc')
      .orderBy('ba.quarter', direction === 'previous' ? 'asc' : 'desc')
      .orderBy('ba.ppmp_number', direction === 'previous' ? 'desc' : 'asc')
      .orderBy('ba.public_id', direction === 'previous' ? 'desc' : 'asc')
      .limit(query.pageSize + 1)
      .execute();
    const hasExtra = rows.length > query.pageSize;
    const pageRows = normalizeKeysetPage(
      rows.slice(0, query.pageSize),
      direction,
    ) as BudgetAdminRow[];
    const items = pageRows.map((row) => this.adminRecord(row));
    return this.page(items, query, cursor !== null, hasExtra, direction, (item) => ({
      fiscalYear: item.allocation.fiscalYear.toNumber(),
      quarter: item.allocation.quarter.toNumber(),
      ppmpNumber: item.allocation.ppmpNumber.toString(),
      publicId: item.allocation.publicId.toString(),
    }));
  }

  async listOperational(
    query: OperationalBudgetAllocationListQuery,
  ): Promise<OperationalBudgetAllocationPage> {
    let builder = this.database
      .selectFrom('budget_allocations as ba')
      .innerJoin('offices as office', 'office.id', 'ba.office_id')
      .select([
        'ba.public_id',
        'ba.ppmp_number',
        'ba.fiscal_year',
        'ba.quarter',
        'office.public_id as office_public_id',
        'office.office_name as office_name',
        'office.abbreviation as office_abbreviation',
      ])
      .where('ba.deleted_at', 'is', null)
      .where('ba.status', '=', 'ACTIVE')
      .where('ba.fiscal_year', '=', query.fiscalYear)
      .where('ba.quarter', '=', query.quarter)
      .where('office.deleted_at', 'is', null)
      .where('office.status', '=', 'ACTIVE');
    if (query.query !== null) {
      const pattern = `%${escapeLikeLiteral(query.query)}%`;
      builder = builder.where((expression) =>
        expression.or([
          sql<boolean>`ba.ppmp_number like ${pattern} escape '\\\\'`,
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
          expression('ba.fiscal_year', next ? '<' : '>', cursor.fiscalYear),
          expression.and([
            expression('ba.fiscal_year', '=', cursor.fiscalYear),
            expression('ba.quarter', next ? '<' : '>', cursor.quarter),
          ]),
          expression.and([
            expression('ba.fiscal_year', '=', cursor.fiscalYear),
            expression('ba.quarter', '=', cursor.quarter),
            expression('ba.ppmp_number', next ? '>' : '<', cursor.ppmpNumber),
          ]),
          expression.and([
            expression('ba.fiscal_year', '=', cursor.fiscalYear),
            expression('ba.quarter', '=', cursor.quarter),
            expression('ba.ppmp_number', '=', cursor.ppmpNumber),
            expression(
              'ba.public_id',
              next ? '>' : '<',
              publicIdToBinary(PublicId.from(cursor.publicId)),
            ),
          ]),
        ]),
      );
    }
    const direction = cursor?.direction ?? 'next';
    const rows = await builder
      .orderBy('ba.fiscal_year', direction === 'previous' ? 'asc' : 'desc')
      .orderBy('ba.quarter', direction === 'previous' ? 'asc' : 'desc')
      .orderBy('ba.ppmp_number', direction === 'previous' ? 'desc' : 'asc')
      .orderBy('ba.public_id', direction === 'previous' ? 'desc' : 'asc')
      .limit(query.pageSize + 1)
      .execute();
    const hasExtra = rows.length > query.pageSize;
    const pageRows = normalizeKeysetPage(rows.slice(0, query.pageSize), direction);
    const items = pageRows.map((row) => ({
      publicId: binaryToPublicId(row.public_id).toString(),
      ppmpNumber: row.ppmp_number,
      office: {
        publicId: binaryToPublicId(row.office_public_id).toString(),
        name: row.office_name,
        abbreviation: row.office_abbreviation,
      },
      quarter: row.quarter,
      fiscalYear: row.fiscal_year,
    }));
    return this.page(items, query, cursor !== null, hasExtra, direction, (item) => ({
      fiscalYear: item.fiscalYear,
      quarter: item.quarter,
      ppmpNumber: item.ppmpNumber,
      publicId: item.publicId,
    }));
  }

  private async find(
    publicId: string,
    lifecycle: 'current' | 'deleted' | 'all',
    lock: boolean,
  ): Promise<BudgetAllocation | null> {
    let query = this.database
      .selectFrom('budget_allocations as ba')
      .innerJoin('offices as office', 'office.id', 'ba.office_id')
      .leftJoin('users as deleted_by', 'deleted_by.id', 'ba.deleted_by_user_id')
      .selectAll('ba')
      .select([
        'deleted_by.public_id as deleted_by_public_id',
        'office.public_id as office_public_id',
      ])
      .where('ba.public_id', '=', publicIdToBinary(PublicId.from(publicId)));
    if (lifecycle === 'current') query = query.where('ba.deleted_at', 'is', null);
    if (lifecycle === 'deleted') query = query.where('ba.deleted_at', 'is not', null);
    const row = await (lock ? query.forUpdate() : query).executeTakeFirst();
    return row === undefined ? null : this.map(row as BudgetRow);
  }

  private map(row: BudgetRow): BudgetAllocation {
    return new BudgetAllocation({
      publicId: binaryToPublicId(row.public_id),
      ppmpNumber: PpmpNumber.from(row.ppmp_number),
      officePublicId: binaryToPublicId(row.office_public_id),
      quarter: Quarter.from(row.quarter),
      fiscalYear: FiscalYear.from(row.fiscal_year),
      status: BudgetAllocationStatus.from(row.status),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
      deletedByActorPublicId:
        row.deleted_by_public_id === null ? null : binaryToPublicId(row.deleted_by_public_id),
      deleteReason: row.delete_reason,
    });
  }

  private adminRecord(row: BudgetAdminRow): BudgetAllocationAdminRecord {
    const allocation = new BudgetAllocation({
      publicId: binaryToPublicId(row.public_id),
      ppmpNumber: PpmpNumber.from(row.ppmp_number),
      officePublicId: binaryToPublicId(row.office_public_id),
      quarter: Quarter.from(row.quarter),
      fiscalYear: FiscalYear.from(row.fiscal_year),
      status: BudgetAllocationStatus.from(row.status),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
      deletedByActorPublicId:
        row.deleted_by_public_id === null ? null : binaryToPublicId(row.deleted_by_public_id),
      deleteReason: row.delete_reason,
    });
    return {
      allocation,
      office: this.officeDto(row),
      officeOperational: row.office_deleted_at === null && row.office_status === 'ACTIVE',
    };
  }

  private officeDto(row: BudgetAdminRow): BudgetAllocationOfficeDto {
    return {
      publicId: binaryToPublicId(row.office_public_id).toString(),
      name: row.office_name,
      abbreviation: row.office_abbreviation,
    };
  }

  private page<T>(
    items: readonly T[],
    query: BudgetCursorQuery,
    hadCursor: boolean,
    hasExtra: boolean,
    direction: 'next' | 'previous',
    cursorValues: (item: T) => {
      readonly fiscalYear: number;
      readonly quarter: number;
      readonly ppmpNumber: string;
      readonly publicId: string;
    },
  ): BudgetCursorPage<T> {
    const first = items[0];
    const last = items.at(-1);
    const encode = (item: T, cursorDirection: 'next' | 'previous') => {
      const values = cursorValues(item);
      return this.cursors.encode({
        direction: cursorDirection,
        fiscalYear: values.fiscalYear,
        quarter: values.quarter,
        ppmpNumber: values.ppmpNumber,
        publicId: values.publicId,
        query,
      });
    };
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

  private async officeId(publicId: PublicId): Promise<string> {
    const office = await this.database
      .selectFrom('offices')
      .select('id')
      .where('public_id', '=', publicIdToBinary(publicId))
      .executeTakeFirstOrThrow();
    return office.id;
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

  private mapDuplicate(error: unknown): never {
    const candidate = error as { code?: unknown; message?: unknown; sqlMessage?: unknown };
    if (candidate.code !== 'ER_DUP_ENTRY') throw error;
    const message = `${String(candidate.message ?? '')} ${String(candidate.sqlMessage ?? '')}`;
    if (message.includes('uq_budget_allocations_identity')) {
      throw new ConflictError('A budget allocation with this identity already exists.', [
        { field: 'ppmpNumber', reason: 'This PPMP, office, quarter, and year already exists.' },
      ]);
    }
    throw new ConflictError('A unique budget allocation value already exists.');
  }
}
