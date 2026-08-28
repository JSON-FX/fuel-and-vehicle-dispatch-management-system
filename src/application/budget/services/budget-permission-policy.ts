import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import { AuthorizationError } from '@/application/shared/errors/application-error';

export class BudgetPermissionPolicy {
  canManage(principal: CurrentPrincipal): boolean {
    return principal.permissions.includes('budget.manage');
  }

  canRead(principal: CurrentPrincipal): boolean {
    return this.canManage(principal) || principal.permissions.includes('budget.read');
  }

  assertCanManage(principal: CurrentPrincipal): void {
    if (!this.canManage(principal)) throw new AuthorizationError();
  }

  assertCanRead(principal: CurrentPrincipal): void {
    if (!this.canRead(principal)) throw new AuthorizationError();
  }
}
