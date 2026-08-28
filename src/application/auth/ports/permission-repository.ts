import type { PermissionDto } from '@/application/auth/dto/role-administration-dtos';

export interface PermissionRepository {
  list(): Promise<readonly PermissionDto[]>;
  replaceRolePermissions(
    rolePublicId: string,
    permissionPublicIds: readonly string[],
    at: Date,
  ): Promise<void>;
}
