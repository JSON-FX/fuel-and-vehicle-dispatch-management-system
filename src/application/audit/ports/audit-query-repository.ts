import type {
  AuditEventDetailDto,
  AuditEventPageDto,
  AuditSearchQuery,
  AuditVerificationStatusDto,
} from '@/application/audit/dto/audit-event-dtos';

export interface AuditQueryRepository {
  search(query: AuditSearchQuery): Promise<AuditEventPageDto>;
  findByPublicId(publicId: string, includeSensitive: boolean): Promise<AuditEventDetailDto | null>;
  findLatestVerification(): Promise<AuditVerificationStatusDto | null>;
}
