import { describe, expect, it } from 'vitest';

import type { BudgetAllocationListQuery } from '@/application/budget/dto/budget-allocation-dtos';
import { BudgetAllocationCursorCodec } from '@/infrastructure/database/budget/budget-allocation-cursor-codec';

const publicId = '01900000-0000-7000-8000-000000000001';
const query: BudgetAllocationListQuery = {
  mode: 'admin',
  query: 'budget',
  fiscalYear: 2026,
  quarter: 3,
  status: 'ACTIVE',
  lifecycle: 'current',
  cursor: null,
  pageSize: 25,
};

describe('BudgetAllocationCursorCodec', () => {
  const codec = new BudgetAllocationCursorCodec();

  it('round-trips the complete stable order position', () => {
    const encoded = codec.encode({
      direction: 'next',
      fiscalYear: 2026,
      quarter: 3,
      ppmpNumber: 'PPMP-001',
      publicId,
      query,
    });
    expect(codec.decode(encoded, query)).toMatchObject({
      version: 1,
      direction: 'next',
      fiscalYear: 2026,
      quarter: 3,
      ppmpNumber: 'PPMP-001',
      publicId,
    });
  });

  it.each([
    ['query', { ...query, query: 'engineering' }],
    ['year', { ...query, fiscalYear: 2027 }],
    ['quarter', { ...query, quarter: 4 }],
    ['status', { ...query, status: 'CLOSED' as const }],
    ['lifecycle', { ...query, lifecycle: 'all' as const }],
    ['page size', { ...query, pageSize: 50 }],
  ])('rejects cursor reuse with another %s', (_label, changedQuery) => {
    const encoded = codec.encode({
      direction: 'next',
      fiscalYear: 2026,
      quarter: 3,
      ppmpNumber: 'PPMP-001',
      publicId,
      query,
    });
    expect(() => codec.decode(encoded, changedQuery)).toThrow();
  });

  it.each(['', 'not-base64url!', 'e30=', 'e30'])('rejects malformed cursors', (cursor) => {
    expect(() => codec.decode(cursor, query)).toThrow();
  });
});
