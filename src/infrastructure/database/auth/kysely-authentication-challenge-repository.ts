import type { Kysely } from 'kysely';

import type {
  AuthenticationChallengeRecord,
  AuthenticationChallengeRepository,
} from '@/application/auth/ports/authentication-challenge-repository';
import type { Database } from '@/infrastructure/database/types';
import { binaryToPublicId } from '@/infrastructure/database/uuid-binary';

import { publicIdBuffer, resolveUserId } from './repository-utils';

export class KyselyAuthenticationChallengeRepository implements AuthenticationChallengeRepository {
  constructor(private readonly database: Kysely<Database>) {}

  async findByTokenHash(tokenHash: Uint8Array): Promise<AuthenticationChallengeRecord | null> {
    const row = await this.database
      .selectFrom('authentication_challenges')
      .innerJoin('users', 'users.id', 'authentication_challenges.user_id')
      .select([
        'authentication_challenges.public_id',
        'users.public_id as user_public_id',
        'authentication_challenges.token_hash',
        'authentication_challenges.csrf_token_hash',
        'authentication_challenges.challenge_type',
        'authentication_challenges.failed_attempts',
        'authentication_challenges.expires_at',
        'authentication_challenges.consumed_at',
        'authentication_challenges.created_at',
      ])
      .where('authentication_challenges.token_hash', '=', Buffer.from(tokenHash))
      .executeTakeFirst();
    return row === undefined
      ? null
      : {
          publicId: binaryToPublicId(row.public_id).toString(),
          userPublicId: binaryToPublicId(row.user_public_id).toString(),
          tokenHash: row.token_hash,
          csrfTokenHash: row.csrf_token_hash,
          type: row.challenge_type,
          failedAttempts: row.failed_attempts,
          expiresAt: row.expires_at,
          consumedAt: row.consumed_at,
          createdAt: row.created_at,
        };
  }

  async create(challenge: AuthenticationChallengeRecord): Promise<void> {
    await this.database
      .insertInto('authentication_challenges')
      .values({
        public_id: publicIdBuffer(challenge.publicId),
        user_id: await resolveUserId(this.database, challenge.userPublicId),
        token_hash: Buffer.from(challenge.tokenHash),
        csrf_token_hash: Buffer.from(challenge.csrfTokenHash),
        challenge_type: challenge.type,
        failed_attempts: challenge.failedAttempts,
        expires_at: challenge.expiresAt,
        consumed_at: challenge.consumedAt,
        created_at: challenge.createdAt,
      })
      .execute();
  }

  async incrementFailure(publicId: string): Promise<number> {
    await this.database
      .updateTable('authentication_challenges')
      .set((expression) => ({ failed_attempts: expression('failed_attempts', '+', 1) }))
      .where('public_id', '=', publicIdBuffer(publicId))
      .where('consumed_at', 'is', null)
      .executeTakeFirst();
    const row = await this.database
      .selectFrom('authentication_challenges')
      .select('failed_attempts')
      .where('public_id', '=', publicIdBuffer(publicId))
      .executeTakeFirst();
    return row?.failed_attempts ?? 0;
  }

  async replaceCsrfTokenHash(publicId: string, csrfTokenHash: Uint8Array): Promise<boolean> {
    const result = await this.database
      .updateTable('authentication_challenges')
      .set({ csrf_token_hash: Buffer.from(csrfTokenHash) })
      .where('public_id', '=', publicIdBuffer(publicId))
      .where('consumed_at', 'is', null)
      .executeTakeFirst();
    return Number(result.numUpdatedRows) === 1;
  }

  async consume(publicId: string, at: Date): Promise<boolean> {
    const result = await this.database
      .updateTable('authentication_challenges')
      .set({ consumed_at: at })
      .where('public_id', '=', publicIdBuffer(publicId))
      .where('consumed_at', 'is', null)
      .executeTakeFirst();
    return Number(result.numUpdatedRows) === 1;
  }

  async revokeForUser(userPublicId: string, at: Date): Promise<number> {
    const result = await this.database
      .updateTable('authentication_challenges')
      .set({ consumed_at: at })
      .where('user_id', '=', await resolveUserId(this.database, userPublicId))
      .where('consumed_at', 'is', null)
      .executeTakeFirst();
    return Number(result.numUpdatedRows);
  }
}
