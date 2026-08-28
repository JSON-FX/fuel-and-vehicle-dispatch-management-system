import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthorizationError } from '@/application/shared/errors/application-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';

const mocks = vi.hoisted(() => ({
  authenticateSession: vi.fn(),
  assertCanCreate: vi.fn(),
  assertCanRead: vi.fn(),
  assertCanPost: vi.fn(),
  assertCanVoid: vi.fn(),
  recordDenial: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  post: vi.fn(),
  void: vi.fn(),
  balances: vi.fn(),
  preparationOptions: vi.fn(),
}));

vi.mock('@/infrastructure/composition/root', () => ({
  createApplicationComposition: () => ({
    authenticateSession: { execute: mocks.authenticateSession },
    authorizePermission: { execute: vi.fn() },
    recordAuthorizationDenial: { execute: mocks.recordDenial },
    fuelPermissions: {
      assertCanCreate: mocks.assertCanCreate,
      assertCanRead: mocks.assertCanRead,
      assertCanPost: mocks.assertCanPost,
      assertCanVoid: mocks.assertCanVoid,
    },
    listFuelIssuances: { execute: mocks.list },
    createFuelIssuance: { execute: mocks.create },
    getFuelIssuance: { execute: mocks.get },
    updateDraftFuelIssuance: { execute: mocks.update },
    postFuelIssuance: { execute: mocks.post },
    voidFuelIssuance: { execute: mocks.void },
    getFuelBalances: { execute: mocks.balances },
    getFuelPreparationOptions: { execute: mocks.preparationOptions },
    authAllowedOrigin: 'https://fvdms.lan',
    secureTokenGenerator: {
      hashToken: (token: string) => new TextEncoder().encode(`hash:${token}`),
    },
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() },
    publicIdGenerator: { generate: () => PublicId.from('019c043f-422c-7141-8a03-a9d9bda3544a') },
  }),
}));

import { GET, POST } from '@/app/api/fuel-issuances/route';
import { GET as GET_ITEM, PATCH } from '@/app/api/fuel-issuances/[fuelIssuanceId]/route';
import { POST as POST_ISSUANCE } from '@/app/api/fuel-issuances/[fuelIssuanceId]/post/route';
import { POST as VOID_ISSUANCE } from '@/app/api/fuel-issuances/[fuelIssuanceId]/void/route';
import { GET as GET_BALANCES } from '@/app/api/fuel-balances/route';
import { GET as GET_PREPARATION_OPTIONS } from '@/app/api/fuel-preparation-options/route';

const principal = {
  userPublicId: '019c043f-422c-7141-8a03-a9d9bda3544b',
  username: 'fuel.staff',
  fullName: 'Fuel Staff',
  roles: ['PSMD_STAFF'],
  permissions: ['fuel.create', 'fuel.read', 'fuel.post', 'fuel.void'],
  isPrivileged: false,
  mustChangePassword: false,
  mfaEnrolled: false,
};
const issuanceId = '019c043f-422c-7141-8a03-a9d9bda3544d';
const driverId = '019c043f-422c-7141-8a03-a9d9bda3544e';
const vehicleId = '019c043f-422c-7141-8a03-a9d9bda3544f';
const allocationId = '019c043f-422c-7141-8a03-a9d9bda35450';
const routeContext = { params: Promise.resolve({ fuelIssuanceId: issuanceId }) };
const draft = {
  purchaseRequestNumber: 'PR-2026-001',
  entryDate: '2026-08-28',
  driverPublicId: driverId,
  destination: 'AOR',
  purpose: 'Provincial operations',
  vehiclePublicId: vehicleId,
  requestedLiters: '30',
  isFullTank: false,
  issuedLiters: null,
  unitPrice: '61.25',
  budgetAllocationPublicId: allocationId,
  fuelType: 'DIESEL',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticateSession.mockResolvedValue({
    sessionPublicId: issuanceId,
    csrfTokenHash: new TextEncoder().encode('hash:csrf-token'),
    principal,
  });
});

describe('fuel Route Handlers', () => {
  it('lists with read access and creates only after create and CSRF checks', async () => {
    mocks.list.mockResolvedValue({ items: [], nextCursor: null, previousCursor: null });
    mocks.create.mockResolvedValue({ publicId: issuanceId, status: 'DRAFT' });
    expect(
      (await GET(authenticatedRequest('https://fvdms.lan/api/fuel-issuances?pageSize=25'))).status,
    ).toBe(200);
    const created = await POST(
      mutationRequest('POST', 'https://fvdms.lan/api/fuel-issuances', draft),
    );
    expect(created.status).toBe(201);
    expect(mocks.assertCanRead).toHaveBeenCalledWith(principal);
    expect(mocks.assertCanCreate).toHaveBeenCalledWith(principal);
  });

  it('rejects client-owned RIS, totals, status, and actor fields', async () => {
    const response = await POST(
      mutationRequest('POST', 'https://fvdms.lan/api/fuel-issuances', {
        ...draft,
        risNumber: '2026-08-001',
        totalAmount: '1837.50',
        status: 'POSTED',
        createdByActorPublicId: principal.userPublicId,
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('gets history and forwards complete draft replacements', async () => {
    mocks.get.mockResolvedValue({ publicId: issuanceId });
    mocks.update.mockResolvedValue({ publicId: issuanceId, status: 'DRAFT' });
    expect(
      (
        await GET_ITEM(
          authenticatedRequest(`https://fvdms.lan/api/fuel-issuances/${issuanceId}`),
          routeContext,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await PATCH(
          mutationRequest('PATCH', `https://fvdms.lan/api/fuel-issuances/${issuanceId}`, {
            ...draft,
            purpose: 'Updated operations',
          }),
          routeContext,
        )
      ).status,
    ).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        command: expect.objectContaining({ purpose: 'Updated operations' }),
      }),
    );
  });

  it('enforces independent post and void permissions with strict bodies', async () => {
    mocks.post.mockResolvedValue({ publicId: issuanceId, status: 'POSTED' });
    mocks.void.mockResolvedValue({ publicId: issuanceId, status: 'VOIDED' });
    expect(
      (
        await POST_ISSUANCE(
          mutationRequest('POST', `https://fvdms.lan/api/fuel-issuances/${issuanceId}/post`, {
            issuedLiters: '30.125',
          }),
          routeContext,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await VOID_ISSUANCE(
          mutationRequest('POST', `https://fvdms.lan/api/fuel-issuances/${issuanceId}/void`, {
            reason: 'Duplicate dispatch entry',
          }),
          routeContext,
        )
      ).status,
    ).toBe(200);
    expect(mocks.assertCanPost).toHaveBeenCalledWith(principal);
    expect(mocks.assertCanVoid).toHaveBeenCalledWith(principal);
  });

  it('reads inclusive balances and audits denied access', async () => {
    mocks.balances.mockResolvedValue([]);
    expect(
      (
        await GET_BALANCES(
          authenticatedRequest(
            'https://fvdms.lan/api/fuel-balances?startDate=2026-08-01&endDate=2026-08-31',
          ),
        )
      ).status,
    ).toBe(200);
    mocks.assertCanRead.mockImplementationOnce(() => {
      throw new AuthorizationError();
    });
    expect((await GET(authenticatedRequest('https://fvdms.lan/api/fuel-issuances'))).status).toBe(
      403,
    );
    expect(mocks.recordDenial).toHaveBeenCalledOnce();
  });

  it('loads preparation options with create access and a strict entry date', async () => {
    mocks.preparationOptions.mockResolvedValue({ drivers: [], vehicles: [], allocations: [] });
    const response = await GET_PREPARATION_OPTIONS(
      authenticatedRequest('https://fvdms.lan/api/fuel-preparation-options?entryDate=2026-08-28'),
    );
    expect(response.status).toBe(200);
    expect(mocks.assertCanCreate).toHaveBeenCalledWith(principal);
    expect(mocks.preparationOptions).toHaveBeenCalledWith(
      expect.objectContaining({ entryDate: '2026-08-28' }),
    );
    expect(
      (
        await GET_PREPARATION_OPTIONS(
          authenticatedRequest(
            'https://fvdms.lan/api/fuel-preparation-options?entryDate=not-a-date&extra=true',
          ),
        )
      ).status,
    ).toBe(400);
  });
});

function authenticatedRequest(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('cookie', '__Host-fvdms_session=opaque-session');
  return new Request(url, { ...init, headers });
}
function mutationRequest(method: 'POST' | 'PATCH', url: string, body: unknown) {
  return authenticatedRequest(url, {
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
