import type { Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { KyselyOfficeRepository } from '@/infrastructure/database/master-data/kysely-office-repository';
import type { Database } from '@/infrastructure/database/types';

import {
  prepareDispatchDatabase,
  resetDispatchDatabase,
  seedDispatchReferences,
  type DispatchReferenceFixture,
} from '../helpers/dispatch-test-database';
import { createTestDatabase } from '../helpers/test-database';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
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

describe('dispatch schedule resource serialization', () => {
  it('makes a second transaction wait for the same first resource lock', async () => {
    const firstAcquired = deferred();
    const secondAttempted = deferred();
    const releaseFirst = deferred();
    const order: string[] = [];

    const first = database.transaction().execute(async (transaction) => {
      await new KyselyOfficeRepository(transaction).findCurrentByPublicIdForUpdate(
        references.office.publicId.toString(),
      );
      order.push('first-acquired');
      firstAcquired.resolve();
      await releaseFirst.promise;
      order.push('first-released');
    });
    await firstAcquired.promise;

    const second = database.transaction().execute(async (transaction) => {
      secondAttempted.resolve();
      await new KyselyOfficeRepository(transaction).findCurrentByPublicIdForUpdate(
        references.office.publicId.toString(),
      );
      order.push('second-acquired');
    });
    await secondAttempted.promise;
    expect(order).toEqual(['first-acquired']);

    releaseFirst.resolve();
    await Promise.all([first, second]);
    expect(order).toEqual(['first-acquired', 'first-released', 'second-acquired']);
  });
});
