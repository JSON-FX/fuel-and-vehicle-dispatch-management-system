import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { UserDetailDto } from '@/application/auth/dto/user-administration-dtos';
import type { UserRepository } from '@/application/auth/ports/user-repository';
import { AuthorizationError, NotFoundError } from '@/application/shared/errors/application-error';

export class GetUser {
  constructor(private readonly users: UserRepository) {}
  async execute(actor: CurrentPrincipal, publicId: string): Promise<UserDetailDto> {
    if (!actor.permissions.includes('user.read')) throw new AuthorizationError();
    const user = await this.users.findByPublicId(publicId);
    if (user === null) throw new NotFoundError();
    return {
      publicId: user.publicId,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
      isDeleted: user.deletedAt !== null,
      mustChangePassword: user.mustChangePassword,
      mfaEnrolled: user.mfaEnrolled,
      roles: user.roles,
      permissions: user.permissions,
      isPrivileged: user.isPrivileged,
    };
  }
}
