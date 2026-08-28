import type { Kysely } from 'kysely';

import { NotFoundError } from '@/application/shared/errors/application-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import type { Database } from '@/infrastructure/database/types';
import { publicIdToBinary } from '@/infrastructure/database/uuid-binary';

export function publicIdBuffer(publicId: string): Buffer {
  return publicIdToBinary(PublicId.from(publicId));
}

export async function resolveUserId(database: Kysely<Database>, publicId: string): Promise<string> {
  const row = await database
    .selectFrom('users')
    .select('id')
    .where('public_id', '=', publicIdBuffer(publicId))
    .executeTakeFirst();
  if (row === undefined) throw new NotFoundError();
  return row.id;
}

export async function resolveRoleId(database: Kysely<Database>, publicId: string): Promise<string> {
  const row = await database
    .selectFrom('roles')
    .select('id')
    .where('public_id', '=', publicIdBuffer(publicId))
    .executeTakeFirst();
  if (row === undefined) throw new NotFoundError();
  return row.id;
}
