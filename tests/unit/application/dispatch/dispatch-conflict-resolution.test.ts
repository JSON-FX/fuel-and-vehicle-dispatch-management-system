import { describe, expect, it } from 'vitest';

import type {
  DispatchScheduleCandidateDto,
  DispatchScheduleConflictDto,
  DispatchScheduleSettingsDto,
} from '@/application/dispatch/dto/dispatch-dtos';
import type { DispatchConflictOverrideRepository } from '@/application/dispatch/ports/dispatch-conflict-override-repository';
import { DispatchConflictResolutionService } from '@/application/dispatch/services/dispatch-conflict-resolution';
import { DispatchPermissionPolicy } from '@/application/dispatch/services/dispatch-permission-policy';
import {
  AuthorizationError,
  DispatchScheduleConflictError,
  ValidationError,
} from '@/application/shared/errors/application-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import { NodeSha256DispatchConflictFingerprinter } from '@/infrastructure/dispatch/node-sha256-dispatch-conflict-fingerprinter';

const candidate: DispatchScheduleCandidateDto = {
  travelDate: '2026-08-30',
  driverPublicId: '01900000-0000-7000-8000-000000000803',
  vehiclePublicId: '01900000-0000-7000-8000-000000000804',
  excludedDispatchPublicId: null,
};
const settings: DispatchScheduleSettingsDto = {
  policy: 'WARN_AND_ACK',
  updatedByActorPublicId: null,
  updatedAt: '2026-08-29T00:00:00.000Z',
};
const conflicts: readonly DispatchScheduleConflictDto[] = [
  {
    dispatchPublicId: '01900000-0000-7000-8000-000000000805',
    conflictType: 'DRIVER_AND_VEHICLE',
    travelDate: '2026-08-30',
    status: 'DRAFT',
    destination: 'District Hospital',
    purpose: 'Deliver medical supplies',
    driver: {
      publicId: candidate.driverPublicId,
      name: 'Juan Dela Cruz',
    },
    vehicle: {
      publicId: candidate.vehiclePublicId,
      plateNumber: 'ABC-123',
      modelBrand: 'Toyota Hiace',
      vehicleType: 'Passenger Van',
    },
  },
];

function principal(permissions: readonly string[]) {
  return {
    userPublicId: '01900000-0000-7000-8000-000000000801',
    username: 'dispatch.officer',
    fullName: 'Dispatch Officer',
    roles: ['DISPATCH_OFFICER'],
    permissions,
    isPrivileged: false,
    mustChangePassword: false,
    mfaEnrolled: false,
  };
}

function overrides(hasEvidence = false): DispatchConflictOverrideRepository {
  return {
    async appendMany() {},
    async hasMatchingEvidence() {
      return hasEvidence;
    },
    async listForDispatch() {
      return [];
    },
  };
}

function service() {
  let nextId = 900;
  return new DispatchConflictResolutionService({
    permissions: new DispatchPermissionPolicy(),
    fingerprints: new NodeSha256DispatchConflictFingerprinter(),
    publicIds: {
      generate: () =>
        PublicId.from(`01900000-0000-7000-8000-${String(nextId++).padStart(12, '0')}`),
    },
  });
}

const input = (overridesInput: Record<string, unknown> = {}) => ({
  context: {
    principal: principal(['dispatch.conflict.override']),
    requestId: 'request-fvd-008',
    ipAddress: '127.0.0.1',
    userAgent: 'Vitest',
  },
  candidate,
  settings,
  conflicts,
  command: undefined,
  dispatchPublicId: '01900000-0000-7000-8000-000000000806',
  allowExistingEvidence: false,
  overrides: overrides(),
  at: new Date('2026-08-29T02:00:00.000Z'),
  ...overridesInput,
});

describe('DispatchConflictResolutionService', () => {
  it('returns the current safe conflict snapshot when acknowledgment is missing', async () => {
    await expect(service().resolve(input())).rejects.toMatchObject({
      code: 'DISPATCH_SCHEDULE_CONFLICT',
      context: {
        policy: 'WARN_AND_ACK',
        canOverride: true,
        conflicts,
      },
    });
  });

  it('blocks every conflict under BLOCK even with an otherwise current acknowledgment', async () => {
    const warning = await service()
      .resolve(input())
      .catch((error: DispatchScheduleConflictError) => error);
    const fingerprint = (warning as DispatchScheduleConflictError).context?.fingerprint;

    await expect(
      service().resolve(
        input({
          settings: { ...settings, policy: 'BLOCK' },
          command: {
            acknowledged: true,
            reason: 'Reviewed both schedules and approved the second trip.',
            fingerprint,
          },
        }),
      ),
    ).rejects.toBeInstanceOf(DispatchScheduleConflictError);
  });

  it('rejects a direct acknowledgment from an actor without override permission', async () => {
    await expect(
      service().resolve(
        input({
          context: {
            ...input().context,
            principal: principal([]),
          },
          command: {
            acknowledged: true,
            reason: 'Reviewed both schedules and approved the second trip.',
            fingerprint: 'a'.repeat(64),
          },
        }),
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it('returns a fresh conflict snapshot for a stale fingerprint', async () => {
    await expect(
      service().resolve(
        input({
          command: {
            acknowledged: true,
            reason: 'Reviewed both schedules and approved the second trip.',
            fingerprint: 'a'.repeat(64),
          },
        }),
      ),
    ).rejects.toMatchObject({ code: 'DISPATCH_SCHEDULE_CONFLICT' });
  });

  it('creates append-only rows and one protected audit event for a current acknowledgment', async () => {
    const warning = await service()
      .resolve(input())
      .catch((error: DispatchScheduleConflictError) => error);
    const fingerprint = (warning as DispatchScheduleConflictError).context?.fingerprint as string;
    const result = await service().resolve(
      input({
        command: {
          acknowledged: true,
          reason: '  Reviewed   both schedules and approved the second trip.  ',
          fingerprint,
        },
      }),
    );

    expect(result.overrideRows).toMatchObject([
      {
        conflictingDispatchPublicId: conflicts[0]?.dispatchPublicId,
        conflictType: 'DRIVER_AND_VEHICLE',
        policy: 'WARN_AND_ACK',
        reason: 'Reviewed both schedules and approved the second trip.',
      },
    ]);
    expect(result.auditEvent).toMatchObject({
      action: 'vehicle_dispatch.conflict_override_acknowledged',
      entity: { type: 'vehicle_dispatch', publicId: input().dispatchPublicId },
      metadata: {
        reason: 'Reviewed both schedules and approved the second trip.',
        conflictCount: 1,
      },
    });
  });

  it('reuses exact evidence only when every current conflict is covered', async () => {
    await expect(
      service().resolve(input({ allowExistingEvidence: true, overrides: overrides(true) })),
    ).resolves.toEqual({ overrideRows: [], auditEvent: null });
  });

  it('rejects acknowledgment evidence when the final conflict set is empty', async () => {
    await expect(
      service().resolve(
        input({
          conflicts: [],
          command: {
            acknowledged: true,
            reason: 'Reviewed both schedules and approved the second trip.',
            fingerprint: 'a'.repeat(64),
          },
        }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
