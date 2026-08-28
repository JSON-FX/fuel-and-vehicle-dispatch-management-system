import { describe, expect, it } from 'vitest';

import { VehicleDispatch } from '@/domain/dispatch/entities/vehicle-dispatch';
import { DispatchDate } from '@/domain/dispatch/value-objects/dispatch-date';
import { DispatchStatus } from '@/domain/dispatch/value-objects/dispatch-status';
import { OdometerReading } from '@/domain/dispatch/value-objects/odometer-reading';
import { PassengerCount } from '@/domain/dispatch/value-objects/passenger-count';
import { DomainError } from '@/domain/shared/errors/domain-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';

const publicId = (suffix: string) => PublicId.from(`01900000-0000-7000-8000-${suffix}`);
const at = (hour: number) => new Date(`2026-08-28T${String(hour).padStart(2, '0')}:00:00.000Z`);

function createDraft(): VehicleDispatch {
  return new VehicleDispatch({
    publicId: publicId('000000000701'),
    entryDate: DispatchDate.from('2026-08-28'),
    travelDate: DispatchDate.from('2026-08-27'),
    driverPublicId: publicId('000000000702'),
    vehiclePublicId: publicId('000000000703'),
    requestingOfficePublicId: publicId('000000000704'),
    destination: 'Provincial Capitol',
    purpose: 'Official provincial travel',
    odoBefore: OdometerReading.from('1250.4'),
    passengerCount: PassengerCount.from(2),
    createdByActorPublicId: publicId('000000000705'),
    createdAt: at(0),
    updatedAt: at(0),
  });
}

describe('VehicleDispatch', () => {
  it('creates a draft with null lifecycle evidence and no derived distance', () => {
    const dispatch = createDraft();

    expect(dispatch.status.toString()).toBe('DRAFT');
    expect(dispatch.odoAfter).toBeNull();
    expect(dispatch.dispatchedAt).toBeNull();
    expect(dispatch.completedAt).toBeNull();
    expect(dispatch.cancelledAt).toBeNull();
    expect(dispatch.distance).toBeNull();
  });

  it('updates every operational fact while draft without enforcing date order', () => {
    const dispatch = createDraft();

    dispatch.updateDetails(
      {
        entryDate: DispatchDate.from('2026-08-30'),
        travelDate: DispatchDate.from('2026-08-20'),
        driverPublicId: publicId('000000000706'),
        vehiclePublicId: publicId('000000000707'),
        requestingOfficePublicId: publicId('000000000708'),
        destination: 'District Hospital',
        purpose: 'Deliver medical supplies',
        odoBefore: OdometerReading.from('1300'),
        passengerCount: PassengerCount.from(4),
      },
      at(1),
    );

    expect(dispatch.travelDate.toString()).toBe('2026-08-20');
    expect(dispatch.destination).toBe('District Hospital');
    expect(dispatch.odoBefore.toString()).toBe('1300.0');
    expect(dispatch.passengerCount.toNumber()).toBe(4);
    expect(dispatch.updatedAt).toEqual(at(1));
  });

  it('dispatches then completes with exact derived distance', () => {
    const dispatch = createDraft();

    dispatch.markDispatched(at(1));
    dispatch.complete(OdometerReading.from('1260.6'), at(2));

    expect(dispatch.status.toString()).toBe('COMPLETED');
    expect(dispatch.dispatchedAt).toEqual(at(1));
    expect(dispatch.completedAt).toEqual(at(2));
    expect(dispatch.odoAfter?.toString()).toBe('1260.6');
    expect(dispatch.distance).toBe('10.2');
    expect(dispatch.updatedAt).toEqual(at(2));
  });

  it('rejects completion below the initial reading without mutating state', () => {
    const dispatch = createDraft();
    dispatch.markDispatched(at(1));

    expect(() => dispatch.complete(OdometerReading.from('1250.3'), at(2))).toThrow(
      'Final odometer reading cannot be below the initial reading.',
    );
    expect(dispatch.status.toString()).toBe('DISPATCHED');
    expect(dispatch.odoAfter).toBeNull();
    expect(dispatch.completedAt).toBeNull();
  });

  it.each(['DRAFT', 'DISPATCHED'] as const)('cancels a %s record with evidence', (state) => {
    const dispatch = createDraft();
    if (state === 'DISPATCHED') dispatch.markDispatched(at(1));

    dispatch.cancel({
      at: at(2),
      actorPublicId: publicId('000000000709'),
      reason: 'Vehicle reassigned to emergency response.',
    });

    expect(dispatch.status.toString()).toBe('CANCELLED');
    expect(dispatch.cancelledAt).toEqual(at(2));
    expect(dispatch.cancelledByActorPublicId?.toString()).toBe(
      '01900000-0000-7000-8000-000000000709',
    );
    expect(dispatch.cancellationReason).toBe('Vehicle reassigned to emergency response.');
    expect(dispatch.dispatchedAt).toEqual(state === 'DISPATCHED' ? at(1) : null);
  });

  it.each(['too short', 'x'.repeat(501)])('rejects invalid cancellation reason %j', (reason) => {
    const dispatch = createDraft();

    expect(() =>
      dispatch.cancel({
        at: at(1),
        actorPublicId: publicId('000000000709'),
        reason,
      }),
    ).toThrow(DomainError);
    expect(dispatch.status.toString()).toBe('DRAFT');
  });

  it('keeps completed and cancelled records immutable', () => {
    const completed = createDraft();
    completed.markDispatched(at(1));
    completed.complete(OdometerReading.from('1250.4'), at(2));

    expect(() => completed.markDispatched(at(3))).toThrow(
      'Completed vehicle dispatches are terminal.',
    );
    expect(() =>
      completed.cancel({
        at: at(3),
        actorPublicId: publicId('000000000709'),
        reason: 'A valid cancellation reason.',
      }),
    ).toThrow('Completed vehicle dispatches are terminal.');

    const cancelled = createDraft();
    cancelled.cancel({
      at: at(1),
      actorPublicId: publicId('000000000709'),
      reason: 'Vehicle reassigned to emergency response.',
    });
    expect(() =>
      cancelled.updateDetails(
        {
          entryDate: cancelled.entryDate,
          travelDate: cancelled.travelDate,
          driverPublicId: cancelled.driverPublicId,
          vehiclePublicId: cancelled.vehiclePublicId,
          requestingOfficePublicId: cancelled.requestingOfficePublicId,
          destination: cancelled.destination,
          purpose: cancelled.purpose,
          odoBefore: cancelled.odoBefore,
          passengerCount: cancelled.passengerCount,
        },
        at(2),
      ),
    ).toThrow('Cancelled vehicle dispatches are terminal.');
  });

  it('rejects incoherent lifecycle state during rehydration', () => {
    expect(
      () =>
        new VehicleDispatch({
          ...createDraft(),
          status: DispatchStatus.draft(),
          completedAt: at(2),
        }),
    ).toThrow('Vehicle dispatch lifecycle evidence does not match its status.');
  });
});
