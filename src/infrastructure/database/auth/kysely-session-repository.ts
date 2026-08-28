import type { Kysely } from 'kysely';

import type { SessionRecord, SessionRepository } from '@/application/auth/ports/session-repository';
import type { Database } from '@/infrastructure/database/types';
import { binaryToPublicId } from '@/infrastructure/database/uuid-binary';

import { publicIdBuffer, resolveUserId } from './repository-utils';

export class KyselySessionRepository implements SessionRepository {
  constructor(private readonly database: Kysely<Database>) {}

  async findByTokenHash(tokenHash: Uint8Array): Promise<SessionRecord | null> {
    const row = await this.database
      .selectFrom('user_sessions')
      .innerJoin('users', 'users.id', 'user_sessions.user_id')
      .select([
        'user_sessions.public_id',
        'users.public_id as user_public_id',
        'user_sessions.token_hash',
        'user_sessions.csrf_token_hash',
        'user_sessions.is_privileged',
        'user_sessions.created_at',
        'user_sessions.last_seen_at',
        'user_sessions.idle_expires_at',
        'user_sessions.absolute_expires_at',
        'user_sessions.revoked_at',
        'user_sessions.revoke_reason',
      ])
      .where('user_sessions.token_hash', '=', Buffer.from(tokenHash))
      .executeTakeFirst();
    return row === undefined
      ? null
      : {
          publicId: binaryToPublicId(row.public_id).toString(),
          userPublicId: binaryToPublicId(row.user_public_id).toString(),
          tokenHash: row.token_hash,
          csrfTokenHash: row.csrf_token_hash,
          isPrivileged: row.is_privileged === 1,
          createdAt: row.created_at,
          lastSeenAt: row.last_seen_at,
          idleExpiresAt: row.idle_expires_at,
          absoluteExpiresAt: row.absolute_expires_at,
          revokedAt: row.revoked_at,
          revokeReason: row.revoke_reason,
        };
  }

  async create(session: SessionRecord): Promise<void> {
    await this.database
      .insertInto('user_sessions')
      .values({
        public_id: publicIdBuffer(session.publicId),
        user_id: await resolveUserId(this.database, session.userPublicId),
        token_hash: Buffer.from(session.tokenHash),
        csrf_token_hash: Buffer.from(session.csrfTokenHash),
        is_privileged: session.isPrivileged,
        created_at: session.createdAt,
        last_seen_at: session.lastSeenAt,
        idle_expires_at: session.idleExpiresAt,
        absolute_expires_at: session.absoluteExpiresAt,
        revoked_at: session.revokedAt,
        revoke_reason: session.revokeReason,
      })
      .execute();
  }

  async countActivePrivileged(userPublicId: string, at: Date): Promise<number> {
    const row = await this.database
      .selectFrom('user_sessions')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('user_id', '=', await resolveUserId(this.database, userPublicId))
      .where('is_privileged', '=', 1)
      .where('revoked_at', 'is', null)
      .where('idle_expires_at', '>', at)
      .where('absolute_expires_at', '>', at)
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  async updateActivity(publicId: string, lastSeenAt: Date, idleExpiresAt: Date): Promise<boolean> {
    const result = await this.database
      .updateTable('user_sessions')
      .set({ last_seen_at: lastSeenAt, idle_expires_at: idleExpiresAt })
      .where('public_id', '=', publicIdBuffer(publicId))
      .where('revoked_at', 'is', null)
      .executeTakeFirst();
    return Number(result.numUpdatedRows) === 1;
  }

  async replaceCsrfTokenHash(publicId: string, csrfTokenHash: Uint8Array): Promise<boolean> {
    const result = await this.database
      .updateTable('user_sessions')
      .set({ csrf_token_hash: Buffer.from(csrfTokenHash) })
      .where('public_id', '=', publicIdBuffer(publicId))
      .where('revoked_at', 'is', null)
      .executeTakeFirst();
    return Number(result.numUpdatedRows) === 1;
  }

  async revoke(publicId: string, at: Date, reason: string): Promise<boolean> {
    const result = await this.database
      .updateTable('user_sessions')
      .set({ revoked_at: at, revoke_reason: reason })
      .where('public_id', '=', publicIdBuffer(publicId))
      .where('revoked_at', 'is', null)
      .executeTakeFirst();
    return Number(result.numUpdatedRows) === 1;
  }

  async revokeForUser(userPublicId: string, at: Date, reason: string): Promise<number> {
    const result = await this.database
      .updateTable('user_sessions')
      .set({ revoked_at: at, revoke_reason: reason })
      .where('user_id', '=', await resolveUserId(this.database, userPublicId))
      .where('revoked_at', 'is', null)
      .executeTakeFirst();
    return Number(result.numUpdatedRows);
  }

  async listForUser(userPublicId: string): Promise<readonly SessionRecord[]> {
    const userId = await resolveUserId(this.database, userPublicId);
    const tokenRows = await this.database
      .selectFrom('user_sessions')
      .select('token_hash')
      .where('user_id', '=', userId)
      .orderBy('created_at desc')
      .execute();
    return Promise.all(tokenRows.map((row) => this.findByTokenHash(row.token_hash))).then((rows) =>
      rows.filter((row): row is SessionRecord => row !== null),
    );
  }
}
