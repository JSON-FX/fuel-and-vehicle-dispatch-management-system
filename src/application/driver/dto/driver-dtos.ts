import type {
  CursorPage,
  MasterDataListQuery,
} from '@/application/master-data/dto/master-data-list-dtos';
import type { Driver } from '@/domain/driver/entities/driver';

export type DriverStatusDto = 'ACTIVE' | 'INACTIVE';

export interface DriverAdminDto {
  readonly publicId: string;
  readonly name: string;
  readonly contactNumber: string | null;
  readonly status: DriverStatusDto;
  readonly operational: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
  readonly deletedByActorPublicId: string | null;
  readonly deleteReason: string | null;
}

export interface DriverOperationalOptionDto {
  readonly publicId: string;
  readonly name: string;
}

export interface CreateDriverCommand {
  readonly name: string;
  readonly contactNumber?: string | null | undefined;
}

export interface UpdateDriverCommand {
  readonly name?: string | undefined;
  readonly contactNumber?: string | null | undefined;
  readonly status?: DriverStatusDto | undefined;
}

export type DriverListQuery = MasterDataListQuery;
export type DriverPage = CursorPage<DriverAdminDto>;
export type DriverOperationalPage = CursorPage<DriverOperationalOptionDto>;

export function toDriverAdminDto(driver: Driver): DriverAdminDto {
  return {
    publicId: driver.publicId.toString(),
    name: driver.name.toString(),
    contactNumber: driver.contactNumber?.toString() ?? null,
    status: driver.status.toString(),
    operational: driver.isOperational(),
    createdAt: driver.createdAt.toISOString(),
    updatedAt: driver.updatedAt.toISOString(),
    deletedAt: driver.deletedAt?.toISOString() ?? null,
    deletedByActorPublicId: driver.deletedByActorPublicId?.toString() ?? null,
    deleteReason: driver.deleteReason,
  };
}
