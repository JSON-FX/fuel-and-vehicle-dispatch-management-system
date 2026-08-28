import type {
  DriverListQuery,
  DriverOperationalPage,
  DriverPage,
} from '@/application/driver/dto/driver-dtos';
import type { Driver } from '@/domain/driver/entities/driver';

export interface DriverRepository {
  findCurrentByPublicId(publicId: string): Promise<Driver | null>;
  findIncludingDeletedByPublicId(publicId: string): Promise<Driver | null>;
  findCurrentByPublicIdForUpdate(publicId: string): Promise<Driver | null>;
  findDeletedByPublicIdForUpdate(publicId: string): Promise<Driver | null>;
  insert(driver: Driver): Promise<void>;
  updateDetails(driver: Driver): Promise<void>;
  updateStatus(driver: Driver): Promise<void>;
  softDelete(driver: Driver): Promise<void>;
  restore(driver: Driver): Promise<void>;
  listAdmin(query: DriverListQuery): Promise<DriverPage>;
  listOperational(query: DriverListQuery): Promise<DriverOperationalPage>;
}
