import { describe, expect, it } from 'vitest';

import type { Clock } from '@/application/auth/ports/clock';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';
import { createFuelWebComposition } from '@/infrastructure/composition/fuel';
import type { Database } from '@/infrastructure/database/types';
import { UuidV7Generator } from '@/infrastructure/identifiers/uuid-v7-generator';

describe('fuel composition', () => {
  it('constructs every fuel service without opening a database connection', () => {
    const database = {} as import('kysely').Kysely<Database>;
    const clock: Clock = { now: () => new Date('2026-08-28T10:00:00.000Z') };
    const publicIds: PublicIdGenerator = new UuidV7Generator();
    const composition = createFuelWebComposition(
      database,
      { primarySchema: 'fvdms_audit', maximumCanonicalPayloadBytes: 65_536 },
      { clock, publicIds },
    );

    expect(Object.isFrozen(composition)).toBe(true);
    expect(composition.fuelPermissions.canRead).toBeTypeOf('function');
    expect(
      [
        composition.createFuelIssuance,
        composition.updateDraftFuelIssuance,
        composition.getFuelIssuance,
        composition.listFuelIssuances,
        composition.postFuelIssuance,
        composition.voidFuelIssuance,
        composition.getFuelBalances,
      ].every((service) => typeof service.execute === 'function'),
    ).toBe(true);
  });
});
