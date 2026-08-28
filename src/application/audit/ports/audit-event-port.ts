import type { AuditEventInput } from '@/application/audit/dto/audit-event-dtos';

export interface AuditEventPort {
  append(event: AuditEventInput): Promise<void>;
}
