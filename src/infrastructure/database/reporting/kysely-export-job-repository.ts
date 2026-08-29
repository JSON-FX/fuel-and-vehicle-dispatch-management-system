import { sql, type Kysely, type Selectable } from 'kysely';

import type {
  ExportDownloadTokenRecord,
  ExportFailureCode,
  ExportJobRecord,
} from '@/application/reporting/dto/export-job-dtos';
import type {
  CompleteExportJobInput,
  CreateExportJobInput,
  ExportJobRepository,
  FailExportJobInput,
} from '@/application/reporting/ports/export-job-repository';
import { ExportJobStateMachine } from '@/application/reporting/services/export-job-state-machine';
import { ConflictError } from '@/application/shared/errors/application-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import type { Database, ExportJobsTable, JsonValue } from '@/infrastructure/database/types';
import { binaryToPublicId, publicIdToBinary } from '@/infrastructure/database/uuid-binary';

type JoinedExportJobRow = Selectable<ExportJobsTable> & {
  requester_public_id: Buffer;
};

export class KyselyExportJobRepository implements ExportJobRepository {
  private readonly states = new ExportJobStateMachine();

  constructor(private readonly database: Kysely<Database>) {}

  async create(input: CreateExportJobInput): Promise<ExportJobRecord> {
    await this.database
      .insertInto('export_jobs')
      .values({
        public_id: publicIdToBinary(PublicId.from(input.publicId)),
        requester_user_id: input.requesterUserId,
        report_type: input.filters.reportType,
        period_type: input.filters.periodType,
        filters: JSON.stringify(input.filters),
        filter_hash: hexBuffer(input.filterHash, 'filterHash'),
        mode: input.mode,
        status: 'QUEUED',
        estimated_rows: input.estimatedRows,
        actual_rows: null,
        attempts: 0,
        max_attempts: 3,
        available_at: input.now,
        lease_owner: null,
        lease_expires_at: null,
        started_at: null,
        finished_at: null,
        storage_key: null,
        filename: null,
        mime_type: null,
        byte_length: null,
        sha256: null,
        file_expires_at: null,
        failure_code: null,
        failure_message: null,
        created_at: input.now,
        updated_at: input.now,
      })
      .execute();
    return this.findByPublicId(input.publicId);
  }

  async findOwn(publicId: string, requesterUserId: string): Promise<ExportJobRecord | null> {
    const row = await this.baseQuery()
      .where('job.public_id', '=', publicIdToBinary(PublicId.from(publicId)))
      .where('job.requester_user_id', '=', requesterUserId)
      .executeTakeFirst();
    return row === undefined ? null : mapJob(row as JoinedExportJobRow);
  }

  async listOwn(requesterUserId: string, limit: number): Promise<readonly ExportJobRecord[]> {
    const rows = await this.baseQuery()
      .where('job.requester_user_id', '=', requesterUserId)
      .orderBy('job.created_at', 'desc')
      .orderBy('job.id', 'desc')
      .limit(Math.max(1, Math.min(limit, 100)))
      .execute();
    return rows.map((row) => mapJob(row as JoinedExportJobRow));
  }

  async start(
    id: string,
    workerId: string | null,
    now: Date,
    leaseExpiresAt: Date | null,
  ): Promise<ExportJobRecord> {
    this.states.assertTransition('QUEUED', 'RUNNING');
    const result = await this.database
      .updateTable('export_jobs')
      .set({
        status: 'RUNNING',
        attempts: sql`attempts + 1`,
        lease_owner: workerId,
        lease_expires_at: leaseExpiresAt,
        started_at: now,
        updated_at: now,
      })
      .where('id', '=', id)
      .where('status', '=', 'QUEUED')
      .where(sql<boolean>`attempts < max_attempts`)
      .executeTakeFirst();
    if (Number(result.numUpdatedRows) !== 1) throw transitionConflict();
    return this.findById(id);
  }

  async claimNext(
    workerId: string,
    now: Date,
    leaseExpiresAt: Date,
  ): Promise<ExportJobRecord | null> {
    return this.database.transaction().execute(async (transaction) => {
      const exhausted = await transaction
        .selectFrom('export_jobs')
        .select('id')
        .where('status', '=', 'RUNNING')
        .where('lease_expires_at', '<=', now)
        .where(sql<boolean>`attempts >= max_attempts`)
        .orderBy('lease_expires_at')
        .orderBy('id')
        .forUpdate()
        .skipLocked()
        .executeTakeFirst();
      if (exhausted !== undefined) {
        await transaction
          .updateTable('export_jobs')
          .set({ lease_owner: workerId, lease_expires_at: leaseExpiresAt, updated_at: now })
          .where('id', '=', exhausted.id)
          .where('status', '=', 'RUNNING')
          .executeTakeFirstOrThrow();
        const row = await baseQuery(transaction)
          .where('job.id', '=', exhausted.id)
          .executeTakeFirstOrThrow();
        return mapJob(row as JoinedExportJobRow);
      }

      await transaction
        .updateTable('export_jobs')
        .set({
          status: 'QUEUED',
          lease_owner: null,
          lease_expires_at: null,
          available_at: now,
          updated_at: now,
        })
        .where('status', '=', 'RUNNING')
        .where('lease_expires_at', '<=', now)
        .where(sql<boolean>`attempts < max_attempts`)
        .execute();

      const candidate = await transaction
        .selectFrom('export_jobs')
        .select('id')
        .where('status', '=', 'QUEUED')
        .where('available_at', '<=', now)
        .where(sql<boolean>`attempts < max_attempts`)
        .orderBy('available_at')
        .orderBy('id')
        .forUpdate()
        .skipLocked()
        .executeTakeFirst();
      if (candidate === undefined) return null;

      await transaction
        .updateTable('export_jobs')
        .set({
          status: 'RUNNING',
          attempts: sql`attempts + 1`,
          lease_owner: workerId,
          lease_expires_at: leaseExpiresAt,
          started_at: sql`coalesce(started_at, ${now})`,
          updated_at: now,
        })
        .where('id', '=', candidate.id)
        .where('status', '=', 'QUEUED')
        .executeTakeFirstOrThrow();

      const row = await baseQuery(transaction)
        .where('job.id', '=', candidate.id)
        .executeTakeFirstOrThrow();
      return mapJob(row as JoinedExportJobRow);
    });
  }

  async renewLease(id: string, workerId: string, leaseExpiresAt: Date): Promise<boolean> {
    const result = await this.database
      .updateTable('export_jobs')
      .set({ lease_expires_at: leaseExpiresAt, updated_at: new Date() })
      .where('id', '=', id)
      .where('status', '=', 'RUNNING')
      .where('lease_owner', '=', workerId)
      .executeTakeFirst();
    return Number(result.numUpdatedRows) === 1;
  }

  async complete(
    id: string,
    workerId: string | null,
    input: CompleteExportJobInput,
  ): Promise<void> {
    this.states.assertTransition('RUNNING', 'COMPLETED');
    let query = this.database
      .updateTable('export_jobs')
      .set({
        status: 'COMPLETED',
        actual_rows: input.actualRows,
        storage_key: input.storageKey,
        filename: input.filename,
        mime_type: input.mimeType,
        byte_length: input.byteLength,
        sha256: hexBuffer(input.sha256, 'sha256'),
        file_expires_at: input.fileExpiresAt,
        failure_code: null,
        failure_message: null,
        lease_owner: null,
        lease_expires_at: null,
        finished_at: input.finishedAt,
        updated_at: input.finishedAt,
      })
      .where('id', '=', id)
      .where('status', '=', 'RUNNING');
    query =
      workerId === null
        ? query.where('lease_owner', 'is', null)
        : query.where('lease_owner', '=', workerId);
    const result = await query.executeTakeFirst();
    if (Number(result.numUpdatedRows) !== 1) throw transitionConflict();
  }

  async retry(id: string, workerId: string, availableAt: Date, now: Date): Promise<void> {
    this.states.assertTransition('RUNNING', 'QUEUED');
    const result = await this.database
      .updateTable('export_jobs')
      .set({
        status: 'QUEUED',
        available_at: availableAt,
        lease_owner: null,
        lease_expires_at: null,
        failure_code: null,
        failure_message: null,
        updated_at: now,
      })
      .where('id', '=', id)
      .where('status', '=', 'RUNNING')
      .where('lease_owner', '=', workerId)
      .where(sql<boolean>`attempts < max_attempts`)
      .executeTakeFirst();
    if (Number(result.numUpdatedRows) !== 1) throw transitionConflict();
  }

  async fail(id: string, workerId: string | null, input: FailExportJobInput): Promise<void> {
    this.states.assertTransition('RUNNING', 'FAILED');
    let query = this.database
      .updateTable('export_jobs')
      .set({
        status: 'FAILED',
        failure_code: input.failureCode,
        failure_message: safeFailureMessage(input.failureMessage),
        lease_owner: null,
        lease_expires_at: null,
        finished_at: input.failedAt,
        updated_at: input.failedAt,
      })
      .where('id', '=', id)
      .where('status', '=', 'RUNNING');
    query =
      workerId === null
        ? query.where('lease_owner', 'is', null)
        : query.where('lease_owner', '=', workerId);
    const result = await query.executeTakeFirst();
    if (Number(result.numUpdatedRows) !== 1) throw transitionConflict();
  }

  async expireCompleted(now: Date, limit: number): Promise<readonly ExportJobRecord[]> {
    const rows = await this.baseQuery()
      .where('job.status', '=', 'COMPLETED')
      .where('job.file_expires_at', '<=', now)
      .orderBy('job.file_expires_at')
      .orderBy('job.id')
      .limit(Math.max(1, Math.min(limit, 100)))
      .execute();
    return rows.map((row) => mapJob(row as JoinedExportJobRow));
  }

  async markExpired(id: string, now: Date): Promise<void> {
    this.states.assertTransition('COMPLETED', 'EXPIRED');
    const result = await this.database
      .updateTable('export_jobs')
      .set({
        status: 'EXPIRED',
        storage_key: null,
        filename: null,
        mime_type: null,
        byte_length: null,
        sha256: null,
        file_expires_at: null,
        updated_at: now,
      })
      .where('id', '=', id)
      .where('status', '=', 'COMPLETED')
      .executeTakeFirst();
    if (Number(result.numUpdatedRows) !== 1) throw transitionConflict();
  }

  async createDownloadToken(input: Omit<ExportDownloadTokenRecord, 'id'>): Promise<void> {
    await this.database
      .insertInto('export_download_tokens')
      .values({
        export_job_id: input.exportJobId,
        user_id: input.userId,
        token_hash: Buffer.from(input.tokenHash),
        expires_at: input.expiresAt,
        consumed_at: input.consumedAt,
        created_at: input.createdAt,
      })
      .execute();
  }

  async consumeDownloadToken(
    jobId: string,
    userId: string,
    tokenHash: Uint8Array,
    now: Date,
  ): Promise<boolean> {
    const result = await this.database
      .updateTable('export_download_tokens')
      .set({ consumed_at: now })
      .where('export_job_id', '=', jobId)
      .where('user_id', '=', userId)
      .where('token_hash', '=', Buffer.from(tokenHash))
      .where('expires_at', '>', now)
      .where('consumed_at', 'is', null)
      .executeTakeFirst();
    return Number(result.numUpdatedRows) === 1;
  }

  async deleteExpiredDownloadTokens(now: Date, limit: number): Promise<number> {
    const rows = await this.database
      .selectFrom('export_download_tokens')
      .select('id')
      .where((expression) =>
        expression.or([
          expression('expires_at', '<=', now),
          expression('consumed_at', 'is not', null),
        ]),
      )
      .orderBy('expires_at')
      .orderBy('id')
      .limit(Math.max(1, Math.min(limit, 500)))
      .execute();
    if (rows.length === 0) return 0;
    const result = await this.database
      .deleteFrom('export_download_tokens')
      .where(
        'id',
        'in',
        rows.map((row) => row.id),
      )
      .executeTakeFirst();
    return Number(result.numDeletedRows);
  }

  private baseQuery() {
    return baseQuery(this.database);
  }

  private async findByPublicId(publicId: string): Promise<ExportJobRecord> {
    const row = await this.baseQuery()
      .where('job.public_id', '=', publicIdToBinary(PublicId.from(publicId)))
      .executeTakeFirstOrThrow();
    return mapJob(row as JoinedExportJobRow);
  }

  private async findById(id: string): Promise<ExportJobRecord> {
    const row = await this.baseQuery().where('job.id', '=', id).executeTakeFirstOrThrow();
    return mapJob(row as JoinedExportJobRow);
  }
}

function baseQuery(database: Kysely<Database>) {
  return database
    .selectFrom('export_jobs as job')
    .innerJoin('users as requester', 'requester.id', 'job.requester_user_id')
    .selectAll('job')
    .select('requester.public_id as requester_public_id');
}

function mapJob(row: JoinedExportJobRow): ExportJobRecord {
  const filters = parseFilters(row.filters);
  return {
    id: row.id,
    publicId: binaryToPublicId(row.public_id).toString(),
    requesterUserId: row.requester_user_id,
    requesterPublicId: binaryToPublicId(row.requester_public_id).toString(),
    reportType: row.report_type,
    periodType: row.period_type,
    filters,
    filterHash: row.filter_hash.toString('hex'),
    mode: row.mode,
    status: row.status,
    estimatedRows: row.estimated_rows,
    actualRows: row.actual_rows,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    storageKey: row.storage_key,
    filename: row.filename,
    mimeType: row.mime_type,
    byteLength: row.byte_length === null ? null : Number(row.byte_length),
    sha256: row.sha256?.toString('hex') ?? null,
    failureCode: row.failure_code as ExportFailureCode | null,
    failureMessage: row.failure_message,
    requestedAt: row.created_at.toISOString(),
    startedAt: row.started_at?.toISOString() ?? null,
    finishedAt: row.finished_at?.toISOString() ?? null,
    fileExpiresAt: row.file_expires_at?.toISOString() ?? null,
    availableAt: row.available_at,
    leaseOwner: row.lease_owner,
    leaseExpiresAt: row.lease_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseFilters(value: JsonValue): ExportJobRecord['filters'] {
  const parsed = typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Stored report filters are invalid.');
  }
  return parsed as unknown as ExportJobRecord['filters'];
}

function hexBuffer(value: string, field: string): Buffer {
  if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error(`${field} must be a SHA-256 hex value.`);
  return Buffer.from(value, 'hex');
}

function safeFailureMessage(message: string): string {
  return message
    .replaceAll(/[\r\n\t]/g, ' ')
    .trim()
    .slice(0, 255);
}

function transitionConflict(): ConflictError {
  return new ConflictError('The export job changed before this operation completed.');
}
