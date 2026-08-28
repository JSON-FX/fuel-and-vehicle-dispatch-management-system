import type { Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { CheckDispatchScheduleAvailability } from '@/application/dispatch/use-cases/check-dispatch-schedule-availability';
import { CreateDispatch } from '@/application/dispatch/use-cases/create-dispatch';
import { KyselyDispatchTransaction } from '@/infrastructure/database/dispatch/kysely-dispatch-transaction';
import type { Database } from '@/infrastructure/database/types';

import {
  dispatchContext,
  dispatchDependencies,
  dispatchDraftCommand,
  prepareDispatchDatabase,
  resetDispatchDatabase,
  seedDispatchReferences,
  type DispatchReferenceFixture,
} from '../helpers/dispatch-test-database';
import { createTestDatabase } from '../helpers/test-database';

let database: Kysely<Database>;
let references: DispatchReferenceFixture;

beforeAll(async () => {
  database = createTestDatabase(inject('mysql'));
  await prepareDispatchDatabase(database);
});
beforeEach(async () => {
  await resetDispatchDatabase(database);
  references = await seedDispatchReferences(database);
});
afterAll(async () => database.destroy());

describe('dispatch conflict evidence atomicity', () => {
  it('rolls back the conflicting dispatch and override rows when audit append fails', async () => {
    const healthy = dispatchDependencies(database);
    await new CreateDispatch(healthy).execute({
      context: dispatchContext,
      command: dispatchDraftCommand(references, 'CONFLICT-BASE'),
    });
    const candidate = {
      travelDate: '2026-08-29',
      driverPublicId: references.driver.publicId.toString(),
      vehiclePublicId: references.vehicle.publicId.toString(),
      excludedDispatchPublicId: null,
    };
    const advisory = await new CheckDispatchScheduleAvailability(healthy).execute({
      context: dispatchContext,
      candidate,
    });
    expect(advisory.conflicts).toHaveLength(1);

    const failing = {
      ...healthy,
      transaction: new KyselyDispatchTransaction(database, {
        primarySchema: 'missing_dispatch_schedule_audit',
        maximumCanonicalPayloadBytes: 65_536,
      }),
    };
    await expect(
      new CreateDispatch(failing).execute({
        context: dispatchContext,
        command: {
          ...dispatchDraftCommand(references, 'CONFLICT-ROLLBACK'),
          conflictOverride: {
            acknowledged: true,
            reason: 'Reviewed the shared schedule and approved the second trip.',
            fingerprint: advisory.fingerprint,
          },
        },
      }),
    ).rejects.toThrow();

    const dispatches = await database.selectFrom('vehicle_dispatches').select('id').execute();
    const overrides = await database
      .selectFrom('vehicle_dispatch_conflict_overrides')
      .select('id')
      .execute();
    expect(dispatches).toHaveLength(1);
    expect(overrides).toEqual([]);
  });
});
