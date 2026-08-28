import type { Kysely } from 'kysely';

import type {
  TotpFactorRecord,
  TotpFactorRepository,
} from '@/application/auth/ports/totp-factor-repository';
import type { Database } from '@/infrastructure/database/types';
import { binaryToPublicId } from '@/infrastructure/database/uuid-binary';

import { publicIdBuffer, resolveUserId } from './repository-utils';

export class KyselyTotpFactorRepository implements TotpFactorRepository {
  constructor(private readonly database: Kysely<Database>) {}

  async findForUser(userPublicId: string): Promise<TotpFactorRecord | null> {
    const row = await this.database
      .selectFrom('user_totp_factors')
      .innerJoin('users', 'users.id', 'user_totp_factors.user_id')
      .select([
        'user_totp_factors.public_id',
        'users.public_id as user_public_id',
        'user_totp_factors.status',
        'user_totp_factors.secret_ciphertext',
        'user_totp_factors.secret_iv',
        'user_totp_factors.secret_auth_tag',
        'user_totp_factors.key_version',
        'user_totp_factors.last_used_counter',
        'user_totp_factors.confirmed_at',
        'user_totp_factors.created_at',
        'user_totp_factors.updated_at',
      ])
      .where('users.public_id', '=', publicIdBuffer(userPublicId))
      .executeTakeFirst();
    return row === undefined
      ? null
      : {
          publicId: binaryToPublicId(row.public_id).toString(),
          userPublicId: binaryToPublicId(row.user_public_id).toString(),
          status: row.status,
          encryptedSecret: {
            ciphertext: row.secret_ciphertext,
            iv: row.secret_iv,
            authenticationTag: row.secret_auth_tag,
            keyVersion: row.key_version,
          },
          lastUsedCounter: row.last_used_counter === null ? null : Number(row.last_used_counter),
          confirmedAt: row.confirmed_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
  }

  async save(factor: TotpFactorRecord): Promise<void> {
    const userId = await resolveUserId(this.database, factor.userPublicId);
    const existing = await this.database
      .selectFrom('user_totp_factors')
      .select('id')
      .where('user_id', '=', userId)
      .forUpdate()
      .executeTakeFirst();
    const values = {
      public_id: publicIdBuffer(factor.publicId),
      user_id: userId,
      status: factor.status,
      secret_ciphertext: Buffer.from(factor.encryptedSecret.ciphertext),
      secret_iv: Buffer.from(factor.encryptedSecret.iv),
      secret_auth_tag: Buffer.from(factor.encryptedSecret.authenticationTag),
      key_version: factor.encryptedSecret.keyVersion,
      last_used_counter: factor.lastUsedCounter,
      confirmed_at: factor.confirmedAt,
      updated_at: factor.updatedAt,
    } as const;
    if (existing === undefined) {
      await this.database
        .insertInto('user_totp_factors')
        .values({ ...values, created_at: factor.createdAt })
        .execute();
    } else {
      await this.database
        .updateTable('user_totp_factors')
        .set(values)
        .where('id', '=', existing.id)
        .execute();
    }
  }

  async enable(publicId: string, confirmedAt: Date, counter: number): Promise<boolean> {
    const result = await this.database
      .updateTable('user_totp_factors')
      .set({
        status: 'ENABLED',
        confirmed_at: confirmedAt,
        last_used_counter: counter,
        updated_at: confirmedAt,
      })
      .where('public_id', '=', publicIdBuffer(publicId))
      .where('status', '=', 'PENDING')
      .executeTakeFirst();
    return Number(result.numUpdatedRows) === 1;
  }

  async acceptCounter(publicId: string, counter: number, updatedAt: Date): Promise<boolean> {
    const result = await this.database
      .updateTable('user_totp_factors')
      .set({ last_used_counter: counter, updated_at: updatedAt })
      .where('public_id', '=', publicIdBuffer(publicId))
      .where('status', '=', 'ENABLED')
      .where((expression) =>
        expression.or([
          expression('last_used_counter', 'is', null),
          expression('last_used_counter', '<', String(counter)),
        ]),
      )
      .executeTakeFirst();
    return Number(result.numUpdatedRows) === 1;
  }

  async disableForUser(userPublicId: string, updatedAt: Date): Promise<boolean> {
    const result = await this.database
      .updateTable('user_totp_factors')
      .set({ status: 'DISABLED', updated_at: updatedAt })
      .where('user_id', '=', await resolveUserId(this.database, userPublicId))
      .where('status', '!=', 'DISABLED')
      .executeTakeFirst();
    return Number(result.numUpdatedRows) === 1;
  }
}
