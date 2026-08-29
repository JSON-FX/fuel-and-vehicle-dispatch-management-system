import { describe, expect, it } from 'vitest';

import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import { REPORT_TYPES } from '@/application/reporting/dto/report-dtos';
import { REPORT_DEFINITIONS } from '@/application/reporting/services/report-catalogue';
import { ExportJobStateMachine } from '@/application/reporting/services/export-job-state-machine';
import { ReportPeriodPolicy } from '@/application/reporting/services/report-period-policy';
import { ReportPermissionPolicy } from '@/application/reporting/services/report-permission-policy';

function principal(permissions: readonly string[]): CurrentPrincipal {
  return {
    userPublicId: '01900000-0000-7000-8000-000000000901',
    username: 'report.user',
    fullName: 'Report User',
    roles: ['VIEWER'],
    permissions,
    isPrivileged: false,
    mustChangePassword: false,
    mfaEnrolled: false,
  };
}

describe('reporting application services', () => {
  it('defines the nine accepted reports with their independent permissions and statuses', () => {
    expect(REPORT_TYPES).toEqual([
      'FUEL_ISSUANCE',
      'DISPATCH',
      'FUEL_BY_OFFICE',
      'FUEL_BY_VEHICLE',
      'FUEL_TYPE_TOTALS',
      'FUEL_AMOUNT_BY_PERIOD',
      'DISPATCH_COUNT_BY_OFFICE',
      'VEHICLE_UTILIZATION',
      'BUDGET_ALLOCATION_ACTIVITY',
    ]);
    expect(REPORT_DEFINITIONS.FUEL_ISSUANCE).toMatchObject({
      readPermission: 'fuel.read',
      exportPermission: 'fuel.export',
      includedStatuses: ['POSTED', 'VOIDED'],
    });
    expect(REPORT_DEFINITIONS.FUEL_BY_OFFICE.includedStatuses).toEqual(['POSTED']);
    expect(REPORT_DEFINITIONS.DISPATCH_COUNT_BY_OFFICE.includedStatuses).toEqual([
      'DISPATCHED',
      'COMPLETED',
    ]);
    expect(REPORT_DEFINITIONS.VEHICLE_UTILIZATION.includedStatuses).toEqual(['COMPLETED']);
    expect(REPORT_DEFINITIONS.BUDGET_ALLOCATION_ACTIVITY.label).toBe(
      'Fuel activity by budget allocation',
    );
  });

  it('resolves calendar periods in the accepted Manila civil-date contract', () => {
    const policy = new ReportPeriodPolicy();

    expect(policy.resolve({ periodType: 'WEEKLY', referenceDate: '2026-08-29' })).toEqual({
      periodType: 'WEEKLY',
      startDate: '2026-08-24',
      endDate: '2026-08-30',
      referenceDate: '2026-08-29',
      timeZone: 'Asia/Manila',
    });
    expect(policy.resolve({ periodType: 'MONTHLY', referenceDate: '2028-02-14' })).toMatchObject({
      startDate: '2028-02-01',
      endDate: '2028-02-29',
    });
    expect(policy.resolve({ periodType: 'QUARTERLY', referenceDate: '2026-08-29' })).toMatchObject({
      startDate: '2026-07-01',
      endDate: '2026-09-30',
    });
    expect(policy.resolve({ periodType: 'ANNUAL', referenceDate: '2026-08-29' })).toMatchObject({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    expect(
      policy.resolve({ periodType: 'CUSTOM', startDate: '2026-08-01', endDate: '2026-08-29' }),
    ).toMatchObject({ startDate: '2026-08-01', endDate: '2026-08-29' });
    expect(() =>
      policy.resolve({ periodType: 'CUSTOM', startDate: '2026-08-30', endDate: '2026-08-29' }),
    ).toThrow('invalid data');
  });

  it('requires both the underlying read permission and the report export permission', () => {
    const policy = new ReportPermissionPolicy();

    expect(policy.canRead(principal(['fuel.read']), 'FUEL_BY_OFFICE')).toBe(true);
    expect(policy.canRead(principal(['dispatch.read']), 'FUEL_BY_OFFICE')).toBe(false);
    expect(policy.canExport(principal(['fuel.read', 'fuel.export']), 'FUEL_ISSUANCE')).toBe(true);
    expect(policy.canExport(principal(['fuel.read', 'report.export']), 'FUEL_ISSUANCE')).toBe(
      false,
    );
    expect(policy.canExport(principal(['dispatch.read', 'report.export']), 'DISPATCH')).toBe(true);
    expect(policy.canAccessDashboard(principal(['fuel.read']))).toBe(true);
    expect(policy.canAccessDashboard(principal(['dispatch.read']))).toBe(true);
    expect(policy.canAccessDashboard(principal([]))).toBe(false);
    expect(() => policy.assertCanRead(principal([]), 'FUEL_BY_OFFICE')).toThrow('not allowed');
    expect(() => policy.assertCanRead(principal(['fuel.read']), 'FUEL_BY_OFFICE')).not.toThrow();
    expect(() =>
      policy.assertCanExport(principal(['dispatch.read', 'report.export']), 'DISPATCH'),
    ).not.toThrow();
    expect(() => policy.assertCanExport(principal(['report.export']), 'DISPATCH')).toThrow(
      'not allowed',
    );
  });

  it('allows only durable export job transitions', () => {
    const stateMachine = new ExportJobStateMachine();

    expect(stateMachine.canTransition('QUEUED', 'RUNNING')).toBe(true);
    expect(stateMachine.canTransition('RUNNING', 'QUEUED')).toBe(true);
    expect(stateMachine.canTransition('RUNNING', 'COMPLETED')).toBe(true);
    expect(stateMachine.canTransition('RUNNING', 'FAILED')).toBe(true);
    expect(stateMachine.canTransition('COMPLETED', 'EXPIRED')).toBe(true);
    expect(stateMachine.canTransition('COMPLETED', 'RUNNING')).toBe(false);
    expect(() => stateMachine.assertTransition('FAILED', 'RUNNING')).toThrow('cannot transition');
  });
});
