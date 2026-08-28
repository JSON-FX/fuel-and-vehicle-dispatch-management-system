import type { Kysely, Updateable } from 'kysely';

import type { RoleDto } from '@/application/auth/dto/role-administration-dtos';
import type { RoleRepository } from '@/application/auth/ports/role-repository';
import type { Database, RolesTable } from '@/infrastructure/database/types';
import { binaryToPublicId } from '@/infrastructure/database/uuid-binary';

import { publicIdBuffer, resolveRoleId, resolveUserId } from './repository-utils';

export class KyselyRoleRepository implements RoleRepository {
  constructor(private readonly database: Kysely<Database>) {}

  async list(): Promise<readonly RoleDto[]> {
    const rows = await this.database.selectFrom('roles').selectAll().orderBy('code').execute();
    return Promise.all(rows.map((row) => this.mapRole(row)));
  }

  async findByPublicId(publicId: string): Promise<RoleDto | null> {
    const row = await this.database
      .selectFrom('roles')
      .selectAll()
      .where('public_id', '=', publicIdBuffer(publicId))
      .executeTakeFirst();
    return row === undefined ? null : this.mapRole(row);
  }

  async findByPublicIds(publicIds: readonly string[]): Promise<readonly RoleDto[]> {
    if (publicIds.length === 0) return [];
    const rows = await this.database
      .selectFrom('roles')
      .selectAll()
      .where(
        'public_id',
        'in',
        publicIds.map((publicId) => publicIdBuffer(publicId)),
      )
      .orderBy('code')
      .execute();
    return Promise.all(rows.map((row) => this.mapRole(row)));
  }

  async create(input: {
    readonly publicId: string;
    readonly code: string;
    readonly name: string;
    readonly isPrivileged: boolean;
    readonly createdAt: Date;
  }): Promise<void> {
    await this.database
      .insertInto('roles')
      .values({
        public_id: publicIdBuffer(input.publicId),
        code: input.code,
        name: input.name,
        is_privileged: input.isPrivileged,
        is_active: true,
        is_system: false,
        created_at: input.createdAt,
        updated_at: input.createdAt,
      })
      .execute();
  }

  async update(input: {
    readonly publicId: string;
    readonly name?: string;
    readonly isPrivileged?: boolean;
    readonly isActive?: boolean;
    readonly updatedAt: Date;
  }): Promise<boolean> {
    const values: Updateable<RolesTable> = { updated_at: input.updatedAt };
    if (input.name !== undefined) values.name = input.name;
    if (input.isPrivileged !== undefined) values.is_privileged = input.isPrivileged;
    if (input.isActive !== undefined) values.is_active = input.isActive;
    const result = await this.database
      .updateTable('roles')
      .set(values)
      .where('public_id', '=', publicIdBuffer(input.publicId))
      .executeTakeFirst();
    return Number(result.numUpdatedRows) === 1;
  }

  async replaceUserRoles(
    userPublicId: string,
    rolePublicIds: readonly string[],
    at: Date,
  ): Promise<void> {
    const userId = await resolveUserId(this.database, userPublicId);
    await this.database.deleteFrom('user_roles').where('user_id', '=', userId).execute();
    if (rolePublicIds.length === 0) return;
    const roleRows = await this.database
      .selectFrom('roles')
      .select('id')
      .where(
        'public_id',
        'in',
        rolePublicIds.map((publicId) => publicIdBuffer(publicId)),
      )
      .where('is_active', '=', 1)
      .execute();
    if (roleRows.length !== new Set(rolePublicIds).size)
      throw new Error('A selected role is unavailable.');
    await this.database
      .insertInto('user_roles')
      .values(
        roleRows.map((role) => ({
          user_id: userId,
          role_id: role.id,
          assigned_by_user_id: null,
          created_at: at,
        })),
      )
      .execute();
  }

  async userPublicIdsForRole(rolePublicId: string): Promise<readonly string[]> {
    const roleId = await resolveRoleId(this.database, rolePublicId);
    const rows = await this.database
      .selectFrom('user_roles')
      .innerJoin('users', 'users.id', 'user_roles.user_id')
      .select('users.public_id')
      .where('user_roles.role_id', '=', roleId)
      .execute();
    return rows.map((row) => binaryToPublicId(row.public_id).toString());
  }

  private async mapRole(row: {
    readonly id: string;
    readonly public_id: Buffer;
    readonly code: string;
    readonly name: string;
    readonly is_privileged: number;
    readonly is_active: number;
    readonly is_system: number;
  }): Promise<RoleDto> {
    const permissionRows = await this.database
      .selectFrom('role_permissions')
      .innerJoin('permissions', 'permissions.id', 'role_permissions.permission_id')
      .select('permissions.code')
      .where('role_permissions.role_id', '=', row.id)
      .where('permissions.is_active', '=', 1)
      .orderBy('permissions.code')
      .execute();
    return {
      publicId: binaryToPublicId(row.public_id).toString(),
      code: row.code,
      name: row.name,
      isPrivileged: row.is_privileged === 1,
      isActive: row.is_active === 1,
      isSystem: row.is_system === 1,
      permissions: permissionRows.map((permission) => permission.code),
    };
  }
}
