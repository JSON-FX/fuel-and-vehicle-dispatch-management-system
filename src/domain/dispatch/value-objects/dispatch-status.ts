import { DomainError } from '@/domain/shared/errors/domain-error';

export const DISPATCH_STATUSES = ['DRAFT', 'DISPATCHED', 'COMPLETED', 'CANCELLED'] as const;
export type DispatchStatusValue = (typeof DISPATCH_STATUSES)[number];

export class DispatchStatus {
  private constructor(private readonly value: DispatchStatusValue) {}

  static from(value: unknown): DispatchStatus {
    if (!DISPATCH_STATUSES.includes(value as DispatchStatusValue)) {
      throw new DomainError(
        'INVALID_DISPATCH_STATUS',
        'Vehicle dispatch status must be DRAFT, DISPATCHED, COMPLETED, or CANCELLED.',
      );
    }
    return new DispatchStatus(value as DispatchStatusValue);
  }

  static draft(): DispatchStatus {
    return new DispatchStatus('DRAFT');
  }

  static dispatched(): DispatchStatus {
    return new DispatchStatus('DISPATCHED');
  }

  static completed(): DispatchStatus {
    return new DispatchStatus('COMPLETED');
  }

  static cancelled(): DispatchStatus {
    return new DispatchStatus('CANCELLED');
  }

  isDraft(): boolean {
    return this.value === 'DRAFT';
  }

  isDispatched(): boolean {
    return this.value === 'DISPATCHED';
  }

  isCompleted(): boolean {
    return this.value === 'COMPLETED';
  }

  isCancelled(): boolean {
    return this.value === 'CANCELLED';
  }

  isTerminal(): boolean {
    return this.isCompleted() || this.isCancelled();
  }

  assertDraft(): void {
    this.assertNotTerminal();
    if (!this.isDraft()) {
      throw new DomainError(
        'VEHICLE_DISPATCH_NOT_DRAFT',
        'Only draft vehicle dispatches can be edited.',
      );
    }
  }

  dispatch(): DispatchStatus {
    this.assertNotTerminal();
    if (!this.isDraft()) {
      throw new DomainError(
        'VEHICLE_DISPATCH_NOT_DRAFT',
        'Only draft vehicle dispatches can be dispatched.',
      );
    }
    return DispatchStatus.dispatched();
  }

  complete(): DispatchStatus {
    this.assertNotTerminal();
    if (!this.isDispatched()) {
      throw new DomainError(
        'VEHICLE_DISPATCH_NOT_DISPATCHED',
        'Only dispatched vehicle dispatches can be completed.',
      );
    }
    return DispatchStatus.completed();
  }

  cancel(): DispatchStatus {
    this.assertNotTerminal();
    return DispatchStatus.cancelled();
  }

  toString(): DispatchStatusValue {
    return this.value;
  }

  private assertNotTerminal(): void {
    if (this.isCompleted()) {
      throw new DomainError(
        'VEHICLE_DISPATCH_TERMINAL',
        'Completed vehicle dispatches are terminal.',
      );
    }
    if (this.isCancelled()) {
      throw new DomainError(
        'VEHICLE_DISPATCH_TERMINAL',
        'Cancelled vehicle dispatches are terminal.',
      );
    }
  }
}
