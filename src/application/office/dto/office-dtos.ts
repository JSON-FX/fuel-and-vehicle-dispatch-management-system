import type {
  CursorPage,
  MasterDataListQuery,
} from '@/application/master-data/dto/master-data-list-dtos';
import type { Office } from '@/domain/office/entities/office';

export type OfficeStatusDto = 'ACTIVE' | 'INACTIVE';

export interface OfficeAdminDto {
  readonly publicId: string;
  readonly name: string;
  readonly abbreviation: string;
  readonly status: OfficeStatusDto;
  readonly operational: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
  readonly deletedByActorPublicId: string | null;
  readonly deleteReason: string | null;
}

export interface OfficeOperationalOptionDto {
  readonly publicId: string;
  readonly name: string;
  readonly abbreviation: string;
}

export interface CreateOfficeCommand {
  readonly name: string;
  readonly abbreviation: string;
}

export interface UpdateOfficeCommand {
  readonly name?: string | undefined;
  readonly abbreviation?: string | undefined;
  readonly status?: OfficeStatusDto | undefined;
}

export type OfficeListQuery = MasterDataListQuery;
export type OfficePage = CursorPage<OfficeAdminDto>;
export type OfficeOperationalPage = CursorPage<OfficeOperationalOptionDto>;

export function toOfficeAdminDto(office: Office): OfficeAdminDto {
  return {
    publicId: office.publicId.toString(),
    name: office.name.toString(),
    abbreviation: office.abbreviation.toString(),
    status: office.status.toString(),
    operational: office.isOperational(),
    createdAt: office.createdAt.toISOString(),
    updatedAt: office.updatedAt.toISOString(),
    deletedAt: office.deletedAt?.toISOString() ?? null,
    deletedByActorPublicId: office.deletedByActorPublicId?.toString() ?? null,
    deleteReason: office.deleteReason,
  };
}
