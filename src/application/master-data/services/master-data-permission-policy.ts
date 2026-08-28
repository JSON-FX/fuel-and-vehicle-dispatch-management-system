import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { MasterDataResource } from '@/application/master-data/dto/master-data-list-dtos';
import { AuthorizationError } from '@/application/shared/errors/application-error';

export class MasterDataPermissionPolicy {
  canManage(principal: CurrentPrincipal, resource: MasterDataResource): boolean {
    return principal.permissions.includes(`${resource}.manage`);
  }

  canRead(principal: CurrentPrincipal, resource: MasterDataResource): boolean {
    return (
      this.canManage(principal, resource) || principal.permissions.includes(`${resource}.read`)
    );
  }

  assertCanManage(principal: CurrentPrincipal, resource: MasterDataResource): void {
    if (!this.canManage(principal, resource)) throw new AuthorizationError();
  }

  assertCanRead(principal: CurrentPrincipal, resource: MasterDataResource): void {
    if (!this.canRead(principal, resource)) throw new AuthorizationError();
  }
}
