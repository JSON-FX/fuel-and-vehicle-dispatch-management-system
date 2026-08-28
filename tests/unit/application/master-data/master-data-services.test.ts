import { describe, expect, it } from 'vitest';

import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import {
  buildMasterDataAuditEvent,
  driverAuditSnapshot,
} from '@/application/master-data/services/master-data-audit-events';
import { MasterDataPermissionPolicy } from '@/application/master-data/services/master-data-permission-policy';

const principal = (permissions: readonly string[]): CurrentPrincipal => ({
  userPublicId: '01900000-0000-7000-8000-000000000001',
  username: 'viewer',
  fullName: 'Reference Viewer',
  roles: [],
  permissions,
  isPrivileged: false,
  mustChangePassword: false,
  mfaEnrolled: true,
});

describe('MasterDataPermissionPolicy', () => {
  const policy = new MasterDataPermissionPolicy();

  it('allows manage permissions to satisfy resource reads', () => {
    expect(policy.canRead(principal(['office.manage']), 'office')).toBe(true);
    expect(policy.canManage(principal(['office.manage']), 'office')).toBe(true);
  });

  it('allows read-only selectors but denies management', () => {
    const viewer = principal(['driver.read']);
    expect(policy.canRead(viewer, 'driver')).toBe(true);
    expect(policy.canManage(viewer, 'driver')).toBe(false);
    expect(() => policy.assertCanManage(viewer, 'driver')).toThrow(
      'You are not allowed to perform this action.',
    );
  });

  it('denies unrelated resource permissions', () => {
    expect(() => policy.assertCanRead(principal(['vehicle.read']), 'office')).toThrow();
  });
});

describe('master-data audit events', () => {
  it('builds namespaced immutable events', () => {
    const event = buildMasterDataAuditEvent({
      publicId: '01900000-0000-7000-8000-000000000002',
      resource: 'office',
      action: 'created',
      entityPublicId: '01900000-0000-7000-8000-000000000003',
      actorPublicId: '01900000-0000-7000-8000-000000000001',
      requestId: 'request-1',
      ipAddress: null,
      userAgent: null,
      occurredAt: new Date('2026-08-28T00:00:00.000Z'),
      after: { name: 'Budget Office', abbreviation: 'BO', status: 'ACTIVE' },
    });

    expect(event.action).toBe('office.created');
    expect(event.entity).toEqual({
      type: 'office',
      publicId: '01900000-0000-7000-8000-000000000003',
    });
  });

  it('uses contact markers instead of raw driver contact data', () => {
    const snapshot = driverAuditSnapshot({
      name: 'Juan Dela Cruz',
      status: 'ACTIVE',
      contactNumber: '0917 123 4567',
    });

    expect(snapshot).toEqual({
      name: 'Juan Dela Cruz',
      status: 'ACTIVE',
      hasContactNumber: true,
    });
    expect(JSON.stringify(snapshot)).not.toContain('0917');
  });
});
