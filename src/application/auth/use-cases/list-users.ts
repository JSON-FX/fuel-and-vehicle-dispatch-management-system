import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { PaginatedUsersDto } from '@/application/auth/dto/user-administration-dtos';
import type { UserRepository } from '@/application/auth/ports/user-repository';
import { AuthorizationError, ValidationError } from '@/application/shared/errors/application-error';

export class ListUsers {
  constructor(private readonly users: UserRepository) {}
  async execute(input: {
    readonly actor: CurrentPrincipal;
    readonly page: number;
    readonly pageSize: number;
    readonly query?: string;
  }): Promise<PaginatedUsersDto> {
    if (!input.actor.permissions.includes('user.read')) throw new AuthorizationError();
    if (input.page < 1 || input.pageSize < 1 || input.pageSize > 100) throw new ValidationError();
    const result = await this.users.list(input);
    return {
      items: result.users.map((user) => ({
        publicId: user.publicId,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        isActive: user.isActive,
        isDeleted: user.deletedAt !== null,
        mustChangePassword: user.mustChangePassword,
        mfaEnrolled: user.mfaEnrolled,
        roles: user.roles,
      })),
      page: input.page,
      pageSize: input.pageSize,
      total: result.total,
    };
  }
}
