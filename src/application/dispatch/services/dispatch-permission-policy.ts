import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import { AuthorizationError } from '@/application/shared/errors/application-error';
import type { VehicleDispatch } from '@/domain/dispatch/entities/vehicle-dispatch';

export class DispatchPermissionPolicy {
  canCreate(principal: CurrentPrincipal): boolean {
    return principal.permissions.includes('dispatch.create');
  }

  canRead(principal: CurrentPrincipal): boolean {
    return principal.permissions.includes('dispatch.read');
  }

  canUpdate(principal: CurrentPrincipal): boolean {
    return principal.permissions.includes('dispatch.update');
  }

  canComplete(principal: CurrentPrincipal): boolean {
    return principal.permissions.includes('dispatch.complete');
  }

  canCancel(principal: CurrentPrincipal): boolean {
    return principal.permissions.includes('dispatch.cancel');
  }

  canOverrideConflict(principal: CurrentPrincipal): boolean {
    return principal.permissions.includes('dispatch.conflict.override');
  }

  canManageSettings(principal: CurrentPrincipal): boolean {
    return principal.permissions.includes('dispatch.settings.manage');
  }

  assertCanCreate(principal: CurrentPrincipal): void {
    if (!this.canCreate(principal)) throw new AuthorizationError();
  }

  assertCanRead(principal: CurrentPrincipal, dispatch?: VehicleDispatch): void {
    void dispatch;
    if (!this.canRead(principal)) throw new AuthorizationError();
  }

  assertCanUpdate(principal: CurrentPrincipal, dispatch?: VehicleDispatch): void {
    void dispatch;
    if (!this.canUpdate(principal)) throw new AuthorizationError();
  }

  assertCanComplete(principal: CurrentPrincipal, dispatch?: VehicleDispatch): void {
    void dispatch;
    if (!this.canComplete(principal)) throw new AuthorizationError();
  }

  assertCanCancel(principal: CurrentPrincipal, dispatch?: VehicleDispatch): void {
    void dispatch;
    if (!this.canCancel(principal)) throw new AuthorizationError();
  }

  assertCanOverrideConflict(principal: CurrentPrincipal): void {
    if (!this.canOverrideConflict(principal)) throw new AuthorizationError();
  }

  assertCanManageSettings(principal: CurrentPrincipal): void {
    if (!this.canManageSettings(principal)) throw new AuthorizationError();
  }
}
