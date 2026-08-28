import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import { AuthorizationError } from '@/application/shared/errors/application-error';
import { PermissionCode } from '@/domain/user/value-objects/permission-code';

export class AuthorizePermission {
  execute(principal: CurrentPrincipal, permission: string): void {
    const required = PermissionCode.from(permission).toString();
    if (!principal.permissions.includes(required)) throw new AuthorizationError();
  }
}
