import { describe, expect, it } from 'vitest';

import {
  hasActiveMasterDataFilters,
  masterDataPaginationHref,
  parseMasterDataPageQuery,
} from '@/lib/master-data/page-query';

describe('master-data page queries', () => {
  it('uses the administration page size and strict native query values', () => {
    const parsed = parseMasterDataPageQuery('office', { query: '', lifecycle: 'current' });
    expect(parsed.query.pageSize).toBe(25);
    expect(parsed.query.mode).toBe('admin');
    expect(() => parseMasterDataPageQuery('office', { query: ['one', 'two'] })).toThrow();
  });

  it('preserves active filters in cursor links', () => {
    const values = { query: 'budget', lifecycle: 'deleted', status: 'INACTIVE' };
    expect(hasActiveMasterDataFilters(values)).toBe(true);
    expect(masterDataPaginationHref('office', values, 'cursor-value')).toBe(
      '/admin/offices?query=budget&lifecycle=deleted&status=INACTIVE&cursor=cursor-value',
    );
  });
});
