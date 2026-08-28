import type { AuditVerificationStatusDto } from '@/application/audit/dto/audit-event-dtos';
import type { AuditQueryRepository } from '@/application/audit/ports/audit-query-repository';

export class GetLatestAuditVerification {
  constructor(private readonly queries: AuditQueryRepository) {}

  execute(): Promise<AuditVerificationStatusDto | null> {
    return this.queries.findLatestVerification();
  }
}
