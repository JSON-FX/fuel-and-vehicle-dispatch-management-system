import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import { AuthorizationError } from '@/application/shared/errors/application-error';

export class FuelPermissionPolicy {
  canCreate(principal: CurrentPrincipal): boolean {
    return principal.permissions.includes('fuel.create');
  }

  canRead(principal: CurrentPrincipal): boolean {
    return principal.permissions.includes('fuel.read');
  }

  canPost(principal: CurrentPrincipal): boolean {
    return principal.permissions.includes('fuel.post');
  }

  canVoid(principal: CurrentPrincipal): boolean {
    return principal.permissions.includes('fuel.void');
  }

  assertCanCreate(principal: CurrentPrincipal): void {
    if (!this.canCreate(principal)) throw new AuthorizationError();
  }

  assertCanRead(principal: CurrentPrincipal): void {
    if (!this.canRead(principal)) throw new AuthorizationError();
  }

  assertCanPost(principal: CurrentPrincipal): void {
    if (!this.canPost(principal)) throw new AuthorizationError();
  }

  assertCanVoid(principal: CurrentPrincipal): void {
    if (!this.canVoid(principal)) throw new AuthorizationError();
  }
}
