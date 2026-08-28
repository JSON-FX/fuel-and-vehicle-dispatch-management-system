import type { Kysely } from 'kysely';

import type {
  AuditEventDetailDto,
  AuditEventPageDto,
  AuditEventSummaryDto,
  AuditSearchQuery,
  AuditVerificationStatusDto,
} from '@/application/audit/dto/audit-event-dtos';
import type { AuditQueryRepository } from '@/application/audit/ports/audit-query-repository';
import { AuditEvent } from '@/domain/audit/entities/audit-event';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import type { Database } from '@/infrastructure/database/types';
import { binaryToPublicId, publicIdToBinary } from '@/infrastructure/database/uuid-binary';

import { AuditCursorCodec, type AuditCursorDirection } from './audit-cursor-codec';

export interface AuditQueryRepositoryOptions {
  readonly primarySchema: string;
}

export class KyselyAuditQueryRepository implements AuditQueryRepository {
  private readonly cursors = new AuditCursorCodec();

  constructor(
    private readonly database: Kysely<Database>,
    private readonly options: AuditQueryRepositoryOptions,
  ) {}

  async search(query: AuditSearchQuery): Promise<AuditEventPageDto> {
    const cursor = query.cursor === null ? null : this.cursors.decode(query.cursor, query);
    let builder = this.database
      .withSchema(this.options.primarySchema)
      .selectFrom('audit_chain_entries')
      .select([
        'sequence',
        'event_public_id',
        'occurred_at',
        'actor_public_id',
        'action',
        'entity_type',
        'entity_public_id',
        'request_id',
      ]);
    if (query.from !== null) builder = builder.where('occurred_at', '>=', new Date(query.from));
    if (query.to !== null) builder = builder.where('occurred_at', '<=', new Date(query.to));
    if (query.action !== null) builder = builder.where('action', '=', query.action);
    if (query.entityType !== null) builder = builder.where('entity_type', '=', query.entityType);
    if (query.entityPublicId !== null) {
      builder = builder.where(
        'entity_public_id',
        '=',
        publicIdToBinary(PublicId.from(query.entityPublicId)),
      );
    }
    if (query.actorPublicId !== null) {
      builder = builder.where(
        'actor_public_id',
        '=',
        publicIdToBinary(PublicId.from(query.actorPublicId)),
      );
    }
    if (query.requestId !== null) builder = builder.where('request_id', '=', query.requestId);

    let direction: AuditCursorDirection = 'next';
    if (cursor !== null) {
      direction = cursor.direction;
      builder = builder.where('sequence', cursor.direction === 'next' ? '<' : '>', cursor.sequence);
    }
    const ascending = cursor?.direction === 'previous';
    const fetched = await builder
      .orderBy('sequence', ascending ? 'asc' : 'desc')
      .limit(query.pageSize + 1)
      .execute();
    const hasMore = fetched.length > query.pageSize;
    const selected = fetched.slice(0, query.pageSize);
    const ordered = ascending ? selected.reverse() : selected;
    const items = ordered.map((row) => this.mapSummary(row));
    if (items.length === 0) {
      return { items: [], previousCursor: null, nextCursor: null };
    }

    const first = items[0]!;
    const last = items.at(-1)!;
    const previousCursor =
      direction === 'next'
        ? cursor === null
          ? null
          : this.cursors.encode('previous', first.sequence, query)
        : hasMore
          ? this.cursors.encode('previous', first.sequence, query)
          : null;
    const nextCursor =
      direction === 'previous'
        ? this.cursors.encode('next', last.sequence, query)
        : hasMore
          ? this.cursors.encode('next', last.sequence, query)
          : null;
    return { items, previousCursor, nextCursor };
  }

  async findByPublicId(
    publicId: string,
    includeSensitive: boolean,
  ): Promise<AuditEventDetailDto | null> {
    const row = await this.database
      .withSchema(this.options.primarySchema)
      .selectFrom('audit_chain_entries')
      .selectAll()
      .where('event_public_id', '=', publicIdToBinary(PublicId.from(publicId)))
      .executeTakeFirst();
    if (row === undefined) return null;
    const event = AuditEvent.create(
      JSON.parse(row.canonical_payload) as Parameters<typeof AuditEvent.create>[0],
    ).toPrimitives();
    return {
      ...this.mapSummary(row),
      sourcePosition: row.source_position,
      schemaVersion: 1,
      reasonCode: row.reason_code,
      previousHashHex: row.previous_hash.toString('hex'),
      recordHashHex: row.record_hash.toString('hex'),
      chainedAt: row.chained_at.toISOString(),
      sensitive: includeSensitive
        ? {
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
            before: event.before,
            after: event.after,
            metadata: event.metadata,
          }
        : null,
    };
  }

  async findLatestVerification(): Promise<AuditVerificationStatusDto | null> {
    const row = await this.database
      .withSchema(this.options.primarySchema)
      .selectFrom('audit_verification_runs')
      .selectAll()
      .orderBy('completed_at', 'desc')
      .orderBy('id', 'desc')
      .executeTakeFirst();
    return row === undefined
      ? null
      : {
          publicId: binaryToPublicId(row.public_id).toString(),
          status: row.status,
          highWaterSequence: row.high_water_sequence,
          verifiedCount: row.verified_count,
          firstMismatchSequence: row.first_mismatch_sequence,
          firstMismatchType:
            row.first_mismatch_type as AuditVerificationStatusDto['firstMismatchType'],
          summary: row.summary,
          startedAt: row.started_at.toISOString(),
          completedAt: row.completed_at.toISOString(),
        };
  }

  private mapSummary(row: {
    readonly sequence: string;
    readonly event_public_id: Buffer;
    readonly occurred_at: Date;
    readonly actor_public_id: Buffer | null;
    readonly action: string;
    readonly entity_type: string | null;
    readonly entity_public_id: Buffer | null;
    readonly request_id: string;
  }): AuditEventSummaryDto {
    return {
      publicId: binaryToPublicId(row.event_public_id).toString(),
      sequence: row.sequence,
      occurredAt: row.occurred_at.toISOString(),
      actorPublicId:
        row.actor_public_id === null ? null : binaryToPublicId(row.actor_public_id).toString(),
      action: row.action,
      entity:
        row.entity_type === null || row.entity_public_id === null
          ? null
          : {
              type: row.entity_type,
              publicId: binaryToPublicId(row.entity_public_id).toString(),
            },
      requestId: row.request_id,
    };
  }
}
