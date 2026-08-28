import { DomainError } from '@/domain/shared/errors/domain-error';
import type { PublicId } from '@/domain/shared/value-objects/public-id';
import type { OfficeAbbreviation } from '@/domain/office/value-objects/office-abbreviation';
import type { OfficeName } from '@/domain/office/value-objects/office-name';
import { OfficeStatus } from '@/domain/office/value-objects/office-status';

export interface OfficeProperties {
  readonly publicId: PublicId;
  name: OfficeName;
  abbreviation: OfficeAbbreviation;
  status?: OfficeStatus;
  readonly createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  deletedByActorPublicId?: PublicId | null;
  deleteReason?: string | null;
}

export class Office {
  readonly publicId: PublicId;
  name: OfficeName;
  abbreviation: OfficeAbbreviation;
  status: OfficeStatus;
  readonly createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedByActorPublicId: PublicId | null;
  deleteReason: string | null;

  constructor(properties: OfficeProperties) {
    this.publicId = properties.publicId;
    this.name = properties.name;
    this.abbreviation = properties.abbreviation;
    this.status = properties.status ?? OfficeStatus.active();
    this.createdAt = properties.createdAt;
    this.updatedAt = properties.updatedAt;
    this.deletedAt = properties.deletedAt ?? null;
    this.deletedByActorPublicId = properties.deletedByActorPublicId ?? null;
    this.deleteReason = properties.deleteReason ?? null;
  }

  isOperational(): boolean {
    return this.deletedAt === null && this.status.isActive();
  }

  updateDetails(name: OfficeName, abbreviation: OfficeAbbreviation, at: Date): void {
    this.assertCurrent();
    this.name = name;
    this.abbreviation = abbreviation;
    this.updatedAt = at;
  }

  changeStatus(status: OfficeStatus, at: Date): void {
    this.assertCurrent();
    this.status = status;
    this.updatedAt = at;
  }

  softDelete(input: { at: Date; actorPublicId: PublicId; reason: string }): void {
    this.assertCurrent();
    this.deletedAt = input.at;
    this.deletedByActorPublicId = input.actorPublicId;
    this.deleteReason = input.reason;
    this.updatedAt = input.at;
  }

  restore(at: Date): void {
    if (this.deletedAt === null) {
      throw new DomainError('OFFICE_NOT_DELETED', 'Office is not deleted.');
    }

    this.deletedAt = null;
    this.deletedByActorPublicId = null;
    this.deleteReason = null;
    this.status = OfficeStatus.inactive();
    this.updatedAt = at;
  }

  private assertCurrent(): void {
    if (this.deletedAt !== null) {
      throw new DomainError('OFFICE_DELETED', 'Deleted offices cannot be changed.');
    }
  }
}
