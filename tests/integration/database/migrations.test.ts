import { sql, type Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { PublicId } from '@/domain/shared/value-objects/public-id';
import { createMigrator } from '@/infrastructure/database/migrator';
import type { Database } from '@/infrastructure/database/types';
import { publicIdToBinary } from '@/infrastructure/database/uuid-binary';

import { createTestDatabase } from '../helpers/test-database';

interface ColumnDescription {
  readonly COLUMN_NAME: string;
  readonly COLUMN_TYPE: string;
  readonly DATA_TYPE: string;
  readonly DATETIME_PRECISION: number | null;
}

let database: Kysely<Database>;

beforeAll(async () => {
  database = createTestDatabase(inject('mysql'));
  const result = await createMigrator(database).migrateToLatest();
  expect(result.error).toBeUndefined();
});

afterAll(async () => {
  await database.destroy();
});

describe('baseline migrations', () => {
  it('creates the expected identity, JSON, uniqueness, and timestamp schema', async () => {
    const result = await sql<ColumnDescription>`
      select COLUMN_NAME, COLUMN_TYPE, DATA_TYPE, DATETIME_PRECISION
      from information_schema.columns
      where table_schema = database() and table_name = 'application_metadata'
      order by ORDINAL_POSITION
    `.execute(database);
    const columns = new Map(result.rows.map((column) => [column.COLUMN_NAME, column]));

    expect(columns.get('id')?.COLUMN_TYPE).toBe('bigint unsigned');
    expect(columns.get('public_id')?.COLUMN_TYPE).toBe('binary(16)');
    expect(columns.get('metadata_value')?.DATA_TYPE).toBe('json');
    expect(columns.get('created_at')?.DATETIME_PRECISION).toBe(6);
    expect(columns.get('updated_at')?.DATETIME_PRECISION).toBe(6);

    const indexes = await sql<{ COLUMN_NAME: string; NON_UNIQUE: string }>`
      select COLUMN_NAME, NON_UNIQUE
      from information_schema.statistics
      where table_schema = database() and table_name = 'application_metadata'
    `.execute(database);
    expect(indexes.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ COLUMN_NAME: 'public_id', NON_UNIQUE: '0' }),
        expect.objectContaining({ COLUMN_NAME: 'metadata_key', NON_UNIQUE: '0' }),
      ]),
    );
  });

  it('preserves internal BIGINT values above Number.MAX_SAFE_INTEGER as strings', async () => {
    await sql`alter table application_metadata auto_increment = 9007199254740993`.execute(database);
    const publicId = PublicId.from('019c043f-422c-7141-8a03-a9d9bda3544a');
    await database
      .insertInto('application_metadata')
      .values({
        public_id: publicIdToBinary(publicId),
        metadata_key: 'foundation.bigint',
        metadata_value: JSON.stringify({ validated: true }),
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute();

    const row = await database
      .selectFrom('application_metadata')
      .select('id')
      .where('metadata_key', '=', 'foundation.bigint')
      .executeTakeFirstOrThrow();
    expect(row.id).toBe('9007199254740993');
  });

  it('enforces public identifier uniqueness', async () => {
    const publicId = PublicId.from('019c043f-422c-7141-8a03-a9d9bda3544a');

    await expect(
      database
        .insertInto('application_metadata')
        .values({
          public_id: publicIdToBinary(publicId),
          metadata_key: 'foundation.duplicate',
          metadata_value: null,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute(),
    ).rejects.toThrow();
  });

  it('tracks, rolls back, and reapplies the baseline migration', async () => {
    const migrator = createMigrator(database);
    expect((await migrator.getMigrations())[0]?.executedAt).toBeInstanceOf(Date);

    const rollback = await migrator.migrateDown();
    expect(rollback.error).toBeUndefined();
    const afterRollback = await sql<{ count: string }>`
      select count(*) as count
      from information_schema.tables
      where table_schema = database() and table_name = 'application_metadata'
    `.execute(database);
    expect(afterRollback.rows[0]?.count).toBe('0');

    const reapply = await migrator.migrateToLatest();
    expect(reapply.error).toBeUndefined();
    expect((await migrator.getMigrations())[0]?.executedAt).toBeInstanceOf(Date);
  });
});
