import { describe, expect, it } from 'vitest';

import { parseSchedulePageQuery } from '@/lib/dispatch/schedule-page-query';

describe('schedule page query', () => {
  it('defaults to the current week and maps native GET filters', () => {
    expect(parseSchedulePageQuery({}, '2026-08-29')).toMatchObject({
      values: { view: 'week', date: '2026-08-29' },
      query: { from: '2026-08-24', to: '2026-08-30', limit: 200 },
    });
  });

  it('rejects duplicate and invalid values', () => {
    expect(() => parseSchedulePageQuery({ view: ['day', 'week'] }, '2026-08-29')).toThrow();
    expect(() => parseSchedulePageQuery({ date: '2026-02-29' }, '2026-08-29')).toThrow();
    expect(() => parseSchedulePageQuery({ unknown: 'value' }, '2026-08-29')).toThrow();
  });
});
