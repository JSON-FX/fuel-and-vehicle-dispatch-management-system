import type { Kysely } from 'kysely';

import { createCurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type {
  ReportRequesterRecord,
  ReportRequesterRepository,
} from '@/application/reporting/ports/report-requester-repository';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import type { Database } from '@/infrastructure/database/types';
import { publicIdToBinary } from '@/infrastructure/database/uuid-binary';

export class KyselyReportRequesterRepository implements ReportRequesterRepository {
  constructor(private readonly database: Kysely<Database>) {}

  async findByPublicId(publicId: string): Promise<ReportRequesterRecord | null> {
    const user = await this.database
      .selectFrom('users')
      .select(['id', 'username', 'full_name', 'is_active', 'must_change_password', 'deleted_at'])
      .where('public_id', '=', publicIdToBinary(PublicId.from(publicId)))
      .executeTakeFirst();
    if (user === undefined) return null;

    const roles = await this.database
      .selectFrom('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .select(['roles.code', 'roles.is_privileged'])
      .where('user_roles.user_id', '=', user.id)
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
      .where('user_roles.user_id', '=', user.id)
      .where('roles.is_active', '=', 1)
      .where('permissions.is_active', '=', 1)
      .orderBy('permissions.code')
      .execute();
    const mfa = await this.database
      .selectFrom('user_totp_factors')
      .select('id')
      .where('user_id', '=', user.id)
      .where('status', '=', 'ENABLED')
      .executeTakeFirst();

    return {
      id: user.id,
      isActive: user.is_active === 1,
      deletedAt: user.deleted_at,
      principal: createCurrentPrincipal({
        userPublicId: publicId,
        username: user.username,
        fullName: user.full_name,
        roles: roles.map((role) => role.code),
        permissions: permissions.map((permission) => permission.code),
        isPrivileged: roles.some((role) => role.is_privileged === 1),
        mustChangePassword: user.must_change_password === 1,
        mfaEnrolled: mfa !== undefined,
      }),
    };
  }
}
