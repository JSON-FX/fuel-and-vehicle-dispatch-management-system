import { describe, expect, it } from 'vitest';

import type { MasterDataListQuery } from '@/application/master-data/dto/master-data-list-dtos';
import { MasterDataCursorCodec } from '@/infrastructure/database/master-data/master-data-cursor-codec';

const publicId = '01900000-0000-7000-8000-000000000001';
const query: MasterDataListQuery = {
  mode: 'admin',
  query: 'budget',
  lifecycle: 'current',
  status: 'ACTIVE',
  cursor: null,
  pageSize: 50,
};

describe('MasterDataCursorCodec', () => {
  const codec = new MasterDataCursorCodec();

  it('round-trips a resource-aware keyset cursor', () => {
    const encoded = codec.encode({
      resource: 'office',
      direction: 'next',
      sortValue: 'Budget Office',
      publicId,
      query,
    });
    expect(codec.decode(encoded, 'office', query)).toMatchObject({
      version: 1,
      resource: 'office',
      direction: 'next',
      sortValue: 'Budget Office',
      publicId,
    });
  });

  it.each([
    ['another resource', 'vehicle', query],
    ['another query', 'office', { ...query, query: 'engineering' }],
    ['another lifecycle', 'office', { ...query, lifecycle: 'all' }],
    ['another page size', 'office', { ...query, pageSize: 25 }],
  ] as const)('rejects cursor reuse with %s', (_label, resource, changedQuery) => {
    const encoded = codec.encode({
      resource: 'office',
      direction: 'next',
      sortValue: 'Budget Office',
      publicId,
      query,
    });
    expect(() => codec.decode(encoded, resource, changedQuery)).toThrow();
  });

  it.each(['not-base64url!', '', 'e30=', 'e30'])('rejects malformed cursors', (cursor) => {
    expect(() => codec.decode(cursor, 'office', query)).toThrow();
  });

  it('rejects malformed or non-version-7 public IDs in payloads', () => {
    expect(() =>
      codec.encode({
        resource: 'driver',
        direction: 'previous',
        sortValue: 'Juan Dela Cruz',
        publicId: '550e8400-e29b-41d4-a716-446655440000',
        query,
      }),
    ).toThrow();
  });
});
