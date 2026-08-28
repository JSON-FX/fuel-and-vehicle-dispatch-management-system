import { sql, type Kysely } from 'kysely';

import type { Database } from '@/infrastructure/database/types';

export async function up(database: Kysely<Database>): Promise<void> {
  await database.schema
    .createTable('fuel_sequence_monthly')
    .addColumn('id', 'bigint', (column) => column.unsigned().autoIncrement().primaryKey())
    .addColumn('sequence_year', 'smallint', (column) => column.unsigned().notNull())
    .addColumn('sequence_month', sql`tinyint unsigned`, (column) => column.notNull())
    .addColumn('last_number', 'integer', (column) => column.unsigned().notNull().defaultTo(0))
    .addColumn('created_at', 'datetime(6)', (column) => column.notNull())
    .addColumn('updated_at', 'datetime(6)', (column) => column.notNull())
    .addUniqueConstraint('uq_fuel_sequence_monthly_period', ['sequence_year', 'sequence_month'])
    .addCheckConstraint('chk_fuel_sequence_monthly_year', sql`sequence_year between 2000 and 9999`)
    .addCheckConstraint('chk_fuel_sequence_monthly_month', sql`sequence_month between 1 and 12`)
    .execute();

  await database.schema
    .createTable('fuel_issuances')
    .addColumn('id', 'bigint', (column) => column.unsigned().autoIncrement().primaryKey())
    .addColumn('public_id', 'binary(16)', (column) => column.notNull())
    .addColumn('ris_number', 'varchar(32)')
    .addColumn('purchase_request_number', 'varchar(80)', (column) => column.notNull())
    .addColumn('entry_date', 'date', (column) => column.notNull())
    .addColumn('driver_id', 'bigint', (column) => column.unsigned().notNull())
    .addColumn('destination', 'varchar(255)', (column) => column.notNull().defaultTo('AOR'))
    .addColumn('purpose', 'varchar(1000)', (column) => column.notNull())
    .addColumn('vehicle_id', 'bigint', (column) => column.unsigned().notNull())
    .addColumn('requested_liters', sql`decimal(10,3)`)
    .addColumn('is_full_tank', 'boolean', (column) => column.notNull().defaultTo(false))
    .addColumn('issued_liters', sql`decimal(10,3)`)
    .addColumn('unit_price', sql`decimal(12,2)`, (column) => column.notNull())
    .addColumn('total_amount', sql`decimal(14,2)`)
    .addColumn('budget_allocation_id', 'bigint', (column) => column.unsigned().notNull())
    .addColumn('fuel_type', 'varchar(8)', (column) => column.notNull())
    .addColumn('status', 'varchar(6)', (column) => column.notNull().defaultTo('DRAFT'))
    .addColumn('created_by_user_id', 'bigint', (column) => column.unsigned().notNull())
    .addColumn('posted_at', 'datetime(6)')
    .addColumn('voided_at', 'datetime(6)')
    .addColumn('voided_by_user_id', 'bigint', (column) => column.unsigned())
    .addColumn('void_reason', 'varchar(500)')
    .addColumn('created_at', 'datetime(6)', (column) => column.notNull())
    .addColumn('updated_at', 'datetime(6)', (column) => column.notNull())
    .addUniqueConstraint('uq_fuel_issuances_public_id', ['public_id'])
    .addUniqueConstraint('uq_fuel_issuances_ris_number', ['ris_number'])
    .addCheckConstraint(
      'chk_fuel_issuances_request_mode',
      sql`(is_full_tank = true and requested_liters is null)
        or (is_full_tank = false and requested_liters > 0)`,
    )
    .addCheckConstraint(
      'chk_fuel_issuances_issued_liters',
      sql`issued_liters is null or issued_liters > 0`,
    )
    .addCheckConstraint('chk_fuel_issuances_unit_price', sql`unit_price > 0`)
    .addCheckConstraint('chk_fuel_issuances_fuel_type', sql`fuel_type in ('DIESEL', 'GASOLINE')`)
    .addCheckConstraint('chk_fuel_issuances_status', sql`status in ('DRAFT', 'POSTED', 'VOIDED')`)
    .addCheckConstraint(
      'chk_fuel_issuances_lifecycle',
      sql`(
          status = 'DRAFT'
          and ris_number is null
          and total_amount is null
          and posted_at is null
          and voided_at is null
          and voided_by_user_id is null
          and void_reason is null
        ) or (
          status = 'POSTED'
          and ris_number is not null
          and issued_liters > 0
          and total_amount > 0
          and posted_at is not null
          and voided_at is null
          and voided_by_user_id is null
          and void_reason is null
        ) or (
          status = 'VOIDED'
          and ris_number is not null
          and issued_liters > 0
          and total_amount > 0
          and posted_at is not null
          and voided_at is not null
          and voided_by_user_id is not null
          and char_length(void_reason) between 10 and 500
        )`,
    )
    .addForeignKeyConstraint('fk_fuel_issuances_driver', ['driver_id'], 'drivers', ['id'], (c) =>
      c.onDelete('restrict'),
    )
    .addForeignKeyConstraint(
      'fk_fuel_issuances_vehicle',
      ['vehicle_id'],
      'vehicles',
      ['id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .addForeignKeyConstraint(
      'fk_fuel_issuances_allocation',
      ['budget_allocation_id'],
      'budget_allocations',
      ['id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .addForeignKeyConstraint(
      'fk_fuel_issuances_created_by',
      ['created_by_user_id'],
      'users',
      ['id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .addForeignKeyConstraint(
      'fk_fuel_issuances_voided_by',
      ['voided_by_user_id'],
      'users',
      ['id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .execute();

  await database.schema
    .createIndex('idx_fuel_issuances_list')
    .on('fuel_issuances')
    .columns(['entry_date', 'public_id'])
    .execute();
  await database.schema
    .createIndex('idx_fuel_issuances_filters')
    .on('fuel_issuances')
    .columns(['status', 'fuel_type', 'entry_date', 'public_id'])
    .execute();
  await database.schema
    .createIndex('idx_fuel_issuances_driver')
    .on('fuel_issuances')
    .columns(['driver_id', 'entry_date'])
    .execute();
  await database.schema
    .createIndex('idx_fuel_issuances_vehicle')
    .on('fuel_issuances')
    .columns(['vehicle_id', 'entry_date'])
    .execute();
  await database.schema
    .createIndex('idx_fuel_issuances_allocation')
    .on('fuel_issuances')
    .columns(['budget_allocation_id', 'entry_date'])
    .execute();

  await database.schema
    .createTable('fuel_ledger_entries')
    .addColumn('id', 'bigint', (column) => column.unsigned().autoIncrement().primaryKey())
    .addColumn('public_id', 'binary(16)', (column) => column.notNull())
    .addColumn('fuel_issuance_id', 'bigint', (column) => column.unsigned())
    .addColumn('fuel_type', 'varchar(8)', (column) => column.notNull())
    .addColumn('transaction_type', 'varchar(10)', (column) => column.notNull())
    .addColumn('quantity', sql`decimal(12,3)`, (column) => column.notNull())
    .addColumn('signed_quantity', sql`decimal(12,3)`, (column) => column.notNull())
    .addColumn('effective_date', 'date', (column) => column.notNull())
    .addColumn('reference', 'varchar(100)', (column) => column.notNull())
    .addColumn('occurred_at', 'datetime(6)', (column) => column.notNull())
    .addColumn('created_at', 'datetime(6)', (column) => column.notNull())
    .addUniqueConstraint('uq_fuel_ledger_entries_public_id', ['public_id'])
    .addUniqueConstraint('uq_fuel_ledger_entries_linked_type', [
      'fuel_issuance_id',
      'transaction_type',
    ])
    .addCheckConstraint(
      'chk_fuel_ledger_entries_fuel_type',
      sql`fuel_type in ('DIESEL', 'GASOLINE')`,
    )
    .addCheckConstraint(
      'chk_fuel_ledger_entries_type',
      sql`transaction_type in ('OPENING', 'RECEIPT', 'ISSUANCE', 'ADJUSTMENT')`,
    )
    .addCheckConstraint('chk_fuel_ledger_entries_quantity', sql`quantity > 0`)
    .addCheckConstraint(
      'chk_fuel_ledger_entries_sign',
      sql`abs(signed_quantity) = quantity
        and (
          (transaction_type = 'ISSUANCE' and signed_quantity < 0)
          or (transaction_type in ('OPENING', 'RECEIPT') and signed_quantity > 0)
          or (transaction_type = 'ADJUSTMENT' and signed_quantity <> 0)
        )`,
    )
    .addCheckConstraint(
      'chk_fuel_ledger_entries_issuance_link',
      sql`transaction_type <> 'ISSUANCE' or fuel_issuance_id is not null`,
    )
    .addForeignKeyConstraint(
      'fk_fuel_ledger_entries_issuance',
      ['fuel_issuance_id'],
      'fuel_issuances',
      ['id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .execute();

  await database.schema
    .createIndex('idx_fuel_ledger_balance')
    .on('fuel_ledger_entries')
    .columns(['fuel_type', 'effective_date', 'transaction_type'])
    .execute();
  await database.schema
    .createIndex('idx_fuel_ledger_issuance')
    .on('fuel_ledger_entries')
    .columns(['fuel_issuance_id', 'created_at'])
    .execute();
}

export async function down(database: Kysely<Database>): Promise<void> {
  await database.schema.dropTable('fuel_ledger_entries').execute();
  await database.schema.dropTable('fuel_issuances').execute();
  await database.schema.dropTable('fuel_sequence_monthly').execute();
}
