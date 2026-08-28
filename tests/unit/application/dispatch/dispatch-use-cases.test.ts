import { describe, expect, it } from 'vitest';

import { CancelDispatch } from '@/application/dispatch/use-cases/cancel-dispatch';
import { CompleteDispatch } from '@/application/dispatch/use-cases/complete-dispatch';
import { CreateDispatch } from '@/application/dispatch/use-cases/create-dispatch';
import { DispatchVehicle } from '@/application/dispatch/use-cases/dispatch-vehicle';
import { GetDispatch } from '@/application/dispatch/use-cases/get-dispatch';
import { GetDispatchFilterOptions } from '@/application/dispatch/use-cases/get-dispatch-filter-options';
import { GetDispatchPreparationOptions } from '@/application/dispatch/use-cases/get-dispatch-preparation-options';
import { ListDispatches } from '@/application/dispatch/use-cases/list-dispatches';
import { UpdateDraftDispatch } from '@/application/dispatch/use-cases/update-draft-dispatch';
import {
  AuthorizationError,
  BusinessRuleError,
} from '@/application/shared/errors/application-error';
import { DriverStatus } from '@/domain/driver/value-objects/driver-status';
import { VehicleStatus } from '@/domain/vehicle/value-objects/vehicle-status';

import { command, context, createDraft, createHarness, testAt } from './dispatch-test-helpers';

describe('dispatch use cases', () => {
  it('creates a draft after locking eligible references in one stable order', async () => {
    const harness = createHarness();
    const result = await new CreateDispatch(harness.dependencies).execute({ context, command });

    expect(result.status).toBe('DRAFT');
    expect(result.driver.name).toBe('Juan Dela Cruz');
    expect(result.driver).not.toHaveProperty('contactNumber');
    expect(harness.lockOrder).toEqual(['office', 'driver', 'vehicle']);
    expect(harness.audits.map((event) => event.action)).toEqual(['vehicle_dispatch.created']);
    expect(harness.getDispatch()?.publicId.toString()).toBe(result.publicId);
  });

  it('rejects create without dispatch.create and rejects ineligible references', async () => {
    const unauthorized = createHarness();
    await expect(
      new CreateDispatch(unauthorized.dependencies).execute({
        context: {
          ...context,
          principal: { ...context.principal, permissions: ['dispatch.read'] },
        },
        command,
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const inactiveDriver = createHarness();
    inactiveDriver.driver.changeStatus(DriverStatus.inactive(), testAt);
    await expect(
      new CreateDispatch(inactiveDriver.dependencies).execute({ context, command }),
    ).rejects.toBeInstanceOf(BusinessRuleError);

    const unserviceableVehicle = createHarness();
    unserviceableVehicle.vehicle.changeStatus(VehicleStatus.unserviceable(), testAt);
    await expect(
      new CreateDispatch(unserviceableVehicle.dependencies).execute({ context, command }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it('revalidates every selected reference when updating a draft', async () => {
    const harness = createHarness();
    const target = createDraft();
    harness.setDispatch(target);

    const result = await new UpdateDraftDispatch(harness.dependencies).execute({
      context,
      publicId: target.publicId.toString(),
      command: { ...command, destination: 'Regional Medical Center', passengerCount: 4 },
    });

    expect(result.destination).toBe('Regional Medical Center');
    expect(result.passengerCount).toBe(4);
    expect(harness.lockOrder).toEqual(['dispatch', 'office', 'driver', 'vehicle']);
    expect(harness.audits[0]?.action).toBe('vehicle_dispatch.updated');
  });

  it('dispatches a draft only after a final eligibility recheck', async () => {
    const harness = createHarness();
    const target = createDraft();
    harness.setDispatch(target);

    const result = await new DispatchVehicle(harness.dependencies).execute({
      context,
      publicId: target.publicId.toString(),
    });

    expect(result.status).toBe('DISPATCHED');
    expect(result.dispatchedAt).toBe(testAt.toISOString());
    expect(harness.lockOrder).toEqual(['dispatch', 'office', 'driver', 'vehicle']);
    expect(harness.audits[0]?.action).toBe('vehicle_dispatch.dispatched');
  });

  it('completes from the locked dispatch without rechecking later master-data status', async () => {
    const harness = createHarness();
    const target = createDraft();
    target.markDispatched(testAt);
    harness.setDispatch(target);
    harness.driver.changeStatus(DriverStatus.inactive(), testAt);
    harness.vehicle.changeStatus(VehicleStatus.unserviceable(), testAt);

    const result = await new CompleteDispatch(harness.dependencies).execute({
      context,
      publicId: target.publicId.toString(),
      command: { odoAfter: '1260.6' },
    });

    expect(result.status).toBe('COMPLETED');
    expect(result.distance).toBe('10.2');
    expect(harness.lockOrder).toEqual(['dispatch']);
    expect(harness.audits[0]?.action).toBe('vehicle_dispatch.completed');
  });

  it('cancels a dispatched historical record with normalized reason evidence', async () => {
    const harness = createHarness();
    const target = createDraft();
    target.markDispatched(testAt);
    harness.setDispatch(target);

    const result = await new CancelDispatch(harness.dependencies).execute({
      context,
      publicId: target.publicId.toString(),
      command: { reason: '  Vehicle   reassigned for emergency response. ' },
    });

    expect(result.status).toBe('CANCELLED');
    expect(result.cancellationReason).toBe('Vehicle reassigned for emergency response.');
    expect(harness.lockOrder).toEqual(['dispatch']);
    expect(harness.audits[0]?.action).toBe('vehicle_dispatch.cancelled');
  });

  it('reads, lists, and prepares only permission-safe public DTOs', async () => {
    const harness = createHarness();
    const target = createDraft();
    harness.setDispatch(target);

    const detail = await new GetDispatch(harness.dependencies).execute({
      context,
      publicId: target.publicId.toString(),
    });
    const page = await new ListDispatches(harness.dependencies).execute({
      context,
      query: {
        query: null,
        status: null,
        requestingOfficePublicId: null,
        travelDateFrom: null,
        travelDateTo: null,
        cursor: null,
        pageSize: 50,
      },
    });
    const options = await new GetDispatchPreparationOptions(harness.dependencies).execute({
      context,
    });
    const editOptions = await new GetDispatchPreparationOptions(harness.dependencies).execute({
      context: {
        ...context,
        principal: { ...context.principal, permissions: ['dispatch.update'] },
      },
      access: 'update',
    });
    const filters = await new GetDispatchFilterOptions(harness.dependencies).execute({ context });

    expect(detail.publicId).toBe(target.publicId.toString());
    expect(page.items).toHaveLength(1);
    expect(options.offices).toHaveLength(1);
    expect(options.drivers[0]).not.toHaveProperty('contactNumber');
    expect(options.vehicles).toHaveLength(1);
    expect(editOptions.vehicles).toEqual(options.vehicles);
    expect(filters.offices).toEqual(options.offices);
  });
});
