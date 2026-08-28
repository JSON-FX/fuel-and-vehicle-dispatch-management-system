import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthorizationError } from '@/application/shared/errors/application-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';

const mocks = vi.hoisted(() => ({
  authenticateSession: vi.fn(),
  assertCanManage: vi.fn(),
  assertCanRead: vi.fn(),
  recordDenial: vi.fn(),
  listBudgetAllocations: vi.fn(),
  listOperationalBudgetAllocations: vi.fn(),
  createBudgetAllocation: vi.fn(),
  getBudgetAllocation: vi.fn(),
  updateBudgetAllocation: vi.fn(),
  softDeleteBudgetAllocation: vi.fn(),
  restoreBudgetAllocation: vi.fn(),
}));

vi.mock('@/infrastructure/composition/root', () => ({
  createApplicationComposition: () => ({
    authenticateSession: { execute: mocks.authenticateSession },
    authorizePermission: { execute: vi.fn() },
    recordAuthorizationDenial: { execute: mocks.recordDenial },
    budgetPermissions: {
      assertCanManage: mocks.assertCanManage,
      assertCanRead: mocks.assertCanRead,
    },
    listBudgetAllocations: { execute: mocks.listBudgetAllocations },
    listOperationalBudgetAllocations: { execute: mocks.listOperationalBudgetAllocations },
    createBudgetAllocation: { execute: mocks.createBudgetAllocation },
    getBudgetAllocation: { execute: mocks.getBudgetAllocation },
    updateBudgetAllocation: { execute: mocks.updateBudgetAllocation },
    softDeleteBudgetAllocation: { execute: mocks.softDeleteBudgetAllocation },
    restoreBudgetAllocation: { execute: mocks.restoreBudgetAllocation },
    authAllowedOrigin: 'https://fvdms.lan',
    secureTokenGenerator: {
      hashToken: (token: string) => new TextEncoder().encode(`hash:${token}`),
    },
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() },
    publicIdGenerator: {
      generate: () => PublicId.from('019c043f-422c-7141-8a03-a9d9bda3544a'),
    },
  }),
}));

import { GET, POST } from '@/app/api/budget-allocations/route';
import { GET as GET_ITEM, PATCH } from '@/app/api/budget-allocations/[budgetAllocationId]/route';
import { POST as SOFT_DELETE } from '@/app/api/budget-allocations/[budgetAllocationId]/soft-delete/route';
import { POST as RESTORE } from '@/app/api/budget-allocations/[budgetAllocationId]/restore/route';

const principal = {
  userPublicId: '019c043f-422c-7141-8a03-a9d9bda3544b',
  username: 'budget.officer',
  fullName: 'Budget Officer',
  roles: ['BUDGET_OFFICER'],
  permissions: ['budget.manage', 'budget.read'],
  isPrivileged: false,
  mustChangePassword: false,
  mfaEnrolled: true,
};
const allocationId = '019c043f-422c-7141-8a03-a9d9bda3544d';
const officeId = '019c043f-422c-7141-8a03-a9d9bda3544e';
const routeContext = { params: Promise.resolve({ budgetAllocationId: allocationId }) };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticateSession.mockResolvedValue({
    sessionPublicId: '019c043f-422c-7141-8a03-a9d9bda3544c',
    csrfTokenHash: new TextEncoder().encode('hash:csrf-token'),
    principal,
  });
});

describe('/api/budget-allocations', () => {
  it('uses read authorization for bounded administration and operational lists', async () => {
    mocks.listBudgetAllocations.mockResolvedValue({
      items: [],
      nextCursor: null,
      previousCursor: null,
    });
    mocks.listOperationalBudgetAllocations.mockResolvedValue({
      items: [],
      nextCursor: null,
      previousCursor: null,
    });

    const admin = await GET(
      authenticatedRequest('https://fvdms.lan/api/budget-allocations?mode=admin&pageSize=200'),
    );
    const operational = await GET(
      authenticatedRequest(
        'https://fvdms.lan/api/budget-allocations?mode=operational&effectiveDate=2027-01-01',
      ),
    );

    expect(admin.status).toBe(200);
    expect(operational.status).toBe(200);
    expect(mocks.assertCanRead).toHaveBeenCalledTimes(2);
    expect(mocks.listOperationalBudgetAllocations).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ effectiveDate: '2027-01-01' }) }),
    );
  });

  it('creates a draft only after management and CSRF checks', async () => {
    mocks.createBudgetAllocation.mockResolvedValue({ publicId: allocationId, status: 'DRAFT' });
    const response = await POST(
      mutationRequest('POST', 'https://fvdms.lan/api/budget-allocations', {
        ppmpNumber: ' ppmp-001 ',
        officePublicId: officeId,
        quarter: 3,
        fiscalYear: 2026,
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.assertCanManage).toHaveBeenCalledWith(principal);
    expect(mocks.createBudgetAllocation).toHaveBeenCalledWith(
      expect.objectContaining({ command: expect.objectContaining({ ppmpNumber: 'PPMP-001' }) }),
    );
  });

  it('gets historical items with read access and forwards discriminated patches', async () => {
    mocks.getBudgetAllocation.mockResolvedValue({ publicId: allocationId });
    mocks.updateBudgetAllocation.mockResolvedValue({ publicId: allocationId, status: 'CANCELLED' });

    expect(
      (
        await GET_ITEM(
          authenticatedRequest(`https://fvdms.lan/api/budget-allocations/${allocationId}`),
          routeContext,
        )
      ).status,
    ).toBe(200);
    const response = await PATCH(
      mutationRequest('PATCH', `https://fvdms.lan/api/budget-allocations/${allocationId}`, {
        action: 'cancel',
        reason: 'Funding source changed.',
      }),
      routeContext,
    );
    expect(response.status).toBe(200);
    expect(mocks.updateBudgetAllocation).toHaveBeenCalledWith(
      expect.objectContaining({
        publicId: allocationId,
        command: { action: 'cancel', reason: 'Funding source changed.' },
      }),
    );
  });

  it('soft-deletes with a reason and restores only an empty body', async () => {
    const deleted = await SOFT_DELETE(
      mutationRequest(
        'POST',
        `https://fvdms.lan/api/budget-allocations/${allocationId}/soft-delete`,
        {
          reason: 'Superseded allocation record.',
        },
      ),
      routeContext,
    );
    const restored = await RESTORE(
      mutationRequest(
        'POST',
        `https://fvdms.lan/api/budget-allocations/${allocationId}/restore`,
        {},
      ),
      routeContext,
    );

    expect(deleted.status).toBe(200);
    expect(restored.status).toBe(200);
    expect(mocks.softDeleteBudgetAllocation).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'Superseded allocation record.' }),
    );
    expect(mocks.restoreBudgetAllocation).toHaveBeenCalledOnce();
  });

  it('records authorization denials and rejects untrusted or malformed mutations', async () => {
    mocks.assertCanRead.mockImplementationOnce(() => {
      throw new AuthorizationError();
    });
    const denied = await GET(authenticatedRequest('https://fvdms.lan/api/budget-allocations'));
    expect(denied.status).toBe(403);
    expect(mocks.recordDenial).toHaveBeenCalledOnce();

    const untrusted = await POST(
      authenticatedRequest('https://fvdms.lan/api/budget-allocations', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://attacker.invalid' },
        body: '{}',
      }),
    );
    expect(untrusted.status).toBe(403);
    expect(mocks.createBudgetAllocation).not.toHaveBeenCalled();
  });
});

function authenticatedRequest(url: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set('cookie', '__Host-fvdms_session=opaque-session');
  return new Request(url, { ...init, headers });
}

function mutationRequest(method: 'POST' | 'PATCH', url: string, body: unknown): Request {
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
