import type { Kysely } from 'kysely';

import type {
  AuditSinkRecordDto,
  AuditSinkVerificationCursorDto,
  AuditVerificationChainRecordDto,
  AuditVerificationHighWaterMarkDto,
  CompletedAuditVerificationRunDto,
} from '@/application/audit/dto/audit-event-dtos';
import type { AuditVerificationRepository } from '@/application/audit/ports/audit-verification-repository';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import type { Database } from '@/infrastructure/database/types';
import { binaryToPublicId, publicIdToBinary } from '@/infrastructure/database/uuid-binary';

export interface AuditVerificationRepositoryOptions {
  readonly primarySchema: string;
  readonly sinkSchema: string;
}

export class KyselyAuditVerificationRepository implements AuditVerificationRepository {
  constructor(
    private readonly primaryDatabase: Kysely<Database>,
    private readonly sinkDatabase: Kysely<Database>,
    private readonly options: AuditVerificationRepositoryOptions,
  ) {}

  async readPrimaryHighWaterMark(): Promise<AuditVerificationHighWaterMarkDto> {
    const row = await this.primaryDatabase
      .withSchema(this.options.primarySchema)
      .selectFrom('audit_chain_heads')
      .select(['last_sequence', 'last_record_hash'])
      .where('head_name', '=', 'global')
      .executeTakeFirstOrThrow();
    return { sequence: row.last_sequence, recordHash: new Uint8Array(row.last_record_hash) };
  }

  async readPrimaryPage(
    afterSequence: string,
    throughSequence: string,
    limit: number,
  ): Promise<readonly AuditVerificationChainRecordDto[]> {
    const rows = await this.primaryDatabase
      .withSchema(this.options.primarySchema)
      .selectFrom('audit_chain_entries')
      .select([
        'sequence',
        'source_position',
        'event_public_id',
        'canonical_payload',
        'previous_hash',
        'record_hash',
      ])
      .where('sequence', '>', afterSequence)
      .where('sequence', '<=', throughSequence)
      .orderBy('sequence', 'asc')
      .limit(limit)
      .execute();
    return rows.map((row) => ({
      sequence: row.sequence,
      sourcePosition: row.source_position,
      eventPublicId: binaryToPublicId(row.event_public_id).toString(),
      canonicalPayload: row.canonical_payload,
      previousHash: new Uint8Array(row.previous_hash),
      recordHash: new Uint8Array(row.record_hash),
    }));
  }

  async readSinkPage(
    after: AuditSinkVerificationCursorDto | null,
    throughSequence: string,
    limit: number,
  ): Promise<readonly AuditSinkRecordDto[]> {
    let query = this.sinkDatabase
      .withSchema(this.options.sinkSchema)
      .selectFrom('audit_sink_entries')
      .select([
        'delivery_fingerprint',
        'sequence',
        'event_public_id',
        'canonical_payload',
        'previous_hash',
        'record_hash',
        'delivered_at',
      ])
      .where('sequence', '<=', throughSequence);
    if (after !== null) {
      query = query.where((expression) =>
        expression.or([
          expression('sequence', '>', after.sequence),
          expression.and([
            expression('sequence', '=', after.sequence),
            expression('delivery_fingerprint', '>', Buffer.from(after.deliveryFingerprint)),
          ]),
        ]),
      );
    }
    const rows = await query
      .orderBy('sequence', 'asc')
      .orderBy('delivery_fingerprint', 'asc')
      .limit(limit)
      .execute();
    return rows.map((row) => ({
      deliveryFingerprint: new Uint8Array(row.delivery_fingerprint),
      sequence: row.sequence,
      eventPublicId: binaryToPublicId(row.event_public_id).toString(),
      canonicalPayload: row.canonical_payload,
      previousHash: new Uint8Array(row.previous_hash),
      recordHash: new Uint8Array(row.record_hash),
      deliveredAt: row.delivered_at.toISOString(),
    }));
  }

  async appendCompletedRun(
    run: CompletedAuditVerificationRunDto,
    highWaterRecordHash: Uint8Array,
  ): Promise<void> {
    await this.primaryDatabase
      .withSchema(this.options.primarySchema)
      .insertInto('audit_verification_runs')
      .values({
        public_id: publicIdToBinary(PublicId.from(run.publicId)),
        high_water_sequence: run.highWaterSequence,
        high_water_record_hash: Buffer.from(highWaterRecordHash),
        verified_count: run.verifiedCount,
        status: run.status,
        first_mismatch_sequence: run.firstMismatchSequence,
        first_mismatch_type: run.firstMismatchType,
        summary: run.summary,
        started_at: new Date(run.startedAt),
        completed_at: new Date(run.completedAt),
      })
      .execute();
  }
}
