import type {
  OfficeListQuery,
  OfficeOperationalPage,
  OfficePage,
} from '@/application/office/dto/office-dtos';
import type { Office } from '@/domain/office/entities/office';

export interface OfficeRepository {
  findCurrentByPublicId(publicId: string): Promise<Office | null>;
  findIncludingDeletedByPublicId(publicId: string): Promise<Office | null>;
  findCurrentByPublicIdForUpdate(publicId: string): Promise<Office | null>;
  findDeletedByPublicIdForUpdate(publicId: string): Promise<Office | null>;
  insert(office: Office): Promise<void>;
  updateDetails(office: Office): Promise<void>;
  updateStatus(office: Office): Promise<void>;
  softDelete(office: Office): Promise<void>;
  restore(office: Office): Promise<void>;
  listAdmin(query: OfficeListQuery): Promise<OfficePage>;
  listOperational(query: OfficeListQuery): Promise<OfficeOperationalPage>;
}
