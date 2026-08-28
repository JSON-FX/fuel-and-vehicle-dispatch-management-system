import { describe, expect, it } from 'vitest';

import { addCivilDays, dispatchScheduleRange, manilaCivilDate } from '@/lib/dispatch/calendar-date';

describe('dispatch civil-date helpers', () => {
  it('adds dates without local-time shifts', () => {
    expect(addCivilDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addCivilDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('derives day, Monday week, and six-row month ranges', () => {
    expect(dispatchScheduleRange('day', '2026-08-29')).toEqual({
      from: '2026-08-29',
      to: '2026-08-29',
    });
    expect(dispatchScheduleRange('week', '2026-08-29')).toEqual({
      from: '2026-08-24',
      to: '2026-08-30',
    });
    expect(dispatchScheduleRange('month', '2026-08-29')).toEqual({
      from: '2026-07-27',
      to: '2026-09-06',
    });
  });

  it('derives the Manila civil date from an instant', () => {
    expect(manilaCivilDate(new Date('2026-08-28T16:30:00.000Z'))).toBe('2026-08-29');
  });
});
