import type { Kysely, Updateable } from 'kysely';

import type {
  NewUserRecord,
  UserAuthenticationRecord,
  UserRepository,
} from '@/application/auth/ports/user-repository';
import type { Database, UsersTable } from '@/infrastructure/database/types';
import { binaryToPublicId } from '@/infrastructure/database/uuid-binary';

import { publicIdBuffer } from './repository-utils';

export class KyselyUserRepository implements UserRepository {
  constructor(private readonly database: Kysely<Database>) {}

  async findForAuthentication(username: string): Promise<UserAuthenticationRecord | null> {
    const row = await this.database
      .selectFrom('users')
      .selectAll()
      .where('username', '=', username)
      .executeTakeFirst();
    return row === undefined ? null : this.mapUser(row);
  }

  async findByPublicId(publicId: string): Promise<UserAuthenticationRecord | null> {
    const row = await this.database
      .selectFrom('users')
      .selectAll()
      .where('public_id', '=', publicIdBuffer(publicId))
      .executeTakeFirst();
    return row === undefined ? null : this.mapUser(row);
  }

  async list(input: {
    readonly page: number;
    readonly pageSize: number;
    readonly query?: string;
  }): Promise<{ readonly users: readonly UserAuthenticationRecord[]; readonly total: number }> {
    let query = this.database.selectFrom('users').selectAll();
    let countQuery = this.database
      .selectFrom('users')
      .select((expression) => expression.fn.countAll<string>().as('count'));

    if (input.query !== undefined && input.query.trim() !== '') {
      const pattern = `%${input.query.trim()}%`;
      query = query.where((expression) =>
        expression.or([
          expression('username', 'like', pattern),
          expression('email', 'like', pattern),
          expression('full_name', 'like', pattern),
        ]),
      );
      countQuery = countQuery.where((expression) =>
        expression.or([
          expression('username', 'like', pattern),
          expression('email', 'like', pattern),
          expression('full_name', 'like', pattern),
        ]),
      );
    }

    const [rows, count] = await Promise.all([
      query
        .orderBy('username')
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize)
        .execute(),
      countQuery.executeTakeFirstOrThrow(),
    ]);

    return {
      users: await Promise.all(rows.map((row) => this.mapUser(row))),
      total: Number(count.count),
    };
  }

  async create(user: NewUserRecord): Promise<void> {
    await this.database
      .insertInto('users')
      .values({
        public_id: publicIdBuffer(user.publicId),
        username: user.username,
        email: user.email,
        full_name: user.fullName,
        password_hash: user.passwordHash,
        is_active: true,
        must_change_password: user.mustChangePassword,
        deleted_at: null,
        created_at: user.createdAt,
        updated_at: user.createdAt,
      })
      .execute();
  }

  async updateIdentity(input: {
    readonly publicId: string;
    readonly email?: string;
    readonly fullName?: string;
    readonly isActive?: boolean;
    readonly updatedAt: Date;
  }): Promise<boolean> {
    const values: Updateable<UsersTable> = { updated_at: input.updatedAt };
    if (input.email !== undefined) values.email = input.email;
    if (input.fullName !== undefined) values.full_name = input.fullName;
    if (input.isActive !== undefined) values.is_active = input.isActive;
    const result = await this.database
      .updateTable('users')
      .set(values)
      .where('public_id', '=', publicIdBuffer(input.publicId))
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    return Number(result.numUpdatedRows) === 1;
  }

  async updatePassword(input: {
    readonly publicId: string;
    readonly passwordHash: string;
    readonly mustChangePassword: boolean;
    readonly updatedAt: Date;
  }): Promise<boolean> {
    const result = await this.database
      .updateTable('users')
      .set({
        password_hash: input.passwordHash,
        must_change_password: input.mustChangePassword,
        updated_at: input.updatedAt,
      })
      .where('public_id', '=', publicIdBuffer(input.publicId))
      .executeTakeFirst();
    return Number(result.numUpdatedRows) === 1;
  }

  async softDelete(publicId: string, deletedAt: Date): Promise<boolean> {
    const result = await this.database
      .updateTable('users')
      .set({ deleted_at: deletedAt, is_active: false, updated_at: deletedAt })
      .where('public_id', '=', publicIdBuffer(publicId))
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    return Number(result.numUpdatedRows) === 1;
  }

  async restoreInactive(publicId: string, updatedAt: Date): Promise<boolean> {
    const result = await this.database
      .updateTable('users')
      .set({ deleted_at: null, is_active: false, updated_at: updatedAt })
      .where('public_id', '=', publicIdBuffer(publicId))
      .where('deleted_at', 'is not', null)
      .executeTakeFirst();
    return Number(result.numUpdatedRows) === 1;
  }

  async countActiveUsersWithRole(roleCode: string): Promise<number> {
    const row = await this.database
      .selectFrom('users')
      .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('roles.code', '=', roleCode)
      .where('roles.is_active', '=', 1)
      .where('users.is_active', '=', 1)
      .where('users.deleted_at', 'is', null)
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  private async mapUser(
    row: Awaited<ReturnType<KyselyUserRepository['loadRawUser']>>,
  ): Promise<UserAuthenticationRecord> {
    const roles = await this.database
      .selectFrom('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .select(['roles.code', 'roles.is_privileged'])
      .where('user_roles.user_id', '=', row.id)
      .where('roles.is_active', '=', 1)
      .orderBy('roles.code')
      .execute();
    const permissions = await this.database
      .selectFrom('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .innerJoin('role_permissions', 'role_permissions.role_id', 'roles.id')
      .innerJoin('permissions', 'permissions.id', 'role_permissions.permission_id')
      .select('permissions.code')
      .distinct()
      .where('user_roles.user_id', '=', row.id)
      .where('roles.is_active', '=', 1)
      .where('permissions.is_active', '=', 1)
      .orderBy('permissions.code')
      .execute();
    const factor = await this.database
      .selectFrom('user_totp_factors')
      .select('status')
      .where('user_id', '=', row.id)
      .executeTakeFirst();

    return {
      publicId: binaryToPublicId(row.public_id).toString(),
      username: row.username,
      email: row.email,
      fullName: row.full_name,
      passwordHash: row.password_hash,
      isActive: row.is_active === 1,
      mustChangePassword: row.must_change_password === 1,
      deletedAt: row.deleted_at,
      roles: roles.map((role) => role.code),
      permissions: permissions.map((permission) => permission.code),
      isPrivileged: roles.some((role) => role.is_privileged === 1),
      mfaEnrolled: factor?.status === 'ENABLED',
    };
  }

  private async loadRawUser() {
    return this.database.selectFrom('users').selectAll().executeTakeFirstOrThrow();
  }
}
