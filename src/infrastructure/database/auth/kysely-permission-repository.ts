import type { Kysely } from 'kysely';

import type { PermissionRepository } from '@/application/auth/ports/permission-repository';
import type { Database } from '@/infrastructure/database/types';
import { binaryToPublicId } from '@/infrastructure/database/uuid-binary';

import { publicIdBuffer, resolveRoleId } from './repository-utils';

export class KyselyPermissionRepository implements PermissionRepository {
  constructor(private readonly database: Kysely<Database>) {}

  async list() {
    const rows = await this.database
      .selectFrom('permissions')
      .selectAll()
      .orderBy('code')
      .execute();
    return rows.map((row) => ({
      publicId: binaryToPublicId(row.public_id).toString(),
      code: row.code,
      name: row.name,
      isActive: row.is_active === 1,
    }));
  }

  async replaceRolePermissions(
    rolePublicId: string,
    permissionPublicIds: readonly string[],
    at: Date,
  ): Promise<void> {
    const roleId = await resolveRoleId(this.database, rolePublicId);
    await this.database.deleteFrom('role_permissions').where('role_id', '=', roleId).execute();
    if (permissionPublicIds.length === 0) return;
    const permissionRows = await this.database
      .selectFrom('permissions')
      .select('id')
      .where(
        'public_id',
        'in',
        permissionPublicIds.map((publicId) => publicIdBuffer(publicId)),
      )
      .where('is_active', '=', 1)
      .execute();
    if (permissionRows.length !== new Set(permissionPublicIds).size) {
      throw new Error('A selected permission is unavailable.');
    }
    await this.database
      .insertInto('role_permissions')
      .values(
        permissionRows.map((permission) => ({
          role_id: roleId,
          permission_id: permission.id,
          assigned_by_user_id: null,
          created_at: at,
        })),
      )
      .execute();
  }
}
