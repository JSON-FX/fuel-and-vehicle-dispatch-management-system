import type { DispatchDate } from '@/domain/dispatch/value-objects/dispatch-date';
import { DispatchStatus } from '@/domain/dispatch/value-objects/dispatch-status';
import type { OdometerReading } from '@/domain/dispatch/value-objects/odometer-reading';
import type { PassengerCount } from '@/domain/dispatch/value-objects/passenger-count';
import { DomainError } from '@/domain/shared/errors/domain-error';
import type { PublicId } from '@/domain/shared/value-objects/public-id';

export interface DraftDispatchDetails {
  readonly entryDate: DispatchDate;
  readonly travelDate: DispatchDate;
  readonly driverPublicId: PublicId;
  readonly vehiclePublicId: PublicId;
  readonly requestingOfficePublicId: PublicId;
  readonly destination: string;
  readonly purpose: string;
  readonly odoBefore: OdometerReading;
  readonly passengerCount: PassengerCount;
}

export interface VehicleDispatchProperties extends DraftDispatchDetails {
  readonly publicId: PublicId;
  readonly createdByActorPublicId: PublicId;
  readonly createdAt: Date;
  updatedAt: Date;
  status?: DispatchStatus;
  odoAfter?: OdometerReading | null;
  dispatchedAt?: Date | null;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
  cancelledByActorPublicId?: PublicId | null;
  cancellationReason?: string | null;
}

export class VehicleDispatch {
  readonly publicId: PublicId;
  entryDate: DispatchDate;
  travelDate: DispatchDate;
  driverPublicId: PublicId;
  vehiclePublicId: PublicId;
  requestingOfficePublicId: PublicId;
  destination: string;
  purpose: string;
  odoBefore: OdometerReading;
  odoAfter: OdometerReading | null;
  passengerCount: PassengerCount;
  status: DispatchStatus;
  readonly createdByActorPublicId: PublicId;
  readonly createdAt: Date;
  updatedAt: Date;
  dispatchedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancelledByActorPublicId: PublicId | null;
  cancellationReason: string | null;

  constructor(properties: VehicleDispatchProperties) {
    this.publicId = properties.publicId;
    this.entryDate = properties.entryDate;
    this.travelDate = properties.travelDate;
    this.driverPublicId = properties.driverPublicId;
    this.vehiclePublicId = properties.vehiclePublicId;
    this.requestingOfficePublicId = properties.requestingOfficePublicId;
    this.destination = properties.destination;
    this.purpose = properties.purpose;
    this.odoBefore = properties.odoBefore;
    this.odoAfter = properties.odoAfter ?? null;
    this.passengerCount = properties.passengerCount;
    this.status = properties.status ?? DispatchStatus.draft();
    this.createdByActorPublicId = properties.createdByActorPublicId;
    this.createdAt = properties.createdAt;
    this.updatedAt = properties.updatedAt;
    this.dispatchedAt = properties.dispatchedAt ?? null;
    this.completedAt = properties.completedAt ?? null;
    this.cancelledAt = properties.cancelledAt ?? null;
    this.cancelledByActorPublicId = properties.cancelledByActorPublicId ?? null;
    this.cancellationReason = properties.cancellationReason ?? null;

    this.assertLifecycleCoherence();
  }

  get distance(): string | null {
    return this.odoAfter?.distanceFrom(this.odoBefore) ?? null;
  }

  updateDetails(details: DraftDispatchDetails, at: Date): void {
    this.status.assertDraft();
    this.entryDate = details.entryDate;
    this.travelDate = details.travelDate;
    this.driverPublicId = details.driverPublicId;
    this.vehiclePublicId = details.vehiclePublicId;
    this.requestingOfficePublicId = details.requestingOfficePublicId;
    this.destination = details.destination;
    this.purpose = details.purpose;
    this.odoBefore = details.odoBefore;
    this.passengerCount = details.passengerCount;
    this.updatedAt = at;
  }

  markDispatched(at: Date): void {
    const nextStatus = this.status.dispatch();
    this.status = nextStatus;
    this.dispatchedAt = at;
    this.updatedAt = at;
  }

  complete(odoAfter: OdometerReading, at: Date): void {
    const nextStatus = this.status.complete();
    odoAfter.assertAtLeast(this.odoBefore);
    this.odoAfter = odoAfter;
    this.status = nextStatus;
    this.completedAt = at;
    this.updatedAt = at;
  }

  cancel(input: {
    readonly at: Date;
    readonly actorPublicId: PublicId;
    readonly reason: string;
  }): void {
    const nextStatus = this.status.cancel();
    const reason = input.reason.trim().replace(/\s+/g, ' ');
    if (reason.length < 10 || reason.length > 500) {
      throw new DomainError(
        'INVALID_DISPATCH_CANCELLATION_REASON',
        'Cancellation reason must contain 10 to 500 characters.',
      );
    }

    this.status = nextStatus;
    this.cancelledAt = input.at;
    this.cancelledByActorPublicId = input.actorPublicId;
    this.cancellationReason = reason;
    this.updatedAt = input.at;
  }

  private assertLifecycleCoherence(): void {
    const hasCancellationEvidence =
      this.cancelledAt !== null ||
      this.cancelledByActorPublicId !== null ||
      this.cancellationReason !== null;

    const coherentDraft =
      this.status.isDraft() &&
      this.odoAfter === null &&
      this.dispatchedAt === null &&
      this.completedAt === null &&
      !hasCancellationEvidence;
    const coherentDispatched =
      this.status.isDispatched() &&
      this.odoAfter === null &&
      this.dispatchedAt !== null &&
      this.completedAt === null &&
      !hasCancellationEvidence;
    const coherentCompleted =
      this.status.isCompleted() &&
      this.odoAfter !== null &&
      this.dispatchedAt !== null &&
      this.completedAt !== null &&
      !hasCancellationEvidence;
    const coherentCancelled =
      this.status.isCancelled() &&
      this.odoAfter === null &&
      this.completedAt === null &&
      this.cancelledAt !== null &&
      this.cancelledByActorPublicId !== null &&
      this.cancellationReason !== null &&
      this.cancellationReason.length >= 10 &&
      this.cancellationReason.length <= 500;

    if (!(coherentDraft || coherentDispatched || coherentCompleted || coherentCancelled)) {
      throw new DomainError(
        'INVALID_VEHICLE_DISPATCH_LIFECYCLE',
        'Vehicle dispatch lifecycle evidence does not match its status.',
      );
    }

    if (coherentCompleted) {
      this.odoAfter?.assertAtLeast(this.odoBefore);
    }
  }
}
