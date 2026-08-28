import { describe, expect, it } from 'vitest';

import { ValidationError } from '@/application/shared/errors/application-error';
import { fuelPaginationHref, parseFuelPageQuery } from '@/lib/fuel/page-query';

describe('fuel page query', () => {
  it('maps URL values into bounded list input and stable filter values', () => {
    const parsed = parseFuelPageQuery({
      query: 'RIS-001',
      status: 'POSTED',
      fuelType: 'DIESEL',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      cursor: 'opaque',
    });
    expect(parsed.query).toMatchObject({
      query: 'RIS-001',
      status: 'POSTED',
      fuelType: 'DIESEL',
      pageSize: 25,
      cursor: 'opaque',
    });
    expect(parsed.values).toEqual({
      query: 'RIS-001',
      status: 'POSTED',
      fuelType: 'DIESEL',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    });
  });

  it('uses empty filter defaults and rejects duplicate parameters', () => {
    expect(parseFuelPageQuery({}).values).toEqual({
      query: '',
      status: '',
      fuelType: '',
      startDate: '',
      endDate: '',
    });
    expect(() => parseFuelPageQuery({ status: ['DRAFT', 'POSTED'] })).toThrow(ValidationError);
  });

  it('builds pagination links with only active filters', () => {
    expect(
      fuelPaginationHref(
        { query: '', status: 'DRAFT', fuelType: '', startDate: '', endDate: '' },
        'next cursor',
      ),
    ).toBe('/fuel-issuances?status=DRAFT&cursor=next+cursor');
  });
});
