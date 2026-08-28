import { sql, type Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { CancelDispatch } from '@/application/dispatch/use-cases/cancel-dispatch';
import { CompleteDispatch } from '@/application/dispatch/use-cases/complete-dispatch';
import { CreateDispatch } from '@/application/dispatch/use-cases/create-dispatch';
import { DispatchVehicle } from '@/application/dispatch/use-cases/dispatch-vehicle';
import { UpdateDraftDispatch } from '@/application/dispatch/use-cases/update-draft-dispatch';
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

function failingDependencies() {
  return {
    ...dispatchDependencies(database),
    transaction: new KyselyDispatchTransaction(database, {
      primarySchema: 'missing_dispatch_audit',
      maximumCanonicalPayloadBytes: 65_536,
    }),
  };
}

async function row(publicId: string) {
  return database
    .selectFrom('vehicle_dispatches')
    .select(['destination', 'status', 'odo_after', 'cancellation_reason'])
    .where('public_id', '=', Buffer.from(publicId.replaceAll('-', ''), 'hex'))
    .executeTakeFirstOrThrow();
}

describe('dispatch audit atomicity', () => {
  it('rolls back create when audit append fails', async () => {
    await expect(
      new CreateDispatch(failingDependencies()).execute({
        context: dispatchContext,
        command: dispatchDraftCommand(references, 'CREATE-ROLLBACK'),
      }),
    ).rejects.toThrow();
    expect(await database.selectFrom('vehicle_dispatches').select('id').execute()).toEqual([]);
  });

  it.each(['update', 'dispatch', 'complete', 'cancel'] as const)(
    'rolls back %s and appends no success event when audit append fails',
    async (action) => {
      const healthy = dispatchDependencies(database);
      const created = await new CreateDispatch(healthy).execute({
        context: dispatchContext,
        command: dispatchDraftCommand(references, `${action}-BASE`),
      });
      if (action === 'complete') {
        await new DispatchVehicle(healthy).execute({
          context: dispatchContext,
          publicId: created.publicId,
        });
      }
      const before = await row(created.publicId);
      const auditsBefore = await sql<{ count: string }>`
        select count(*) as count from fvdms_audit.audit_outbox
      `.execute(database);

      const failing = failingDependencies();
      const operation =
        action === 'update'
          ? new UpdateDraftDispatch(failing).execute({
              context: dispatchContext,
              publicId: created.publicId,
              command: {
                ...dispatchDraftCommand(references, `${action}-BASE`),
                destination: 'This change must roll back',
              },
            })
          : action === 'dispatch'
            ? new DispatchVehicle(failing).execute({
                context: dispatchContext,
                publicId: created.publicId,
              })
            : action === 'complete'
              ? new CompleteDispatch(failing).execute({
                  context: dispatchContext,
                  publicId: created.publicId,
                  command: { odoAfter: '1260.4' },
                })
              : new CancelDispatch(failing).execute({
                  context: dispatchContext,
                  publicId: created.publicId,
                  command: { reason: 'This cancellation must roll back fully.' },
                });

      await expect(operation).rejects.toThrow();
      expect(await row(created.publicId)).toEqual(before);
      const auditsAfter = await sql<{ count: string }>`
        select count(*) as count from fvdms_audit.audit_outbox
      `.execute(database);
      expect(auditsAfter.rows[0]?.count).toBe(auditsBefore.rows[0]?.count);
    },
  );
});
