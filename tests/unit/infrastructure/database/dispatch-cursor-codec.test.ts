import { describe, expect, it } from 'vitest';

import type { DispatchListQuery } from '@/application/dispatch/dto/dispatch-dtos';
import { ValidationError } from '@/application/shared/errors/application-error';
import { DispatchCursorCodec } from '@/infrastructure/database/dispatch/dispatch-cursor-codec';

const query: DispatchListQuery = {
  query: 'hospital',
  status: 'DRAFT',
  requestingOfficePublicId: null,
  travelDateFrom: '2026-08-01',
  travelDateTo: '2026-08-31',
  cursor: null,
  pageSize: 25,
};

describe('DispatchCursorCodec', () => {
  it('round-trips a filter-bound travel-date cursor', () => {
    const codec = new DispatchCursorCodec();
    const cursor = codec.encode({
      direction: 'next',
      travelDate: '2026-08-28',
      publicId: '01900000-0000-7000-8000-000000000741',
      query,
    });

    expect(codec.decode(cursor, query)).toMatchObject({
      version: 1,
      direction: 'next',
      travelDate: '2026-08-28',
      publicId: '01900000-0000-7000-8000-000000000741',
    });
  });

  it('rejects malformed, edited, and filter-mismatched cursors', () => {
    const codec = new DispatchCursorCodec();
    const cursor = codec.encode({
      direction: 'next',
      travelDate: '2026-08-28',
      publicId: '01900000-0000-7000-8000-000000000741',
      query,
    });

    expect(() => codec.decode('not-a-cursor', query)).toThrow(ValidationError);
    expect(() => codec.decode(`${cursor}x`, query)).toThrow(ValidationError);
    expect(() => codec.decode(cursor, { ...query, status: 'COMPLETED' })).toThrow(ValidationError);
  });
});
