import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthorizationError } from '@/application/shared/errors/application-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';

const mocks = vi.hoisted(() => ({
  authenticateSession: vi.fn(),
  assertCanCreate: vi.fn(),
  assertCanRead: vi.fn(),
  assertCanUpdate: vi.fn(),
  assertCanComplete: vi.fn(),
  assertCanCancel: vi.fn(),
  recordDenial: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  dispatch: vi.fn(),
  complete: vi.fn(),
  cancel: vi.fn(),
  preparationOptions: vi.fn(),
}));

vi.mock('@/infrastructure/composition/root', () => ({
  createApplicationComposition: () => ({
    authenticateSession: { execute: mocks.authenticateSession },
    authorizePermission: { execute: vi.fn() },
    recordAuthorizationDenial: { execute: mocks.recordDenial },
    dispatchPermissions: {
      assertCanCreate: mocks.assertCanCreate,
      assertCanRead: mocks.assertCanRead,
      assertCanUpdate: mocks.assertCanUpdate,
      assertCanComplete: mocks.assertCanComplete,
      assertCanCancel: mocks.assertCanCancel,
    },
    listDispatches: { execute: mocks.list },
    createDispatch: { execute: mocks.create },
    getDispatch: { execute: mocks.get },
    updateDraftDispatch: { execute: mocks.update },
    dispatchVehicle: { execute: mocks.dispatch },
    completeDispatch: { execute: mocks.complete },
    cancelDispatch: { execute: mocks.cancel },
    getDispatchPreparationOptions: { execute: mocks.preparationOptions },
    authAllowedOrigin: 'https://fvdms.lan',
    secureTokenGenerator: {
      hashToken: (token: string) => new TextEncoder().encode(`hash:${token}`),
    },
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() },
    publicIdGenerator: { generate: () => PublicId.from(dispatchId) },
  }),
}));

import { GET, POST } from '@/app/api/dispatches/route';
import { GET as GET_ITEM, PATCH } from '@/app/api/dispatches/[dispatchId]/route';
import { POST as DISPATCH_VEHICLE } from '@/app/api/dispatches/[dispatchId]/dispatch/route';
import { POST as COMPLETE_DISPATCH } from '@/app/api/dispatches/[dispatchId]/complete/route';
import { POST as CANCEL_DISPATCH } from '@/app/api/dispatches/[dispatchId]/cancel/route';
import { GET as GET_PREPARATION_OPTIONS } from '@/app/api/dispatch-preparation-options/route';

const dispatchId = '019c043f-422c-7141-8a03-a9d9bda3544a';
const driverId = '019c043f-422c-7141-8a03-a9d9bda3544b';
const vehicleId = '019c043f-422c-7141-8a03-a9d9bda3544c';
const officeId = '019c043f-422c-7141-8a03-a9d9bda3544d';
const principal = {
  userPublicId: dispatchId,
  username: 'dispatch.officer',
  fullName: 'Dispatch Officer',
  roles: ['DISPATCH_OFFICER'],
  permissions: [
    'dispatch.create',
    'dispatch.read',
    'dispatch.update',
    'dispatch.complete',
    'dispatch.cancel',
  ],
  isPrivileged: false,
  mustChangePassword: false,
  mfaEnrolled: false,
};
const routeContext = { params: Promise.resolve({ dispatchId }) };
const draft = {
  entryDate: '2026-08-28',
  travelDate: '2026-08-29',
  driverPublicId: driverId,
  vehiclePublicId: vehicleId,
  requestingOfficePublicId: officeId,
  destination: 'District Hospital',
  purpose: 'Transfer medical supplies',
  odoBefore: '1250.4',
  passengerCount: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticateSession.mockResolvedValue({
    sessionPublicId: dispatchId,
    csrfTokenHash: new TextEncoder().encode('hash:csrf-token'),
    principal,
  });
});

describe('dispatch Route Handlers', () => {
  it('lists with read access and creates only after create and CSRF checks', async () => {
    mocks.list.mockResolvedValue({ items: [], nextCursor: null, previousCursor: null });
    mocks.create.mockResolvedValue({ publicId: dispatchId, status: 'DRAFT' });
    expect((await GET(authenticatedRequest('/api/dispatches?pageSize=25'))).status).toBe(200);
    expect((await POST(mutationRequest('POST', '/api/dispatches', draft))).status).toBe(201);
    expect(mocks.assertCanRead).toHaveBeenCalledWith(principal);
    expect(mocks.assertCanCreate).toHaveBeenCalledWith(principal);
  });

  it('rejects client-controlled status, final odometer, and lifecycle evidence', async () => {
    const response = await POST(
      mutationRequest('POST', '/api/dispatches', {
        ...draft,
        status: 'DISPATCHED',
        odoAfter: '1260.4',
        dispatchedAt: '2026-08-28T10:00:00.000Z',
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('gets historical detail and forwards complete draft replacements', async () => {
    mocks.get.mockResolvedValue({ publicId: dispatchId });
    mocks.update.mockResolvedValue({ publicId: dispatchId, status: 'DRAFT' });
    expect(
      (await GET_ITEM(authenticatedRequest(`/api/dispatches/${dispatchId}`), routeContext)).status,
    ).toBe(200);
    expect(
      (
        await PATCH(
          mutationRequest('PATCH', `/api/dispatches/${dispatchId}`, {
            ...draft,
            purpose: 'Updated medical transfer',
          }),
          routeContext,
        )
      ).status,
    ).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        publicId: dispatchId,
        command: expect.objectContaining({ purpose: 'Updated medical transfer' }),
      }),
    );
  });

  it('enforces independent dispatch, completion, and cancellation permissions', async () => {
    mocks.dispatch.mockResolvedValue({ publicId: dispatchId, status: 'DISPATCHED' });
    mocks.complete.mockResolvedValue({ publicId: dispatchId, status: 'COMPLETED' });
    mocks.cancel.mockResolvedValue({ publicId: dispatchId, status: 'CANCELLED' });
    expect(
      (
        await DISPATCH_VEHICLE(
          mutationRequest('POST', `/api/dispatches/${dispatchId}/dispatch`, {}),
          routeContext,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await COMPLETE_DISPATCH(
          mutationRequest('POST', `/api/dispatches/${dispatchId}/complete`, {
            odoAfter: '1260.4',
          }),
          routeContext,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await CANCEL_DISPATCH(
          mutationRequest('POST', `/api/dispatches/${dispatchId}/cancel`, {
            reason: 'Vehicle became unavailable.',
          }),
          routeContext,
        )
      ).status,
    ).toBe(200);
    expect(mocks.assertCanUpdate).toHaveBeenCalledWith(principal);
    expect(mocks.assertCanComplete).toHaveBeenCalledWith(principal);
    expect(mocks.assertCanCancel).toHaveBeenCalledWith(principal);
  });

  it('loads preparation options with create access', async () => {
    mocks.preparationOptions.mockResolvedValue({ offices: [], drivers: [], vehicles: [] });
    const response = await GET_PREPARATION_OPTIONS(
      authenticatedRequest('/api/dispatch-preparation-options'),
    );
    expect(response.status).toBe(200);
    expect(mocks.assertCanCreate).toHaveBeenCalledWith(principal);
    expect(mocks.preparationOptions).toHaveBeenCalledWith(
      expect.objectContaining({ context: expect.anything() }),
    );
  });

  it('records durable authorization denials without invoking the list use case', async () => {
    mocks.assertCanRead.mockImplementationOnce(() => {
      throw new AuthorizationError();
    });
    expect((await GET(authenticatedRequest('/api/dispatches'))).status).toBe(403);
    expect(mocks.recordDenial).toHaveBeenCalledOnce();
    expect(mocks.list).not.toHaveBeenCalled();
  });
});

function authenticatedRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('cookie', '__Host-fvdms_session=opaque-session');
  return new Request(`https://fvdms.lan${path}`, { ...init, headers });
}

function mutationRequest(method: 'POST' | 'PATCH', path: string, body: unknown) {
  return authenticatedRequest(path, {
    method,
    headers: {
      'content-type': 'application/json',
      origin: 'https://fvdms.lan',
      'sec-fetch-site': 'same-origin',
      'x-csrf-token': 'csrf-token',
    },
    body: JSON.stringify(body),
  });
}
