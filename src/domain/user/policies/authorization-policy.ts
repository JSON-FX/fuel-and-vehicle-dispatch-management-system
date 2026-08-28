import { DomainError } from '@/domain/shared/errors/domain-error';
import type { PermissionCode } from '@/domain/user/value-objects/permission-code';

export class AuthorizationPolicy {
  assertPermission(activePermissions: ReadonlySet<string>, required: PermissionCode): void {
    if (!activePermissions.has(required.toString())) {
      throw new DomainError('PERMISSION_DENIED', 'The required permission is not active.');
    }
  }

  assertDifferentActor(actorPublicId: string, targetPublicId: string): void {
    if (actorPublicId === targetPublicId) {
      throw new DomainError(
        'SELF_SECURITY_CHANGE_FORBIDDEN',
        'Administrators cannot change their own administrative security state.',
      );
    }
  }
}
