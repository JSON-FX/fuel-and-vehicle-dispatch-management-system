import { describe, expect, it } from 'vitest';

import {
  parseDownloadQuery,
  parseEmptyJsonBody,
  parseExportJobListQuery,
  parseReportExportBody,
  parseReportRouteQuery,
  reportExportJobPublicIdSchema,
  reportTypeSchema,
} from '@/lib/reporting/route-schemas';

describe('reporting route schemas', () => {
  it('normalizes a bounded detail report query from the path report type', () => {
    const query = new URLSearchParams({
      periodType: 'CUSTOM',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      status: 'POSTED',
      pageSize: '50',
    });
    expect(parseReportRouteQuery('FUEL_ISSUANCE', query, '2026-08-29')).toMatchObject({
      reportType: 'FUEL_ISSUANCE',
      periodType: 'CUSTOM',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      status: 'POSTED',
      pageSize: 50,
    });
  });

  it('rejects duplicate, unknown, incompatible, and client-owned report fields', () => {
    expect(() =>
      parseReportRouteQuery(
        'DISPATCH',
        new URLSearchParams('periodType=MONTHLY&periodType=ANNUAL'),
        '2026-08-29',
      ),
    ).toThrow();
    expect(() =>
      parseReportRouteQuery(
        'FUEL_BY_OFFICE',
        new URLSearchParams({ status: 'POSTED' }),
        '2026-08-29',
      ),
    ).toThrow();
    expect(() =>
      parseReportExportBody(
        {
          reportType: 'FUEL_ISSUANCE',
          periodType: 'MONTHLY',
          referenceDate: '2026-08-29',
          requesterUserId: '10',
        },
        '2026-08-29',
      ),
    ).toThrow();
  });

  it('accepts only strict job list, public ID, report type, and token contracts', () => {
    expect(parseExportJobListQuery(new URLSearchParams({ limit: '20' }))).toEqual({ limit: 20 });
    expect(() => parseExportJobListQuery(new URLSearchParams('limit=20&limit=30'))).toThrow();
    expect(reportTypeSchema.parse('VEHICLE_UTILIZATION')).toBe('VEHICLE_UTILIZATION');
    expect(reportExportJobPublicIdSchema.parse('01900000-0000-7000-8000-000000000001')).toBe(
      '01900000-0000-7000-8000-000000000001',
    );
    expect(parseDownloadQuery(new URLSearchParams({ token: 'a'.repeat(43) }))).toEqual({
      token: 'a'.repeat(43),
    });
    expect(() =>
      parseDownloadQuery(new URLSearchParams({ token: 'raw', storageKey: '/tmp/file' })),
    ).toThrow();
  });

  it('normalizes complete and default export bodies without client-owned fields', () => {
    expect(
      parseReportExportBody(
        {
          reportType: 'DISPATCH',
          requestingOfficePublicId: '01900000-0000-7000-8000-000000000001',
          periodType: 'CUSTOM',
          referenceDate: '2026-08-15',
          startDate: '2026-08-01',
          endDate: '2026-08-31',
          status: 'COMPLETED',
        },
        '2026-08-29',
      ),
    ).toMatchObject({
      reportType: 'DISPATCH',
      requestingOfficePublicId: '01900000-0000-7000-8000-000000000001',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      status: 'COMPLETED',
      pageSize: 200,
    });
    expect(parseReportExportBody({ reportType: 'FUEL_BY_OFFICE' }, '2026-08-29')).toMatchObject({
      reportType: 'FUEL_BY_OFFICE',
      periodType: 'MONTHLY',
      status: null,
    });
  });

  it('rejects every malformed list, token, identifier, and empty-body boundary', () => {
    expect(parseExportJobListQuery(new URLSearchParams())).toEqual({ limit: 20 });
    for (const limit of ['0', '51', 'many']) {
      expect(() => parseExportJobListQuery(new URLSearchParams({ limit }))).toThrow();
    }
    expect(() => parseDownloadQuery(new URLSearchParams())).toThrow();
    expect(() => parseDownloadQuery(new URLSearchParams('token=a&token=b'))).toThrow();
    expect(() => reportExportJobPublicIdSchema.parse('not-a-public-id')).toThrow();
    expect(parseEmptyJsonBody({})).toEqual({});
    expect(() => parseEmptyJsonBody({ unexpected: true })).toThrow();
  });
});
