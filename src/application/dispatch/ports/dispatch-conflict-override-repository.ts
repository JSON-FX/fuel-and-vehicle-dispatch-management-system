import type {
  DispatchConflictEvidenceQueryDto,
  DispatchConflictOverrideHistoryDto,
  DispatchConflictOverrideWriteDto,
} from '@/application/dispatch/dto/dispatch-dtos';

export interface DispatchConflictOverrideRepository {
  appendMany(overrides: readonly DispatchConflictOverrideWriteDto[]): Promise<void>;
  hasMatchingEvidence(query: DispatchConflictEvidenceQueryDto): Promise<boolean>;
  listForDispatch(dispatchPublicId: string): Promise<readonly DispatchConflictOverrideHistoryDto[]>;
}
