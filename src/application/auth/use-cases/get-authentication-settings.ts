import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type {
  AuthenticationSettingsRecord,
  AuthenticationSettingsRepository,
} from '@/application/auth/ports/authentication-settings-repository';
import { AuthorizationError } from '@/application/shared/errors/application-error';

export class GetAuthenticationSettings {
  constructor(private readonly settings: Pick<AuthenticationSettingsRepository, 'get'>) {}

  execute(actor: CurrentPrincipal): Promise<AuthenticationSettingsRecord> {
    assertSettingsPermission(actor);
    return this.settings.get();
  }
}

export function assertSettingsPermission(actor: CurrentPrincipal): void {
  if (!actor.permissions.includes('auth.settings.manage')) throw new AuthorizationError();
}
