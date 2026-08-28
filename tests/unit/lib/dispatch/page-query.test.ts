import { describe, expect, it } from 'vitest';

import { ValidationError } from '@/application/shared/errors/application-error';
import { dispatchPaginationHref, parseDispatchPageQuery } from '@/lib/dispatch/page-query';

describe('dispatch page query', () => {
  it('maps URL values into bounded list input and stable filter values', () => {
    const parsed = parseDispatchPageQuery({
      query: 'hospital',
      status: 'DRAFT',
      requestingOfficePublicId: '01900000-0000-7000-8000-000000000003',
      travelDateFrom: '2026-08-01',
      travelDateTo: '2026-08-31',
      cursor: 'opaque',
    });
    expect(parsed.query).toMatchObject({
      query: 'hospital',
      status: 'DRAFT',
      pageSize: 25,
      cursor: 'opaque',
    });
    expect(parsed.values).toEqual({
      query: 'hospital',
      status: 'DRAFT',
      requestingOfficePublicId: '01900000-0000-7000-8000-000000000003',
      travelDateFrom: '2026-08-01',
      travelDateTo: '2026-08-31',
    });
  });

  it('uses empty filter defaults and rejects duplicate parameters', () => {
    expect(parseDispatchPageQuery({}).values).toEqual({
      query: '',
      status: '',
      requestingOfficePublicId: '',
      travelDateFrom: '',
      travelDateTo: '',
    });
    expect(() => parseDispatchPageQuery({ status: ['DRAFT', 'DISPATCHED'] })).toThrow(
      ValidationError,
    );
  });

  it('builds pagination links with only active filters', () => {
    expect(
      dispatchPaginationHref(
        {
          query: '',
          status: 'DISPATCHED',
          requestingOfficePublicId: '',
          travelDateFrom: '',
          travelDateTo: '2026-08-31',
        },
        'next cursor',
      ),
    ).toBe('/dispatches?status=DISPATCHED&travelDateTo=2026-08-31&cursor=next+cursor');
  });
});
