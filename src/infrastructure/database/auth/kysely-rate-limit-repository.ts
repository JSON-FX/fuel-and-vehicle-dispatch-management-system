import type { Kysely } from 'kysely';

import type {
  RateLimitBucketType,
  RateLimitRecord,
  RateLimitRepository,
} from '@/application/auth/ports/rate-limit-repository';
import type { Database } from '@/infrastructure/database/types';

export class KyselyRateLimitRepository implements RateLimitRepository {
  constructor(private readonly database: Kysely<Database>) {}

  async find(
    bucketType: RateLimitBucketType,
    bucketKey: Uint8Array,
  ): Promise<RateLimitRecord | null> {
    const row = await this.database
      .selectFrom('login_rate_limits')
      .selectAll()
      .where('bucket_type', '=', bucketType)
      .where('bucket_key', '=', Buffer.from(bucketKey))
      .executeTakeFirst();
    return row === undefined
      ? null
      : {
          bucketType: row.bucket_type,
          bucketKey: row.bucket_key,
          windowStartedAt: row.window_started_at,
          failureCount: row.failure_count,
          lockedUntil: row.locked_until,
        };
  }

  async recordFailure(input: {
    readonly bucketType: RateLimitBucketType;
    readonly bucketKey: Uint8Array;
    readonly now: Date;
    readonly windowSeconds: number;
    readonly lockSeconds: number;
    readonly maximumFailures: number;
  }): Promise<RateLimitRecord> {
    const key = Buffer.from(input.bucketKey);
    const existing = await this.database
      .selectFrom('login_rate_limits')
      .selectAll()
      .where('bucket_type', '=', input.bucketType)
      .where('bucket_key', '=', key)
      .forUpdate()
      .executeTakeFirst();
    const windowExpired =
      existing === undefined ||
      input.now.getTime() - existing.window_started_at.getTime() >= input.windowSeconds * 1_000;
    const failureCount = windowExpired ? 1 : existing.failure_count + 1;
    const windowStartedAt = windowExpired ? input.now : existing.window_started_at;
    const lockedUntil =
      failureCount >= input.maximumFailures
        ? new Date(input.now.getTime() + input.lockSeconds * 1_000)
        : (existing?.locked_until ?? null);

    if (existing === undefined) {
      try {
        await this.database
          .insertInto('login_rate_limits')
          .values({
            bucket_type: input.bucketType,
            bucket_key: key,
            window_started_at: windowStartedAt,
            failure_count: failureCount,
            locked_until: lockedUntil,
            updated_at: input.now,
          })
          .execute();
      } catch (error) {
        if (!isDuplicateEntry(error)) throw error;
        return this.recordFailure(input);
      }
    } else {
      await this.database
        .updateTable('login_rate_limits')
        .set({
          window_started_at: windowStartedAt,
          failure_count: failureCount,
          locked_until: lockedUntil,
          updated_at: input.now,
        })
        .where('id', '=', existing.id)
        .execute();
    }

    return {
      bucketType: input.bucketType,
      bucketKey: input.bucketKey,
      windowStartedAt,
      failureCount,
      lockedUntil,
    };
  }

  async clear(bucketType: RateLimitBucketType, bucketKey: Uint8Array): Promise<void> {
    await this.database
      .deleteFrom('login_rate_limits')
      .where('bucket_type', '=', bucketType)
      .where('bucket_key', '=', Buffer.from(bucketKey))
      .execute();
  }
}

function isDuplicateEntry(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY'
  );
}
