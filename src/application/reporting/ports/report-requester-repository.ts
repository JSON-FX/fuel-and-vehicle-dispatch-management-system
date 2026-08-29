import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';

export interface ReportRequesterRecord {
  readonly id: string;
  readonly principal: CurrentPrincipal;
  readonly isActive: boolean;
  readonly deletedAt: Date | null;
}

export interface ReportRequesterRepository {
  findByPublicId(publicId: string): Promise<ReportRequesterRecord | null>;
}
