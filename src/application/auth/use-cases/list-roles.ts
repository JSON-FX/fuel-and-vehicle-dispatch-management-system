import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { RoleDto } from '@/application/auth/dto/role-administration-dtos';
import type { RoleRepository } from '@/application/auth/ports/role-repository';
import { AuthorizationError } from '@/application/shared/errors/application-error';

export class ListRoles {
  constructor(private readonly roles: RoleRepository) {}

  execute(actor: CurrentPrincipal): Promise<readonly RoleDto[]> {
    if (!actor.permissions.includes('role.read')) throw new AuthorizationError();
    return this.roles.list();
  }
}
