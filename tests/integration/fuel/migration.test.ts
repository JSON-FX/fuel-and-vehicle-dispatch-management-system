import { sql, type Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { createMigrator } from '@/infrastructure/database/migrator';
import type { Database } from '@/infrastructure/database/types';

import { createTestDatabase } from '../helpers/test-database';

let database: Kysely<Database>;

beforeAll(async () => {
  database = createTestDatabase(inject('mysql'));
  const result = await createMigrator(database).migrateToLatest();
  expect(result.error).toBeUndefined();
});

afterAll(async () => {
  await database.destroy();
});

describe('fuel workflow migration', () => {
  it('creates the monthly sequence, issuance, and append-only ledger table shapes', async () => {
    const columns = await sql<{
      TABLE_NAME: string;
      COLUMN_NAME: string;
      COLUMN_TYPE: string;
      IS_NULLABLE: 'YES' | 'NO';
      DATETIME_PRECISION: number | null;
    }>`
      select TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, DATETIME_PRECISION
      from information_schema.columns
      where table_schema = database()
        and table_name in ('fuel_sequence_monthly', 'fuel_issuances', 'fuel_ledger_entries')
    `.execute(database);
    const byName = new Map(
      columns.rows.map((column) => [`${column.TABLE_NAME}.${column.COLUMN_NAME}`, column]),
    );

    expect(byName.get('fuel_sequence_monthly.sequence_month')?.COLUMN_TYPE).toBe(
      'tinyint unsigned',
    );
    expect(byName.get('fuel_sequence_monthly.last_number')?.COLUMN_TYPE).toBe('int unsigned');
    expect(byName.get('fuel_issuances.entry_date')?.COLUMN_TYPE).toBe('date');
    expect(byName.get('fuel_issuances.ris_number')?.IS_NULLABLE).toBe('YES');
    expect(byName.get('fuel_issuances.requested_liters')?.COLUMN_TYPE).toBe('decimal(10,3)');
    expect(byName.get('fuel_issuances.issued_liters')?.COLUMN_TYPE).toBe('decimal(10,3)');
    expect(byName.get('fuel_issuances.unit_price')?.COLUMN_TYPE).toBe('decimal(12,2)');
    expect(byName.get('fuel_issuances.total_amount')?.COLUMN_TYPE).toBe('decimal(14,2)');
    expect(byName.get('fuel_issuances.posted_at')?.DATETIME_PRECISION).toBe(6);
    expect(byName.get('fuel_ledger_entries.quantity')?.COLUMN_TYPE).toBe('decimal(12,3)');
    expect(byName.get('fuel_ledger_entries.signed_quantity')?.COLUMN_TYPE).toBe('decimal(12,3)');
    expect(byName.get('fuel_ledger_entries.effective_date')?.COLUMN_TYPE).toBe('date');
    expect(byName.get('fuel_ledger_entries.occurred_at')?.DATETIME_PRECISION).toBe(6);
  });

  it('enforces named lifecycle, quantity, type, reference, and sequence constraints', async () => {
    const constraints = await sql<{
      TABLE_NAME: string;
      CONSTRAINT_NAME: string;
      CONSTRAINT_TYPE: string;
    }>`
      select TABLE_NAME, CONSTRAINT_NAME, CONSTRAINT_TYPE
      from information_schema.table_constraints
      where table_schema = database()
        and table_name in ('fuel_sequence_monthly', 'fuel_issuances', 'fuel_ledger_entries')
    `.execute(database);
    expect(constraints.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ CONSTRAINT_NAME: 'uq_fuel_sequence_monthly_period' }),
        expect.objectContaining({ CONSTRAINT_NAME: 'chk_fuel_sequence_monthly_month' }),
        expect.objectContaining({ CONSTRAINT_NAME: 'uq_fuel_issuances_public_id' }),
        expect.objectContaining({ CONSTRAINT_NAME: 'uq_fuel_issuances_ris_number' }),
        expect.objectContaining({ CONSTRAINT_NAME: 'chk_fuel_issuances_request_mode' }),
        expect.objectContaining({ CONSTRAINT_NAME: 'chk_fuel_issuances_lifecycle' }),
        expect.objectContaining({ CONSTRAINT_NAME: 'fk_fuel_issuances_driver' }),
        expect.objectContaining({ CONSTRAINT_NAME: 'fk_fuel_issuances_vehicle' }),
        expect.objectContaining({ CONSTRAINT_NAME: 'fk_fuel_issuances_allocation' }),
        expect.objectContaining({ CONSTRAINT_NAME: 'uq_fuel_ledger_entries_linked_type' }),
        expect.objectContaining({ CONSTRAINT_NAME: 'chk_fuel_ledger_entries_sign' }),
        expect.objectContaining({ CONSTRAINT_NAME: 'fk_fuel_ledger_entries_issuance' }),
      ]),
    );
  });

  it('adds indexes for sequence locking, issuance lists, references, and balance periods', async () => {
    const indexes = await sql<{ TABLE_NAME: string; INDEX_NAME: string }>`
      select distinct TABLE_NAME, INDEX_NAME
      from information_schema.statistics
      where table_schema = database()
        and table_name in ('fuel_sequence_monthly', 'fuel_issuances', 'fuel_ledger_entries')
    `.execute(database);
    expect(indexes.rows).toEqual(
      expect.arrayContaining([
        { TABLE_NAME: 'fuel_issuances', INDEX_NAME: 'idx_fuel_issuances_list' },
        { TABLE_NAME: 'fuel_issuances', INDEX_NAME: 'idx_fuel_issuances_driver' },
        { TABLE_NAME: 'fuel_issuances', INDEX_NAME: 'idx_fuel_issuances_vehicle' },
        { TABLE_NAME: 'fuel_issuances', INDEX_NAME: 'idx_fuel_issuances_allocation' },
        { TABLE_NAME: 'fuel_ledger_entries', INDEX_NAME: 'idx_fuel_ledger_balance' },
        { TABLE_NAME: 'fuel_ledger_entries', INDEX_NAME: 'idx_fuel_ledger_issuance' },
      ]),
    );
  });
});
