import { describe, expect, it } from 'vitest';

import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import { toDispatchDetailDto } from '@/application/dispatch/dto/dispatch-dtos';
import {
  buildDispatchAuditEvent,
  dispatchAuditSnapshot,
} from '@/application/dispatch/services/dispatch-audit-events';
import { DispatchPermissionPolicy } from '@/application/dispatch/services/dispatch-permission-policy';
import {
  asDispatchBusinessRule,
  dispatchDetails,
  normalizeCancellationReason,
} from '@/application/dispatch/services/dispatch-use-case-support';
import {
  BusinessRuleError,
  DispatchScheduleConflictError,
  DispatchTransactionRetryError,
  ValidationError,
} from '@/application/shared/errors/application-error';
import { VehicleDispatch } from '@/domain/dispatch/entities/vehicle-dispatch';
import { DispatchDate } from '@/domain/dispatch/value-objects/dispatch-date';
import { OdometerReading } from '@/domain/dispatch/value-objects/odometer-reading';
import { PassengerCount } from '@/domain/dispatch/value-objects/passenger-count';
import { PublicId } from '@/domain/shared/value-objects/public-id';

const publicId = (suffix: string) => PublicId.from(`01900000-0000-7000-8000-${suffix}`);

function principal(permissions: readonly string[]): CurrentPrincipal {
  return {
    userPublicId: publicId('000000000711').toString(),
    username: 'dispatch.officer',
    fullName: 'Dispatch Officer',
    roles: ['DISPATCH_OFFICER'],
    permissions,
    isPrivileged: false,
    mustChangePassword: false,
    mfaEnrolled: false,
  };
}

function draft(): VehicleDispatch {
  return new VehicleDispatch({
    publicId: publicId('000000000712'),
    entryDate: DispatchDate.from('2026-08-28'),
    travelDate: DispatchDate.from('2026-08-29'),
    driverPublicId: publicId('000000000713'),
    vehiclePublicId: publicId('000000000714'),
    requestingOfficePublicId: publicId('000000000715'),
    destination: 'District Hospital',
    purpose: 'Deliver medical supplies',
    odoBefore: OdometerReading.from('1250.4'),
    passengerCount: PassengerCount.from(2),
    createdByActorPublicId: publicId('000000000711'),
    createdAt: new Date('2026-08-28T00:00:00.000Z'),
    updatedAt: new Date('2026-08-28T00:00:00.000Z'),
  });
}

describe('dispatch application services', () => {
  it('enforces every dispatch permission independently', () => {
    const policy = new DispatchPermissionPolicy();

    expect(policy.canCreate(principal(['dispatch.create']))).toBe(true);
    expect(policy.canRead(principal(['dispatch.read']))).toBe(true);
    expect(policy.canUpdate(principal(['dispatch.update']))).toBe(true);
    expect(policy.canComplete(principal(['dispatch.complete']))).toBe(true);
    expect(policy.canCancel(principal(['dispatch.cancel']))).toBe(true);
    expect(policy.canOverrideConflict(principal(['dispatch.conflict.override']))).toBe(true);
    expect(policy.canManageSettings(principal(['dispatch.settings.manage']))).toBe(true);
    expect(policy.canRead(principal(['dispatch.create']))).toBe(false);
    expect(policy.canComplete(principal(['dispatch.update']))).toBe(false);
    expect(() => policy.assertCanCreate(principal([]))).toThrow('not allowed');
    expect(() => policy.assertCanRead(principal([]), draft())).toThrow('not allowed');
    expect(() => policy.assertCanUpdate(principal([]), draft())).toThrow('not allowed');
    expect(() => policy.assertCanComplete(principal([]), draft())).toThrow('not allowed');
    expect(() => policy.assertCanCancel(principal([]), draft())).toThrow('not allowed');
    expect(() => policy.assertCanOverrideConflict(principal([]))).toThrow('not allowed');
    expect(() => policy.assertCanManageSettings(principal([]))).toThrow('not allowed');
  });

  it('exposes safe structured schedule conflicts and retry outcomes', () => {
    const context = {
      policy: 'WARN_AND_ACK' as const,
      canOverride: true,
      fingerprint: 'a'.repeat(64),
      conflicts: [],
    };
    const conflict = new DispatchScheduleConflictError(context);
    const retry = new DispatchTransactionRetryError();

    expect(conflict.code).toBe('DISPATCH_SCHEDULE_CONFLICT');
    expect(conflict.httpStatus).toBe(409);
    expect(conflict.context).toEqual(context);
    expect(retry.code).toBe('DISPATCH_TRANSACTION_RETRY_REQUIRED');
    expect(retry.httpStatus).toBe(409);
  });

  it('normalizes dispatch details and maps value failures to field errors', () => {
    const details = dispatchDetails({
      entryDate: '2026-08-28',
      travelDate: '2026-08-27',
      driverPublicId: publicId('000000000713').toString(),
      vehiclePublicId: publicId('000000000714').toString(),
      requestingOfficePublicId: publicId('000000000715').toString(),
      destination: '  District   Hospital  ',
      purpose: '  Deliver   medical supplies  ',
      odoBefore: '1250.4',
      passengerCount: 2,
    });

    expect(details.destination).toBe('District Hospital');
    expect(details.purpose).toBe('Deliver medical supplies');
    expect(details.travelDate.toString()).toBe('2026-08-27');
    expect(details.odoBefore.toString()).toBe('1250.4');

    expect(() =>
      dispatchDetails({
        entryDate: 'invalid',
        travelDate: '2026-08-27',
        driverPublicId: publicId('000000000713').toString(),
        vehiclePublicId: publicId('000000000714').toString(),
        requestingOfficePublicId: publicId('000000000715').toString(),
        destination: 'District Hospital',
        purpose: 'Deliver medical supplies',
        odoBefore: '1250.4',
        passengerCount: 2,
      }),
    ).toThrow(ValidationError);
  });

  it.each([
    ['destination', ''],
    ['destination', 'x'.repeat(256)],
    ['purpose', ''],
    ['purpose', 'x'.repeat(501)],
  ] as const)('rejects invalid %s text', (field, value) => {
    const command = {
      entryDate: '2026-08-28',
      travelDate: '2026-08-27',
      driverPublicId: publicId('000000000713').toString(),
      vehiclePublicId: publicId('000000000714').toString(),
      requestingOfficePublicId: publicId('000000000715').toString(),
      destination: 'District Hospital',
      purpose: 'Deliver medical supplies',
      odoBefore: '1250.4',
      passengerCount: 2,
      [field]: value,
    };

    try {
      dispatchDetails(command);
      throw new Error('Expected dispatch details validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).details[0]?.field).toBe(field);
    }
  });

  it('normalizes cancellation evidence and maps domain failures to business rules', () => {
    expect(normalizeCancellationReason('  Vehicle   needed for emergency response.  ')).toBe(
      'Vehicle needed for emergency response.',
    );
    expect(() => normalizeCancellationReason('short')).toThrow(ValidationError);
    expect(() =>
      asDispatchBusinessRule(() => draft().complete(OdometerReading.from('1300'), new Date())),
    ).toThrow(BusinessRuleError);
  });

  it('creates an allowlisted audit snapshot without contact or internal data', () => {
    const snapshot = dispatchAuditSnapshot(draft());

    expect(snapshot).toEqual({
      entryDate: '2026-08-28',
      travelDate: '2026-08-29',
      driverPublicId: '01900000-0000-7000-8000-000000000713',
      vehiclePublicId: '01900000-0000-7000-8000-000000000714',
      requestingOfficePublicId: '01900000-0000-7000-8000-000000000715',
      destination: 'District Hospital',
      purpose: 'Deliver medical supplies',
      odoBefore: '1250.4',
      odoAfter: null,
      distance: null,
      passengerCount: 2,
      status: 'DRAFT',
      dispatchedAt: null,
      completedAt: null,
      cancelledAt: null,
      cancelledByActorPublicId: null,
      cancellationReason: null,
    });
    expect(snapshot).not.toHaveProperty('contactNumber');
    expect(snapshot).not.toHaveProperty('id');
  });

  it.each(['created', 'updated', 'dispatched', 'completed', 'cancelled'] as const)(
    'builds a vehicle_dispatch.%s audit event',
    (action) => {
      const target = draft();
      const event = buildDispatchAuditEvent({
        publicId: publicId('000000000716').toString(),
        action,
        entityPublicId: target.publicId.toString(),
        actorPublicId: principal([]).userPublicId,
        requestId: 'request-fvd-007',
        ipAddress: '127.0.0.1',
        userAgent: 'Vitest',
        occurredAt: new Date('2026-08-28T01:00:00.000Z'),
        after: dispatchAuditSnapshot(target),
      });

      expect(event.action).toBe(`vehicle_dispatch.${action}`);
      expect(event.entity).toEqual({
        type: 'vehicle_dispatch',
        publicId: target.publicId.toString(),
      });
    },
  );

  it('maps a historical record to a serializable detail without driver contact data', () => {
    const target = draft();
    const result = toDispatchDetailDto({
      dispatch: target,
      driver: { publicId: target.driverPublicId.toString(), name: 'Juan Dela Cruz' },
      vehicle: {
        publicId: target.vehiclePublicId.toString(),
        plateNumber: 'ABC-123',
        modelBrand: 'Toyota Hiace',
        vehicleType: 'Passenger Van',
      },
      requestingOffice: {
        publicId: target.requestingOfficePublicId.toString(),
        name: 'Provincial Services Office',
        abbreviation: 'PSO',
      },
    });

    expect(result).toMatchObject({
      publicId: target.publicId.toString(),
      odoBefore: '1250.4',
      odoAfter: null,
      distance: null,
      driver: { name: 'Juan Dela Cruz' },
      vehicle: { plateNumber: 'ABC-123' },
      requestingOffice: { abbreviation: 'PSO' },
    });
    expect(result.driver).not.toHaveProperty('contactNumber');
    expect(result.createdAt).toBe('2026-08-28T00:00:00.000Z');
  });
});
