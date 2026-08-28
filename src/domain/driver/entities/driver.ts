import { DomainError } from '@/domain/shared/errors/domain-error';
import type { PublicId } from '@/domain/shared/value-objects/public-id';
import type { DriverContactNumber } from '@/domain/driver/value-objects/driver-contact-number';
import type { DriverName } from '@/domain/driver/value-objects/driver-name';
import { DriverStatus } from '@/domain/driver/value-objects/driver-status';

export interface DriverProperties {
  readonly publicId: PublicId;
  name: DriverName;
  contactNumber: DriverContactNumber | null;
  status?: DriverStatus;
  readonly createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  deletedByActorPublicId?: PublicId | null;
  deleteReason?: string | null;
}

export class Driver {
  readonly publicId: PublicId;
  name: DriverName;
  contactNumber: DriverContactNumber | null;
  status: DriverStatus;
  readonly createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedByActorPublicId: PublicId | null;
  deleteReason: string | null;

  constructor(properties: DriverProperties) {
    this.publicId = properties.publicId;
    this.name = properties.name;
    this.contactNumber = properties.contactNumber;
    this.status = properties.status ?? DriverStatus.active();
    this.createdAt = properties.createdAt;
    this.updatedAt = properties.updatedAt;
    this.deletedAt = properties.deletedAt ?? null;
    this.deletedByActorPublicId = properties.deletedByActorPublicId ?? null;
    this.deleteReason = properties.deleteReason ?? null;
  }

  isOperational(): boolean {
    return this.deletedAt === null && this.status.isActive();
  }

  updateDetails(name: DriverName, contactNumber: DriverContactNumber | null, at: Date): void {
    this.assertCurrent();
    this.name = name;
    this.contactNumber = contactNumber;
    this.updatedAt = at;
  }

  changeStatus(status: DriverStatus, at: Date): void {
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
      throw new DomainError('DRIVER_NOT_DELETED', 'Driver is not deleted.');
    }
    this.deletedAt = null;
    this.deletedByActorPublicId = null;
    this.deleteReason = null;
    this.status = DriverStatus.inactive();
    this.updatedAt = at;
  }

  private assertCurrent(): void {
    if (this.deletedAt !== null) {
      throw new DomainError('DRIVER_DELETED', 'Deleted drivers cannot be changed.');
    }
  }
}
