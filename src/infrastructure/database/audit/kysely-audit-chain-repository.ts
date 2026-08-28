import type { Kysely, Transaction } from 'kysely';

import type {
  AuditChainHeadDto,
  AuditOutboxRecordDto,
  AuditPendingSinkDeliveryDto,
} from '@/application/audit/dto/audit-event-dtos';
import type {
  AuditChainRepository,
  AuditSinkRetryInput,
  LockedAuditChainRepository,
} from '@/application/audit/ports/audit-chain-repository';
import type { AuditChainRecord } from '@/domain/audit/entities/audit-chain-record';
import { AuditEvent } from '@/domain/audit/entities/audit-event';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import type { Database } from '@/infrastructure/database/types';
import { binaryToPublicId, publicIdToBinary } from '@/infrastructure/database/uuid-binary';

import { auditIpAddressToBinary } from './kysely-audit-outbox-store';

export interface AuditChainRepositoryOptions {
  readonly primarySchema: string;
}

class KyselyLockedAuditChainRepository implements LockedAuditChainRepository {
  constructor(
    private readonly transaction: Transaction<Database>,
    private readonly options: AuditChainRepositoryOptions,
  ) {}

  async getHead(): Promise<AuditChainHeadDto> {
    const row = await this.transaction
      .withSchema(this.options.primarySchema)
      .selectFrom('audit_chain_heads')
      .select(['last_sequence', 'last_source_position', 'last_record_hash'])
      .where('head_name', '=', 'global')
      .forUpdate()
      .executeTakeFirstOrThrow();
    return {
      sequence: row.last_sequence,
      sourcePosition: row.last_source_position,
      recordHash: new Uint8Array(row.last_record_hash),
    };
  }

  async loadOutboxAfter(
    sourcePosition: string,
    limit: number,
  ): Promise<readonly AuditOutboxRecordDto[]> {
    const rows = await this.transaction
      .withSchema(this.options.primarySchema)
      .selectFrom('audit_outbox')
      .select(['source_position', 'event_public_id', 'canonical_payload', 'captured_at'])
      .where('source_position', '>', sourcePosition)
      .orderBy('source_position', 'asc')
      .limit(limit)
      .execute();
    return rows.map((row) => ({
      sourcePosition: row.source_position,
      eventPublicId: binaryToPublicId(row.event_public_id).toString(),
      canonicalPayload: row.canonical_payload,
      capturedAt: row.captured_at.toISOString(),
    }));
  }

  async append(records: readonly AuditChainRecord[], nextHead: AuditChainHeadDto): Promise<void> {
    if (records.length === 0) return;
    const primary = this.transaction.withSchema(this.options.primarySchema);
    const rows = records.map((record) => {
      const event = AuditEvent.create(
        JSON.parse(record.canonicalPayload) as Parameters<typeof AuditEvent.create>[0],
      ).toPrimitives();
      return {
        sequence: record.sequence,
        source_position: record.sourcePosition,
        event_public_id: publicIdToBinary(PublicId.from(record.sourceEventPublicId)),
        schema_version: event.schemaVersion,
        occurred_at: new Date(event.occurredAt),
        actor_public_id:
          event.actorPublicId === null
            ? null
            : publicIdToBinary(PublicId.from(event.actorPublicId)),
        action: event.action,
        entity_type: event.entity?.type ?? null,
        entity_public_id:
          event.entity === null ? null : publicIdToBinary(PublicId.from(event.entity.publicId)),
        request_id: event.requestId,
        reason_code: event.reasonCode,
        ip_address: auditIpAddressToBinary(event.ipAddress),
        user_agent: event.userAgent,
        canonical_payload: record.canonicalPayload,
        previous_hash: Buffer.from(record.previousHash),
        record_hash: Buffer.from(record.recordHash),
        chained_at: new Date(record.chainedAt),
      };
    });
    await primary.insertInto('audit_chain_entries').values(rows).execute();
    await primary
      .insertInto('audit_sink_deliveries')
      .values(
        records.map((record) => ({
          sequence: record.sequence,
          attempt_count: 0,
          next_retry_at: new Date(record.chainedAt),
          last_error_code: null,
          delivered_at: null,
          delivery_fingerprint: null,
          updated_at: new Date(record.chainedAt),
        })),
      )
      .execute();
    await primary
      .updateTable('audit_chain_heads')
      .set({
        last_sequence: nextHead.sequence,
        last_source_position: nextHead.sourcePosition,
        last_record_hash: Buffer.from(nextHead.recordHash),
        updated_at: new Date(records.at(-1)!.chainedAt),
      })
      .where('head_name', '=', 'global')
      .executeTakeFirstOrThrow();
  }
}

export class KyselyAuditChainRepository implements AuditChainRepository {
  constructor(
    private readonly database: Kysely<Database>,
    private readonly options: AuditChainRepositoryOptions,
  ) {}

  executeWithLockedHead<T>(
    work: (repository: LockedAuditChainRepository) => Promise<T>,
  ): Promise<T> {
    return this.database
      .transaction()
      .execute((transaction) =>
        work(new KyselyLockedAuditChainRepository(transaction, this.options)),
      );
  }

  async listPendingSinkDeliveries(
    now: string,
    limit: number,
  ): Promise<readonly AuditPendingSinkDeliveryDto[]> {
    const rows = await this.database
      .withSchema(this.options.primarySchema)
      .selectFrom('audit_sink_deliveries as delivery')
      .innerJoin('audit_chain_entries as entry', 'entry.sequence', 'delivery.sequence')
      .select([
        'entry.sequence',
        'entry.event_public_id',
        'entry.canonical_payload',
        'entry.previous_hash',
        'entry.record_hash',
        'delivery.attempt_count',
      ])
      .where('delivery.delivered_at', 'is', null)
      .where('delivery.next_retry_at', '<=', new Date(now))
      .orderBy('delivery.sequence', 'asc')
      .limit(limit)
      .execute();
    return rows.map((row) => ({
      sequence: row.sequence,
      eventPublicId: binaryToPublicId(row.event_public_id).toString(),
      canonicalPayload: row.canonical_payload,
      previousHash: new Uint8Array(row.previous_hash),
      recordHash: new Uint8Array(row.record_hash),
      attemptCount: row.attempt_count,
    }));
  }

  async markSinkDelivered(
    sequence: string,
    deliveryFingerprint: Uint8Array,
    deliveredAt: string,
  ): Promise<void> {
    await this.database
      .withSchema(this.options.primarySchema)
      .updateTable('audit_sink_deliveries')
      .set({
        delivered_at: new Date(deliveredAt),
        delivery_fingerprint: Buffer.from(deliveryFingerprint),
        last_error_code: null,
        updated_at: new Date(deliveredAt),
      })
      .where('sequence', '=', sequence)
      .where('delivered_at', 'is', null)
      .executeTakeFirstOrThrow();
  }

  async scheduleSinkRetry(input: AuditSinkRetryInput): Promise<void> {
    await this.database
      .withSchema(this.options.primarySchema)
      .updateTable('audit_sink_deliveries')
      .set({
        attempt_count: input.attemptCount,
        next_retry_at: new Date(input.nextRetryAt),
        last_error_code: input.errorCode,
        updated_at: new Date(input.nextRetryAt),
      })
      .where('sequence', '=', input.sequence)
      .where('delivered_at', 'is', null)
      .executeTakeFirstOrThrow();
  }
}
