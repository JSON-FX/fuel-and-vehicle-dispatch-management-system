import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { PermissionDto } from '@/application/auth/dto/role-administration-dtos';
import type { PermissionRepository } from '@/application/auth/ports/permission-repository';
import { AuthorizationError } from '@/application/shared/errors/application-error';

export class ListPermissions {
  constructor(private readonly permissions: PermissionRepository) {}

  execute(actor: CurrentPrincipal): Promise<readonly PermissionDto[]> {
    if (!actor.permissions.includes('role.read')) throw new AuthorizationError();
    return this.permissions.list();
  }
}
