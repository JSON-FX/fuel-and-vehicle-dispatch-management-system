import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError } from '@/application/shared/errors/application-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';

const mocks = vi.hoisted(() => ({
  authenticateSession: vi.fn(),
  assertCanManage: vi.fn(),
  assertCanRead: vi.fn(),
  listVehicles: vi.fn(),
  listOperationalVehicleOptions: vi.fn(),
  createVehicle: vi.fn(),
  updateVehicle: vi.fn(),
}));

vi.mock('@/infrastructure/composition/root', () => ({
  createApplicationComposition: () => ({
    authenticateSession: { execute: mocks.authenticateSession },
    authorizePermission: { execute: vi.fn() },
    recordAuthorizationDenial: { execute: vi.fn() },
    masterDataPermissions: {
      assertCanManage: mocks.assertCanManage,
      assertCanRead: mocks.assertCanRead,
    },
    listVehicles: { execute: mocks.listVehicles },
    listOperationalVehicleOptions: { execute: mocks.listOperationalVehicleOptions },
    createVehicle: { execute: mocks.createVehicle },
    updateVehicle: { execute: mocks.updateVehicle },
    authAllowedOrigin: 'https://fvdms.lan',
    secureTokenGenerator: {
      hashToken: (token: string) => new TextEncoder().encode(`hash:${token}`),
    },
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() },
    publicIdGenerator: { generate: () => PublicId.from('019c043f-422c-7141-8a03-a9d9bda3544a') },
  }),
}));

import { POST } from '@/app/api/vehicles/route';
import { PATCH } from '@/app/api/vehicles/[vehicleId]/route';

const principal = {
  userPublicId: '019c043f-422c-7141-8a03-a9d9bda3544b',
  username: 'administrator',
  fullName: 'System Administrator',
  roles: ['SYSTEM_ADMIN'],
  permissions: ['vehicle.manage'],
  isPrivileged: true,
  mustChangePassword: false,
  mfaEnrolled: true,
};
const vehicleId = '019c043f-422c-7141-8a03-a9d9bda3544d';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticateSession.mockResolvedValue({
    sessionPublicId: '019c043f-422c-7141-8a03-a9d9bda3544c',
    csrfTokenHash: new TextEncoder().encode('hash:csrf-token'),
    principal,
  });
});

describe('/api/vehicles', () => {
  it('returns field-specific plate conflicts without internal details', async () => {
    mocks.createVehicle.mockRejectedValue(
      new ConflictError('A unique master-data value already exists.', [
        { field: 'plateNumber', reason: 'This value is already in use.' },
      ]),
    );
    const response = await POST(
      mutationRequest('https://fvdms.lan/api/vehicles', {
        modelBrand: 'Toyota Hiace',
        vehicleType: 'Passenger Van',
        plateNumber: 'ABC-123',
      }),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      success: false,
      error: { details: [{ field: 'plateNumber', reason: 'This value is already in use.' }] },
    });
  });

  it('accepts an explicit serviceability transition through PATCH', async () => {
    mocks.updateVehicle.mockResolvedValue({ publicId: vehicleId, status: 'UNSERVICEABLE' });
    const request = mutationRequest(`https://fvdms.lan/api/vehicles/${vehicleId}`, {
      status: 'UNSERVICEABLE',
    });
    const response = await PATCH(request, { params: Promise.resolve({ vehicleId }) });
    expect(response.status).toBe(200);
    expect(mocks.updateVehicle).toHaveBeenCalledWith(
      expect.objectContaining({ command: { status: 'UNSERVICEABLE' } }),
    );
  });
});

function mutationRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: {
      cookie: '__Host-fvdms_session=opaque-session',
      'content-type': 'application/json',
      origin: 'https://fvdms.lan',
      'sec-fetch-site': 'same-origin',
      'x-csrf-token': 'csrf-token',
    },
    body: JSON.stringify(body),
  });
}
