import { describe, expect, it } from 'vitest';

import type { Clock } from '@/application/auth/ports/clock';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';
import { createDispatchWebComposition } from '@/infrastructure/composition/dispatch';
import type { Database } from '@/infrastructure/database/types';
import { UuidV7Generator } from '@/infrastructure/identifiers/uuid-v7-generator';

describe('dispatch composition', () => {
  it('constructs the dispatch policy and transaction dependencies without a connection', () => {
    const database = {} as import('kysely').Kysely<Database>;
    const clock: Clock = { now: () => new Date('2026-08-29T00:00:00.000Z') };
    const publicIds: PublicIdGenerator = new UuidV7Generator();
    const composition = createDispatchWebComposition(
      database,
      { primarySchema: 'fvdms_audit', maximumCanonicalPayloadBytes: 65_536 },
      { clock, publicIds },
    );

    expect(Object.isFrozen(composition)).toBe(true);
    expect(composition.dispatchPermissions.canRead).toBeTypeOf('function');
    expect(composition.dispatchDependencies.transaction.execute).toBeTypeOf('function');
    expect(composition.dispatchDependencies.clock).toBe(clock);
    expect(composition.dispatchDependencies.publicIds).toBe(publicIds);
    expect(
      [
        composition.createDispatch,
        composition.getDispatch,
        composition.listDispatches,
        composition.getDispatchPreparationOptions,
        composition.updateDraftDispatch,
        composition.dispatchVehicle,
        composition.completeDispatch,
        composition.cancelDispatch,
      ].every((service) => typeof service.execute === 'function'),
    ).toBe(true);
  });
});
