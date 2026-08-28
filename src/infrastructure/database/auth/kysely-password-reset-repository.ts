import type { Kysely } from 'kysely';

import type { PasswordResetRepository } from '@/application/auth/ports/password-reset-repository';
import type { Database } from '@/infrastructure/database/types';

import { publicIdBuffer, resolveUserId } from './repository-utils';

export class KyselyPasswordResetRepository implements PasswordResetRepository {
  constructor(private readonly database: Kysely<Database>) {}

  async record(input: {
    readonly publicId: string;
    readonly actorPublicId: string;
    readonly targetPublicId: string;
    readonly requestId: string;
    readonly reason: string;
    readonly createdAt: Date;
  }): Promise<void> {
    await this.database
      .insertInto('admin_password_resets')
      .values({
        public_id: publicIdBuffer(input.publicId),
        actor_user_id: await resolveUserId(this.database, input.actorPublicId),
        target_user_id: await resolveUserId(this.database, input.targetPublicId),
        request_id: input.requestId,
        reason: input.reason,
        created_at: input.createdAt,
      })
      .execute();
  }
}
