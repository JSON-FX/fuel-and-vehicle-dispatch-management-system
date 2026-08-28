import type {
  FuelIssuanceDetailRecord,
  FuelIssuanceListQuery,
  FuelIssuanceRecordPage,
  FuelIssuanceReferenceRecord,
} from '@/application/fuel/dto/fuel-dtos';
import type { FuelIssuance } from '@/domain/fuel/entities/fuel-issuance';

export interface FuelIssuanceRepository {
  findByPublicId(publicId: string): Promise<FuelIssuanceReferenceRecord | null>;
  findDetailByPublicId(publicId: string): Promise<FuelIssuanceDetailRecord | null>;
  findByPublicIdForUpdate(publicId: string): Promise<FuelIssuance | null>;
  insert(issuance: FuelIssuance): Promise<void>;
  updateDraft(issuance: FuelIssuance): Promise<void>;
  markPosted(issuance: FuelIssuance): Promise<void>;
  markVoided(issuance: FuelIssuance): Promise<void>;
  list(query: FuelIssuanceListQuery): Promise<FuelIssuanceRecordPage>;
}
