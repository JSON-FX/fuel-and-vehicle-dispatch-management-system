import type { Kysely } from 'kysely';

import type { AuditSinkRecordDto } from '@/application/audit/dto/audit-event-dtos';
import type { AuditSink, AuditSinkAppendResult } from '@/application/audit/ports/audit-sink';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import type { Database } from '@/infrastructure/database/types';
import { binaryToPublicId, publicIdToBinary } from '@/infrastructure/database/uuid-binary';

export interface AuditSinkOptions {
  readonly sinkSchema: string;
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY'
  );
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return Buffer.from(left).equals(Buffer.from(right));
}

export class KyselyAuditSink implements AuditSink {
  constructor(
    private readonly database: Kysely<Database>,
    private readonly options: AuditSinkOptions,
  ) {}

  async append(record: AuditSinkRecordDto): Promise<AuditSinkAppendResult> {
    const sink = this.database.withSchema(this.options.sinkSchema);
    try {
      await sink
        .insertInto('audit_sink_entries')
        .values({
          delivery_fingerprint: Buffer.from(record.deliveryFingerprint),
          sequence: record.sequence,
          event_public_id: publicIdToBinary(PublicId.from(record.eventPublicId)),
          canonical_payload: record.canonicalPayload,
          previous_hash: Buffer.from(record.previousHash),
          record_hash: Buffer.from(record.recordHash),
          delivered_at: new Date(record.deliveredAt),
        })
        .execute();
      return 'INSERTED';
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
    }

    const existing = await sink
      .selectFrom('audit_sink_entries')
      .select(['sequence', 'event_public_id', 'canonical_payload', 'previous_hash', 'record_hash'])
      .where('delivery_fingerprint', '=', Buffer.from(record.deliveryFingerprint))
      .executeTakeFirstOrThrow();
    const exact =
      existing.sequence === record.sequence &&
      binaryToPublicId(existing.event_public_id).toString() === record.eventPublicId &&
      existing.canonical_payload === record.canonicalPayload &&
      sameBytes(existing.previous_hash, record.previousHash) &&
      sameBytes(existing.record_hash, record.recordHash);
    if (!exact) {
      throw new Error('Audit sink delivery fingerprint conflict detected.');
    }
    return 'EXACT_DUPLICATE';
  }
}
