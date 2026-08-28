import { describe, expect, it } from 'vitest';

import { DispatchDate } from '@/domain/dispatch/value-objects/dispatch-date';
import { DispatchStatus } from '@/domain/dispatch/value-objects/dispatch-status';
import { OdometerReading } from '@/domain/dispatch/value-objects/odometer-reading';
import { PassengerCount } from '@/domain/dispatch/value-objects/passenger-count';
import { DomainError } from '@/domain/shared/errors/domain-error';

describe('dispatch value objects', () => {
  it.each([
    ['2026-08-28', '2026-08-28'],
    ['2024-02-29', '2024-02-29'],
  ])('accepts the civil date %s without timezone conversion', (value, expected) => {
    expect(DispatchDate.from(value).toString()).toBe(expected);
  });

  it.each(['2026-02-29', '2026-13-01', '2026-08-32', '08/28/2026', '', null])(
    'rejects invalid civil date %j',
    (value) => {
      expect(() => DispatchDate.from(value)).toThrow(DomainError);
    },
  );

  it.each([
    ['0', '0.0'],
    ['00042.5', '42.5'],
    ['99999999999.9', '99999999999.9'],
  ])('normalizes exact odometer reading %s as %s', (value, expected) => {
    expect(OdometerReading.from(value).toString()).toBe(expected);
  });

  it.each(['-0.1', '1.11', '999999999999.0', 'NaN', 10, null])(
    'rejects invalid odometer reading %j',
    (value) => {
      expect(() => OdometerReading.from(value)).toThrow(DomainError);
    },
  );

  it('compares readings and derives an exact one-decimal distance', () => {
    const initial = OdometerReading.from('10000000000.1');
    const final = OdometerReading.from('10000000000.3');

    expect(final.isAtLeast(initial)).toBe(true);
    expect(final.distanceFrom(initial)).toBe('0.2');
    expect(initial.distanceFrom(initial)).toBe('0.0');
    expect(() => initial.assertAtLeast(final)).toThrow(
      'Final odometer reading cannot be below the initial reading.',
    );
  });

  it.each([
    [0, 0],
    [12, 12],
    [4_294_967_295, 4_294_967_295],
  ])('accepts passenger count %s', (value, expected) => {
    expect(PassengerCount.from(value).toNumber()).toBe(expected);
  });

  it.each([-1, 1.5, 4_294_967_296, '2', null])('rejects passenger count %j', (value) => {
    expect(() => PassengerCount.from(value)).toThrow(DomainError);
  });

  it('enforces the dispatch state graph', () => {
    expect(DispatchStatus.draft().dispatch().toString()).toBe('DISPATCHED');
    expect(DispatchStatus.draft().cancel().toString()).toBe('CANCELLED');
    expect(DispatchStatus.dispatched().complete().toString()).toBe('COMPLETED');
    expect(DispatchStatus.dispatched().cancel().toString()).toBe('CANCELLED');

    expect(() => DispatchStatus.draft().complete()).toThrow(
      'Only dispatched vehicle dispatches can be completed.',
    );
    expect(() => DispatchStatus.completed().cancel()).toThrow(
      'Completed vehicle dispatches are terminal.',
    );
    expect(() => DispatchStatus.cancelled().dispatch()).toThrow(
      'Cancelled vehicle dispatches are terminal.',
    );
    expect(() => DispatchStatus.from('POSTED')).toThrow(DomainError);
  });
});
