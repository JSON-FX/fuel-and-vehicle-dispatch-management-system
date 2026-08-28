import { describe, expect, it } from 'vitest';

import type { Clock } from '@/application/auth/ports/clock';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';
import { createBudgetWebComposition } from '@/infrastructure/composition/budget';
import type { Database } from '@/infrastructure/database/types';
import { UuidV7Generator } from '@/infrastructure/identifiers/uuid-v7-generator';

describe('budget composition', () => {
  it('constructs frozen policies without opening a database connection', () => {
    const database = {} as import('kysely').Kysely<Database>;
    const clock: Clock = { now: () => new Date('2026-08-28T10:00:00.000Z') };
    const publicIds: PublicIdGenerator = new UuidV7Generator();

    const composition = createBudgetWebComposition(
      database,
      { primarySchema: 'fvdms_audit', maximumCanonicalPayloadBytes: 65_536 },
      { clock, publicIds },
    );

    expect(Object.isFrozen(composition)).toBe(true);
    expect(composition.budgetPermissions.canRead).toBeTypeOf('function');
    expect(composition.fiscalPeriodPolicy.resolveCivilDate('2026-08-28')).toEqual({
      fiscalYear: 2026,
      quarter: 3,
    });
    expect(
      [
        composition.createBudgetAllocation,
        composition.getBudgetAllocation,
        composition.listBudgetAllocations,
        composition.listOperationalBudgetAllocations,
        composition.updateBudgetAllocation,
        composition.softDeleteBudgetAllocation,
        composition.restoreBudgetAllocation,
      ].every((service) => typeof service.execute === 'function'),
    ).toBe(true);
  });
});
