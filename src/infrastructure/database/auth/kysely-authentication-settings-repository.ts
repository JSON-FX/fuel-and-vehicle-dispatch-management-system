import type { Kysely } from 'kysely';

import type {
  AuthenticationSettingsRecord,
  AuthenticationSettingsRepository,
} from '@/application/auth/ports/authentication-settings-repository';
import type { Database } from '@/infrastructure/database/types';
import { binaryToPublicId } from '@/infrastructure/database/uuid-binary';

import { resolveUserId } from './repository-utils';

export class KyselyAuthenticationSettingsRepository implements AuthenticationSettingsRepository {
  constructor(private readonly database: Kysely<Database>) {}

  async get(): Promise<AuthenticationSettingsRecord> {
    const row = await this.database
      .selectFrom('authentication_settings')
      .leftJoin('users', 'users.id', 'authentication_settings.updated_by_user_id')
      .select([
        'authentication_settings.mfa_required',
        'authentication_settings.updated_at',
        'users.public_id as updated_by_public_id',
      ])
      .where('authentication_settings.id', '=', 1)
      .executeTakeFirstOrThrow();

    return {
      mfaRequired: row.mfa_required === 1,
      updatedAt: row.updated_at,
      updatedByUserPublicId:
        row.updated_by_public_id === null
          ? null
          : binaryToPublicId(row.updated_by_public_id).toString(),
    };
  }

  async update(input: {
    readonly mfaRequired: boolean;
    readonly updatedAt: Date;
    readonly updatedByUserPublicId: string;
  }): Promise<AuthenticationSettingsRecord> {
    await this.database
      .updateTable('authentication_settings')
      .set({
        mfa_required: input.mfaRequired,
        updated_at: input.updatedAt,
        updated_by_user_id: await resolveUserId(this.database, input.updatedByUserPublicId),
      })
      .where('id', '=', 1)
      .executeTakeFirstOrThrow();
    return this.get();
  }
}
