import type { Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import type { DispatchRepository } from '@/application/dispatch/ports/dispatch-repository';
import type { DispatchTransaction } from '@/application/dispatch/ports/dispatch-transaction';
import { DispatchPermissionPolicy } from '@/application/dispatch/services/dispatch-permission-policy';
import { CancelDispatch } from '@/application/dispatch/use-cases/cancel-dispatch';
import { CompleteDispatch } from '@/application/dispatch/use-cases/complete-dispatch';
import { CreateDispatch } from '@/application/dispatch/use-cases/create-dispatch';
import { DispatchVehicle } from '@/application/dispatch/use-cases/dispatch-vehicle';
import { UpdateDraftDispatch } from '@/application/dispatch/use-cases/update-draft-dispatch';
import { createKyselyDispatchRepositories } from '@/infrastructure/database/dispatch/create-kysely-dispatch-repositories';
import type { Database } from '@/infrastructure/database/types';
import { NodeSha256DispatchConflictFingerprinter } from '@/infrastructure/dispatch/node-sha256-dispatch-conflict-fingerprinter';
import { UuidV7Generator } from '@/infrastructure/identifiers/uuid-v7-generator';

import {
  dispatchContext,
  dispatchDependencies,
  dispatchDraftCommand,
  dispatchTestAt,
  prepareDispatchDatabase,
  resetDispatchDatabase,
  seedDispatchReferences,
  type DispatchReferenceFixture,
} from '../helpers/dispatch-test-database';
import { createTestDatabase } from '../helpers/test-database';

interface Deferred {
  readonly promise: Promise<void>;
  resolve(): void;
}

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function delegatedRepository(
  repository: DispatchRepository,
  findForUpdate: DispatchRepository['findByPublicIdForUpdate'],
): DispatchRepository {
  return {
    findByPublicId: (publicId) => repository.findByPublicId(publicId),
    findByPublicIdForUpdate: findForUpdate,
    insert: (dispatch) => repository.insert(dispatch),
    updateDetails: (dispatch) => repository.updateDetails(dispatch),
    updateLifecycle: (dispatch) => repository.updateLifecycle(dispatch),
    list: (query) => repository.list(query),
  };
}

function controlledTransaction(input: {
  readonly database: Kysely<Database>;
  readonly acquired?: Deferred;
  readonly attempted?: Deferred;
  readonly release?: Deferred;
  readonly observeResourceLock?: boolean;
}): DispatchTransaction {
  return {
    execute(work) {
      return input.database.transaction().execute(async (transaction) => {
        const repositories = createKyselyDispatchRepositories(transaction);
        const observe = async <T>(operation: () => Promise<T>): Promise<T> => {
          input.attempted?.resolve();
          const result = await operation();
          input.acquired?.resolve();
          if (input.release !== undefined) await input.release.promise;
          return result;
        };
        const dispatches = delegatedRepository(repositories.dispatches, (publicId) =>
          input.observeResourceLock === true
            ? repositories.dispatches.findByPublicIdForUpdate(publicId)
            : observe(() => repositories.dispatches.findByPublicIdForUpdate(publicId)),
        );
        const offices = new Proxy(repositories.offices, {
          get(target, property, receiver) {
            if (
              property === 'findCurrentByPublicIdForUpdate' &&
              input.observeResourceLock === true
            ) {
              return (publicId: string) =>
                observe(() => target.findCurrentByPublicIdForUpdate(publicId));
            }
            const value = Reflect.get(target, property, receiver) as unknown;
            return typeof value === 'function' ? value.bind(target) : value;
          },
        });
        return work({ ...repositories, dispatches, offices });
      });
    },
  };
}

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

function dependencies(transaction: DispatchTransaction) {
  return {
    transaction,
    permissions: new DispatchPermissionPolicy(),
    publicIds: new UuidV7Generator(),
    clock: { now: () => dispatchTestAt },
    conflictFingerprints: new NodeSha256DispatchConflictFingerprinter(),
  };
}

describe('dispatch lifecycle concurrency', () => {
  it('lets dispatch commit before a waiting draft edit observes the terminal mutation rule', async () => {
    const base = dispatchDependencies(database);
    const created = await new CreateDispatch(base).execute({
      context: dispatchContext,
      command: dispatchDraftCommand(references, 'EDIT-RACE'),
    });
    const acquired = deferred();
    const attempted = deferred();
    const release = deferred();
    const winner = new DispatchVehicle(
      dependencies(
        controlledTransaction({ database, acquired, release, observeResourceLock: true }),
      ),
    ).execute({ context: dispatchContext, publicId: created.publicId });
    await acquired.promise;
    const loser = new UpdateDraftDispatch(
      dependencies(controlledTransaction({ database, attempted, observeResourceLock: true })),
    ).execute({
      context: dispatchContext,
      publicId: created.publicId,
      command: { ...dispatchDraftCommand(references, 'EDIT-RACE'), destination: 'Late edit' },
    });
    await attempted.promise;
    release.resolve();

    const results = await Promise.allSettled([winner, loser]);
    expect(results[0]).toMatchObject({ status: 'fulfilled', value: { status: 'DISPATCHED' } });
    expect(results[1]).toMatchObject({ status: 'rejected', reason: { httpStatus: 422 } });
  });

  it('lets completion commit before a waiting cancellation observes the terminal state', async () => {
    const base = dispatchDependencies(database);
    const created = await new CreateDispatch(base).execute({
      context: dispatchContext,
      command: dispatchDraftCommand(references, 'TERMINAL-RACE'),
    });
    await new DispatchVehicle(base).execute({
      context: dispatchContext,
      publicId: created.publicId,
    });
    const acquired = deferred();
    const attempted = deferred();
    const release = deferred();
    const winner = new CompleteDispatch(
      dependencies(controlledTransaction({ database, acquired, release })),
    ).execute({
      context: dispatchContext,
      publicId: created.publicId,
      command: { odoAfter: '1260.4' },
    });
    await acquired.promise;
    const loser = new CancelDispatch(
      dependencies(controlledTransaction({ database, attempted })),
    ).execute({
      context: dispatchContext,
      publicId: created.publicId,
      command: { reason: 'Cancellation lost the terminal lifecycle race.' },
    });
    await attempted.promise;
    release.resolve();

    const results = await Promise.allSettled([winner, loser]);
    expect(results[0]).toMatchObject({ status: 'fulfilled', value: { status: 'COMPLETED' } });
    expect(results[1]).toMatchObject({ status: 'rejected', reason: { httpStatus: 422 } });
  });
});
