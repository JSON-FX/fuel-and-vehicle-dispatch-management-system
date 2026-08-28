import type { AuditEventDetailDto } from '@/application/audit/dto/audit-event-dtos';
import type { AuditReadTransaction } from '@/application/audit/ports/audit-read-transaction';
import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { Clock } from '@/application/auth/ports/clock';
import { NotFoundError, ValidationError } from '@/application/shared/errors/application-error';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';
import { DomainError } from '@/domain/shared/errors/domain-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';

import { buildAuditAccessEvent } from './audit-access-event';

export class GetAuditEvent {
  constructor(
    private readonly dependencies: {
      readonly transaction: AuditReadTransaction;
      readonly publicIds: PublicIdGenerator;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    readonly actor: CurrentPrincipal;
    readonly eventPublicId: string;
    readonly requestId: string;
    readonly ipAddress: string | null;
    readonly userAgent: string | null;
  }): Promise<AuditEventDetailDto> {
    let eventPublicId: string;
    try {
      eventPublicId = PublicId.from(input.eventPublicId).toString();
    } catch (error) {
      if (error instanceof DomainError) throw new ValidationError();
      throw error;
    }
    const includeSensitive = input.actor.permissions.includes('audit.read_sensitive');
    return this.dependencies.transaction.execute(async ({ queries, auditEvents }) => {
      const detail = await queries.findByPublicId(eventPublicId, includeSensitive);
      if (detail === null) throw new NotFoundError();
      await auditEvents.append(
        buildAuditAccessEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          occurredAt: this.dependencies.clock.now(),
          actorPublicId: input.actor.userPublicId,
          requestId: input.requestId,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          entityPublicId: eventPublicId,
          metadata: { accessType: 'detail', sensitiveContextIncluded: includeSensitive },
        }),
      );
      return detail;
    });
  }
}
