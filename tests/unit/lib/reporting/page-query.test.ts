import { describe, expect, it } from 'vitest';

import { parseReportPageQuery, reportPageHref } from '@/lib/reporting/page-query';

describe('reporting page query', () => {
  it('defaults to the authorized overview and current month', () => {
    expect(parseReportPageQuery({}, '2026-08-29')).toMatchObject({
      values: {
        report: 'OVERVIEW',
        periodType: 'MONTHLY',
        referenceDate: '2026-08-29',
      },
      resolvedPeriod: {
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      },
    });
  });

  it('maps a custom dispatch detail query without losing its filters', () => {
    const parsed = parseReportPageQuery(
      {
        report: 'DISPATCH',
        requestingOfficePublicId: '01900000-0000-7000-8000-000000000902',
        periodType: 'CUSTOM',
        startDate: '2026-08-01',
        endDate: '2026-08-29',
        status: 'COMPLETED',
        pageSize: '50',
      },
      '2026-08-29',
    );

    expect(parsed.filters).toMatchObject({
      reportType: 'DISPATCH',
      requestingOfficePublicId: '01900000-0000-7000-8000-000000000902',
      status: 'COMPLETED',
      pageSize: 50,
      startDate: '2026-08-01',
      endDate: '2026-08-29',
    });
    expect(reportPageHref(parsed.values, 'next-cursor')).toContain('report=DISPATCH');
    expect(reportPageHref(parsed.values, 'next-cursor')).toContain('cursor=next-cursor');
  });

  it('rejects duplicate, unknown, incompatible, and oversized filters', () => {
    expect(() =>
      parseReportPageQuery({ report: ['DISPATCH', 'FUEL_ISSUANCE'] }, '2026-08-29'),
    ).toThrow();
    expect(() => parseReportPageQuery({ unknown: 'value' }, '2026-08-29')).toThrow();
    expect(() =>
      parseReportPageQuery(
        { report: 'FUEL_BY_OFFICE', periodType: 'MONTHLY', status: 'POSTED' },
        '2026-08-29',
      ),
    ).toThrow();
    expect(() => parseReportPageQuery({ pageSize: '201' }, '2026-08-29')).toThrow();
  });
});
