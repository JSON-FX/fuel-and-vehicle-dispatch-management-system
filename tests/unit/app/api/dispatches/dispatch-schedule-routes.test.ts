import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicId } from '@/domain/shared/value-objects/public-id';

const dispatchId = '019c043f-422c-7141-8a03-a9d9bda3544a';
const driverId = '019c043f-422c-7141-8a03-a9d9bda3544b';
const vehicleId = '019c043f-422c-7141-8a03-a9d9bda3544c';

const mocks = vi.hoisted(() => ({
  authenticateSession: vi.fn(),
  assertCanRead: vi.fn(),
  assertCanManageSettings: vi.fn(),
  recordDenial: vi.fn(),
  availability: vi.fn(),
  schedule: vi.fn(),
  driverSchedule: vi.fn(),
  vehicleSchedule: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock('@/infrastructure/composition/root', () => ({
  createApplicationComposition: () => ({
    authenticateSession: { execute: mocks.authenticateSession },
    authorizePermission: { execute: vi.fn() },
    recordAuthorizationDenial: { execute: mocks.recordDenial },
    dispatchPermissions: {
      assertCanRead: mocks.assertCanRead,
      assertCanManageSettings: mocks.assertCanManageSettings,
    },
    checkDispatchScheduleAvailability: { execute: mocks.availability },
    getDispatchSchedule: { execute: mocks.schedule },
    getDriverSchedule: { execute: mocks.driverSchedule },
    getVehicleSchedule: { execute: mocks.vehicleSchedule },
    getDispatchScheduleSettings: { execute: mocks.getSettings },
    updateDispatchScheduleSettings: { execute: mocks.updateSettings },
    authAllowedOrigin: 'https://fvdms.lan',
    secureTokenGenerator: {
      hashToken: (token: string) => new TextEncoder().encode(`hash:${token}`),
    },
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() },
    publicIdGenerator: { generate: () => PublicId.from(dispatchId) },
  }),
}));

import { GET as GET_CONFLICTS } from '@/app/api/dispatches/conflicts/route';
import { GET as GET_SCHEDULE } from '@/app/api/dispatches/schedule/route';
import { GET as GET_DRIVER_SCHEDULE } from '@/app/api/drivers/[driverId]/schedule/route';
import { GET as GET_VEHICLE_SCHEDULE } from '@/app/api/vehicles/[vehicleId]/schedule/route';
import {
  GET as GET_SETTINGS,
  PATCH as PATCH_SETTINGS,
} from '@/app/api/dispatch-schedule-settings/route';

const principal = {
  userPublicId: dispatchId,
  username: 'dispatch.officer',
  fullName: 'Dispatch Officer',
  roles: ['DISPATCH_OFFICER'],
  permissions: ['dispatch.read', 'dispatch.settings.manage'],
  isPrivileged: false,
  mustChangePassword: false,
  mfaEnrolled: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticateSession.mockResolvedValue({
    sessionPublicId: dispatchId,
    csrfTokenHash: new TextEncoder().encode('hash:csrf-token'),
    principal,
  });
  mocks.availability.mockResolvedValue({ conflicts: [] });
  mocks.schedule.mockResolvedValue({ events: [], occupancy: [], truncated: false });
  mocks.driverSchedule.mockResolvedValue({ events: [], occupancy: [], truncated: false });
  mocks.vehicleSchedule.mockResolvedValue({ events: [], occupancy: [], truncated: false });
  mocks.getSettings.mockResolvedValue({ policy: 'WARN_AND_ACK' });
  mocks.updateSettings.mockResolvedValue({ policy: 'BLOCK' });
});

describe('dispatch schedule Route Handlers', () => {
  it('forwards strict advisory and bounded schedule queries', async () => {
    const conflicts = await GET_CONFLICTS(
      request(
        `/api/dispatches/conflicts?travelDate=2026-08-29&driverPublicId=${driverId}&vehiclePublicId=${vehicleId}`,
      ),
    );
    const schedule = await GET_SCHEDULE(
      request('/api/dispatches/schedule?from=2026-08-01&to=2026-08-31'),
    );

    expect(conflicts.status).toBe(200);
    expect(schedule.status).toBe(200);
    expect(mocks.availability).toHaveBeenCalledWith(
      expect.objectContaining({
        candidate: expect.objectContaining({
          driverPublicId: driverId,
          vehiclePublicId: vehicleId,
        }),
      }),
    );
    expect(mocks.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ limit: 200 }) }),
    );
  });

  it('awaits resource params and rejects duplicate or oversized schedule queries', async () => {
    expect(
      (
        await GET_DRIVER_SCHEDULE(
          request('/api/drivers/id/schedule?from=2026-08-01&to=2026-08-31'),
          { params: Promise.resolve({ driverId }) },
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await GET_VEHICLE_SCHEDULE(
          request('/api/vehicles/id/schedule?from=2026-08-01&to=2026-08-31'),
          { params: Promise.resolve({ vehicleId }) },
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await GET_SCHEDULE(
          request('/api/dispatches/schedule?from=2026-08-01&from=2026-08-02&to=2026-08-31'),
        )
      ).status,
    ).toBe(400);
    expect(
      (await GET_SCHEDULE(request('/api/dispatches/schedule?from=2026-08-01&to=2026-09-30')))
        .status,
    ).toBe(400);
  });

  it('protects settings reads and mutations with exact permission and CSRF checks', async () => {
    expect((await GET_SETTINGS(request('/api/dispatch-schedule-settings'))).status).toBe(200);
    expect((await PATCH_SETTINGS(mutationRequest({ policy: 'BLOCK' }))).status).toBe(200);
    expect(mocks.assertCanManageSettings).toHaveBeenCalledTimes(2);
    expect(mocks.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ command: { policy: 'BLOCK' } }),
    );
  });
});

function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('cookie', '__Host-fvdms_session=opaque-session');
  return new Request(`https://fvdms.lan${path}`, { ...init, headers });
}

function mutationRequest(body: unknown) {
  return request('/api/dispatch-schedule-settings', {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      origin: 'https://fvdms.lan',
      'sec-fetch-site': 'same-origin',
      'x-csrf-token': 'csrf-token',
    },
    body: JSON.stringify(body),
  });
}
