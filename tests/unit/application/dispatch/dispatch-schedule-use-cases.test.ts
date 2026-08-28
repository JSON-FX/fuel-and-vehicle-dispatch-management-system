import { describe, expect, it, vi } from 'vitest';

import type {
  DispatchScheduleConflictDto,
  DispatchScheduleQuery,
} from '@/application/dispatch/dto/dispatch-dtos';
import { CheckDispatchScheduleAvailability } from '@/application/dispatch/use-cases/check-dispatch-schedule-availability';
import { GetDispatchSchedule } from '@/application/dispatch/use-cases/get-dispatch-schedule';
import { GetDispatch } from '@/application/dispatch/use-cases/get-dispatch';
import { GetDispatchScheduleSettings } from '@/application/dispatch/use-cases/get-dispatch-schedule-settings';
import { GetDriverSchedule } from '@/application/dispatch/use-cases/get-driver-schedule';
import { GetVehicleSchedule } from '@/application/dispatch/use-cases/get-vehicle-schedule';
import { UpdateDispatchScheduleSettings } from '@/application/dispatch/use-cases/update-dispatch-schedule-settings';

import { context, createDraft, createHarness, publicId, testAt } from './dispatch-test-helpers';

const candidate = {
  travelDate: '2026-08-29',
  driverPublicId: publicId(803).toString(),
  vehiclePublicId: publicId(804).toString(),
  excludedDispatchPublicId: null,
} as const;

const conflict: DispatchScheduleConflictDto = {
  dispatchPublicId: publicId(950).toString(),
  conflictType: 'DRIVER_AND_VEHICLE',
  travelDate: '2026-08-29',
  status: 'DRAFT',
  destination: 'Malaybalay',
  purpose: 'Official travel',
  driver: { publicId: candidate.driverPublicId, name: 'Juan Dela Cruz' },
  vehicle: {
    publicId: candidate.vehiclePublicId,
    plateNumber: 'ABC-123',
    modelBrand: 'Toyota Hiace',
    vehicleType: 'Passenger Van',
  },
};

const query: DispatchScheduleQuery = {
  from: '2026-08-25',
  to: '2026-08-31',
  requestingOfficePublicId: null,
  driverPublicId: null,
  vehiclePublicId: null,
  status: null,
  limit: 200,
};

const settingsContext = {
  ...context,
  principal: {
    ...context.principal,
    permissions: [...context.principal.permissions, 'dispatch.settings.manage'],
  },
};

describe('dispatch schedule use cases', () => {
  it('returns advisory conflicts with the effective policy and current fingerprint', async () => {
    const harness = createHarness();
    harness.setConflicts([conflict]);

    const result = await new CheckDispatchScheduleAvailability(harness.dependencies).execute({
      context,
      candidate,
    });

    expect(result).toMatchObject({
      policy: 'WARN_AND_ACK',
      canOverride: true,
      conflicts: [conflict],
    });
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns bounded schedule events and independent occupancy', async () => {
    const harness = createHarness();
    const event = {
      ...conflict,
      requestingOffice: {
        publicId: publicId(802).toString(),
        name: 'Provincial Services Office',
        abbreviation: 'PSO',
      },
    };
    vi.spyOn(harness.repositories.dispatchSchedules, 'listSchedule').mockResolvedValue({
      events: [event],
      truncated: true,
    });
    vi.spyOn(harness.repositories.dispatchSchedules, 'getOccupancy').mockResolvedValue([
      {
        resourceType: 'DRIVER',
        resourcePublicId: candidate.driverPublicId,
        travelDate: '2026-08-29',
        dispatchCount: 2,
        hasConflict: true,
      },
    ]);

    const result = await new GetDispatchSchedule(harness.dependencies).execute({ context, query });

    expect(result).toEqual({
      from: query.from,
      to: query.to,
      events: [event],
      occupancy: [
        {
          resourceType: 'DRIVER',
          resourcePublicId: candidate.driverPublicId,
          travelDate: '2026-08-29',
          dispatchCount: 2,
          hasConflict: true,
        },
      ],
      truncated: true,
    });
  });

  it('applies driver and vehicle resource filters through the shared schedule query', async () => {
    const harness = createHarness();
    const schedule = new GetDispatchSchedule(harness.dependencies);
    const execute = vi.spyOn(schedule, 'execute').mockResolvedValue({
      from: query.from,
      to: query.to,
      events: [],
      occupancy: [],
      truncated: false,
    });

    await new GetDriverSchedule(schedule).execute({
      context,
      driverPublicId: candidate.driverPublicId,
      query,
    });
    await new GetVehicleSchedule(schedule).execute({
      context,
      vehiclePublicId: candidate.vehiclePublicId,
      query,
    });

    expect(execute).toHaveBeenNthCalledWith(1, {
      context,
      query: { ...query, driverPublicId: candidate.driverPublicId },
    });
    expect(execute).toHaveBeenNthCalledWith(2, {
      context,
      query: { ...query, vehiclePublicId: candidate.vehiclePublicId },
    });
  });

  it('requires settings permission and audits a policy change atomically', async () => {
    const harness = createHarness();
    expect(() =>
      new GetDispatchScheduleSettings(harness.dependencies).execute({ context }),
    ).toThrow(expect.objectContaining({ httpStatus: 403 }));

    const result = await new UpdateDispatchScheduleSettings(harness.dependencies).execute({
      context: settingsContext,
      command: { policy: 'BLOCK' },
    });

    expect(result).toEqual({
      policy: 'BLOCK',
      updatedByActorPublicId: context.principal.userPublicId,
      updatedAt: testAt.toISOString(),
    });
    expect(harness.audits).toHaveLength(1);
    expect(harness.audits[0]).toMatchObject({
      action: 'dispatch_schedule.policy.changed',
      before: { policy: 'WARN_AND_ACK' },
      after: { policy: 'BLOCK' },
    });
  });

  it('does not write or audit a settings no-op', async () => {
    const harness = createHarness();
    const update = vi.spyOn(harness.repositories.dispatchScheduleSettings, 'update');

    const result = await new UpdateDispatchScheduleSettings(harness.dependencies).execute({
      context: settingsContext,
      command: { policy: 'WARN_AND_ACK' },
    });

    expect(result.policy).toBe('WARN_AND_ACK');
    expect(update).not.toHaveBeenCalled();
    expect(harness.audits).toHaveLength(0);
  });

  it('loads immutable conflict acknowledgment history after dispatch authorization', async () => {
    const harness = createHarness();
    const draft = createDraft();
    harness.setDispatch(draft);
    const history = {
      publicId: publicId(960).toString(),
      conflictingDispatchPublicId: publicId(950).toString(),
      conflictingDispatchLabel: 'Malaybalay · ABC-123',
      conflictType: 'DRIVER_AND_VEHICLE' as const,
      policy: 'WARN_AND_ACK' as const,
      reason: 'Reviewed both assignments and approved the second trip.',
      acknowledgedByActorPublicId: context.principal.userPublicId,
      acknowledgedAt: testAt.toISOString(),
    };
    vi.spyOn(harness.repositories.dispatchConflictOverrides, 'listForDispatch').mockResolvedValue([
      history,
    ]);

    const result = await new GetDispatch(harness.dependencies).execute({
      context,
      publicId: draft.publicId.toString(),
    });

    expect(result.conflictAcknowledgments).toEqual([history]);
  });
});
