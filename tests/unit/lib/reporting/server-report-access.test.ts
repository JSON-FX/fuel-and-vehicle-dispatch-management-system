import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import { AuthorizationError } from '@/application/shared/errors/application-error';
import {
  authorizeReportPageAccess,
  authorizeReportRequest,
  reportRequestContext,
} from '@/lib/reporting/server-report-access';

const nextHeaders = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({ headers: nextHeaders }));

const principal: CurrentPrincipal = {
  userPublicId: '01900000-0000-7000-8000-000000000001',
  username: 'report.user',
  fullName: 'Report User',
  roles: ['VIEWER'],
  permissions: ['fuel.read'],
  isPrivileged: false,
  mustChangePassword: false,
  mfaEnrolled: false,
};

function composition() {
  return {
    reportPermissions: {
      assertCanRead: vi.fn(),
      assertCanExport: vi.fn(),
      canAccessDashboard: vi.fn().mockReturnValue(true),
    },
    recordAuthorizationDenial: { execute: vi.fn() },
    publicIdGenerator: {
      generate: () => ({ toString: () => '01900000-0000-7000-8000-000000000099' }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  nextHeaders.mockResolvedValue(
    new Headers({
      'x-forwarded-for': '192.0.2.10, 192.0.2.11',
      'user-agent': 'Vitest',
    }),
  );
});

describe('reporting server access', () => {
  it('checks the exact read and export policies', async () => {
    const access = composition();
    const request = authenticatedRequest();
    await authorizeReportRequest(
      request,
      access as never,
      principal,
      'FUEL_ISSUANCE',
      'read',
      'request-1',
      '/api/reports/[reportType]',
    );
    await authorizeReportRequest(
      request,
      access as never,
      principal,
      'FUEL_ISSUANCE',
      'export',
      'request-2',
      '/api/report-exports',
    );
    expect(access.reportPermissions.assertCanRead).toHaveBeenCalled();
    expect(access.reportPermissions.assertCanExport).toHaveBeenCalled();
  });

  it.each([
    { access: 'read' as const, permissions: [] as string[], expected: 'fuel.read' },
    { access: 'export' as const, permissions: [] as string[], expected: 'fuel.read' },
    {
      access: 'export' as const,
      permissions: ['fuel.read'],
      expected: 'fuel.export',
    },
  ])('audits denied $access access against $expected', async (input) => {
    const access = composition();
    const deniedPrincipal = { ...principal, permissions: input.permissions };
    const assertion =
      input.access === 'read'
        ? access.reportPermissions.assertCanRead
        : access.reportPermissions.assertCanExport;
    assertion.mockImplementation(() => {
      throw new AuthorizationError();
    });

    await expect(
      authorizeReportRequest(
        authenticatedRequest(),
        access as never,
        deniedPrincipal,
        'FUEL_ISSUANCE',
        input.access,
        'request-denied',
        '/reports',
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(access.recordAuthorizationDenial.execute).toHaveBeenCalledWith(
      expect.objectContaining({ permission: input.expected, sourceAddress: '192.0.2.10' }),
    );
  });

  it('does not rewrite unexpected policy failures', async () => {
    const access = composition();
    access.reportPermissions.assertCanRead.mockImplementation(() => {
      throw new TypeError('policy unavailable');
    });
    await expect(
      authorizeReportRequest(
        authenticatedRequest(),
        access as never,
        principal,
        'FUEL_ISSUANCE',
        'read',
        'request-error',
        '/reports',
      ),
    ).rejects.toThrow('policy unavailable');
    expect(access.recordAuthorizationDenial.execute).not.toHaveBeenCalled();
  });

  it('builds request context and authorizes or audits the reports page', async () => {
    const request = authenticatedRequest();
    expect(reportRequestContext(request, principal, 'request-context')).toEqual({
      principal,
      requestId: 'request-context',
      ipAddress: '192.0.2.10',
      userAgent: 'Vitest',
    });

    const access = composition();
    await expect(
      authorizeReportPageAccess(access as never, principal, '/reports'),
    ).resolves.toMatchObject({ principal, ipAddress: '192.0.2.10' });
    access.reportPermissions.canAccessDashboard.mockReturnValueOnce(false);
    await expect(
      authorizeReportPageAccess(access as never, principal, '/reports'),
    ).resolves.toBeNull();
    expect(access.recordAuthorizationDenial.execute).toHaveBeenCalledWith(
      expect.objectContaining({ permission: 'fuel.read', routeTemplate: '/reports' }),
    );
  });
});

function authenticatedRequest(): Request {
  return new Request('https://fvdms.lan/reports', {
    headers: {
      cookie: '__Host-fvdms_session=token',
      'x-forwarded-for': '192.0.2.10, 192.0.2.11',
      'user-agent': 'Vitest',
    },
  });
}
