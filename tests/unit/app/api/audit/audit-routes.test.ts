import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthorizationError } from '@/application/shared/errors/application-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';

const mocks = vi.hoisted(() => ({
  authenticateSession: vi.fn(),
  authorizePermission: vi.fn(),
  recordAuthorizationDenial: vi.fn(),
  searchAuditEvents: vi.fn(),
  getAuditEvent: vi.fn(),
  getLatestAuditVerification: vi.fn(),
}));

vi.mock('@/infrastructure/composition/root', () => ({
  createApplicationComposition: () => ({
    authenticateSession: { execute: mocks.authenticateSession },
    authorizePermission: { execute: mocks.authorizePermission },
    recordAuthorizationDenial: { execute: mocks.recordAuthorizationDenial },
    searchAuditEvents: { execute: mocks.searchAuditEvents },
    getAuditEvent: { execute: mocks.getAuditEvent },
    getLatestAuditVerification: { execute: mocks.getLatestAuditVerification },
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() },
    publicIdGenerator: {
      generate: () => PublicId.from('01900000-0000-7000-8000-000000001301'),
    },
  }),
}));

import { GET as GET_AUDIT_DETAIL } from '@/app/api/audit-events/[eventId]/route';
import { GET as GET_AUDIT_EVENTS } from '@/app/api/audit-events/route';
import { GET as GET_VERIFICATION } from '@/app/api/audit-verification/latest/route';

const principal = {
  userPublicId: '01900000-0000-7000-8000-000000001302',
  username: 'auditor',
  fullName: 'Government Auditor',
  roles: ['AUDITOR'],
  permissions: ['audit.read', 'audit.read_sensitive'],
  isPrivileged: true,
  mustChangePassword: false,
  mfaEnrolled: true,
};
const eventPublicId = '01900000-0000-7000-8000-000000001303';
const requestId = '01900000-0000-7000-8000-000000001304';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticateSession.mockResolvedValue({
    sessionPublicId: '01900000-0000-7000-8000-000000001305',
    csrfTokenHash: new Uint8Array(32),
    principal,
  });
  mocks.recordAuthorizationDenial.mockResolvedValue(undefined);
});

describe('audit Route Handlers', () => {
  it('parses bounded structured search filters and preserves no-store envelopes', async () => {
    mocks.searchAuditEvents.mockResolvedValue({
      items: [],
      previousCursor: null,
      nextCursor: null,
    });
    const response = await GET_AUDIT_EVENTS(
      authenticatedRequest(
        `https://fvdms.lan/api/audit-events?action=auth.login.failed&entityType=user&pageSize=25&from=&to=&entityPublicId=&actorPublicId=&requestId=`,
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-request-id')).toBe(requestId);
    expect(mocks.authorizePermission).toHaveBeenCalledWith(principal, 'audit.read');
    expect(mocks.searchAuditEvents).toHaveBeenCalledWith({
      actor: principal,
      requestId,
      ipAddress: '192.0.2.50',
      userAgent: 'Audit route test',
      query: {
        from: null,
        to: null,
        action: 'auth.login.failed',
        entityType: 'user',
        entityPublicId: null,
        actorPublicId: null,
        requestId: null,
        cursor: null,
        pageSize: 25,
      },
    });
  });

  it('returns the stable validation envelope for unknown or oversized search input', async () => {
    const response = await GET_AUDIT_EVENTS(
      authenticatedRequest('https://fvdms.lan/api/audit-events?pageSize=101&unknown=value'),
    );

    expect(response.status).toBe(400);
    expect(mocks.searchAuditEvents).not.toHaveBeenCalled();
    expect((await response.json()).error.code).toBe('VALIDATION_ERROR');
  });

  it('passes validated public identity and safe request context to detail reads', async () => {
    mocks.getAuditEvent.mockResolvedValue({ publicId: eventPublicId, sequence: '1' });
    const response = await GET_AUDIT_DETAIL(authenticatedRequest('https://fvdms.lan'), {
      params: Promise.resolve({ eventId: eventPublicId }),
    });

    expect(response.status).toBe(200);
    expect(mocks.getAuditEvent).toHaveBeenCalledWith({
      actor: principal,
      eventPublicId,
      requestId,
      ipAddress: '192.0.2.50',
      userAgent: 'Audit route test',
    });
  });

  it('returns only the latest completed verification through audit.read', async () => {
    mocks.getLatestAuditVerification.mockResolvedValue(null);
    const response = await GET_VERIFICATION(authenticatedRequest('https://fvdms.lan'));

    expect(response.status).toBe(200);
    expect(mocks.getLatestAuditVerification).toHaveBeenCalledOnce();
    expect((await response.json()).data).toBeNull();
  });

  it('durably records a denied audit route before returning 403', async () => {
    mocks.authorizePermission.mockImplementation(() => {
      throw new AuthorizationError();
    });
    const response = await GET_AUDIT_EVENTS(
      authenticatedRequest('https://fvdms.lan/api/audit-events'),
    );

    expect(response.status).toBe(403);
    expect(mocks.recordAuthorizationDenial).toHaveBeenCalledWith({
      principal,
      permission: 'audit.read',
      requestId,
      routeTemplate: '/api/audit-events',
      sourceAddress: '192.0.2.50',
      userAgent: 'Audit route test',
    });
    expect(mocks.searchAuditEvents).not.toHaveBeenCalled();
  });
});

function authenticatedRequest(url: string): Request {
  return new Request(url, {
    headers: {
      cookie: '__Host-fvdms_session=opaque-session',
      'user-agent': 'Audit route test',
      'x-forwarded-for': '192.0.2.50, 10.0.0.1',
      'x-request-id': requestId,
    },
  });
}
