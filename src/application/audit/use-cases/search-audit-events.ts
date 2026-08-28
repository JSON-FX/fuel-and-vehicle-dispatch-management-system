import type { AuditEventPageDto, AuditSearchQuery } from '@/application/audit/dto/audit-event-dtos';
import type { AuditReadTransaction } from '@/application/audit/ports/audit-read-transaction';
import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { Clock } from '@/application/auth/ports/clock';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';

import { buildAuditAccessEvent } from './audit-access-event';
import { validateAuditSearchQuery } from './audit-query-validation';

export interface SearchAuditEventsInput {
  readonly actor: CurrentPrincipal;
  readonly requestId: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly query: AuditSearchQuery;
}

export class SearchAuditEvents {
  constructor(
    private readonly dependencies: {
      readonly transaction: AuditReadTransaction;
      readonly publicIds: PublicIdGenerator;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: SearchAuditEventsInput): Promise<AuditEventPageDto> {
    const query = validateAuditSearchQuery(input.query);
    return this.dependencies.transaction.execute(async ({ queries, auditEvents }) => {
      const page = await queries.search(query);
      const filterCategories = (
        [
          'from',
          'to',
          'action',
          'entityType',
          'entityPublicId',
          'actorPublicId',
          'requestId',
        ] as const
      ).filter((field) => query[field] !== null);
      await auditEvents.append(
        buildAuditAccessEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          occurredAt: this.dependencies.clock.now(),
          actorPublicId: input.actor.userPublicId,
          requestId: input.requestId,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          entityPublicId: null,
          metadata: {
            accessType: 'search',
            filterCategories,
            returnedCount: page.items.length,
          },
        }),
      );
      return page;
    });
  }
}
