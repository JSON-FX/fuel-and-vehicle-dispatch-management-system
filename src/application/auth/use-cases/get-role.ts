import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { RoleDto } from '@/application/auth/dto/role-administration-dtos';
import type { RoleRepository } from '@/application/auth/ports/role-repository';
import { AuthorizationError, NotFoundError } from '@/application/shared/errors/application-error';

export class GetRole {
  constructor(private readonly roles: RoleRepository) {}

  async execute(actor: CurrentPrincipal, publicId: string): Promise<RoleDto> {
    if (!actor.permissions.includes('role.read')) throw new AuthorizationError();
    const role = await this.roles.findByPublicId(publicId);
    if (role === null) throw new NotFoundError();
    return role;
  }
}
