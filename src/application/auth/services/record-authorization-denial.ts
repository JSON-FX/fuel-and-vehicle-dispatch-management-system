import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { AuthTransaction } from '@/application/auth/ports/auth-transaction';
import type { Clock } from '@/application/auth/ports/clock';
import { buildAuthenticationAuditEvent } from '@/application/auth/services/auth-audit-events';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';

export interface AuthorizationDenialInput {
  readonly principal: CurrentPrincipal;
  readonly permission: string;
  readonly requestId: string;
  readonly routeTemplate: string;
  readonly sourceAddress: string | null;
  readonly userAgent: string | null;
}

export class RecordAuthorizationDenial {
  constructor(
    private readonly dependencies: {
      readonly transaction: AuthTransaction;
      readonly publicIds: PublicIdGenerator;
      readonly clock: Clock;
    },
  ) {}

  execute(input: AuthorizationDenialInput): Promise<void> {
    return this.dependencies.transaction.execute(({ auditEvents }) =>
      auditEvents.append(
        buildAuthenticationAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          action: 'auth.authorization.denied',
          actorPublicId: input.principal.userPublicId,
          targetPublicId: null,
          requestId: input.requestId,
          ipAddress: input.sourceAddress,
          userAgent: input.userAgent,
          reasonCode: 'permission_denied',
          metadata: {
            requiredPermission: input.permission,
            routeTemplate: input.routeTemplate,
          },
          occurredAt: this.dependencies.clock.now(),
        }),
      ),
    );
  }
}
