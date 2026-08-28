import { sql, type Kysely } from 'kysely';

import type { Database } from '@/infrastructure/database/types';

export async function up(database: Kysely<Database>): Promise<void> {
  await database.schema
    .createTable('vehicle_dispatches')
    .addColumn('id', 'bigint', (column) => column.unsigned().autoIncrement().primaryKey())
    .addColumn('public_id', 'binary(16)', (column) => column.notNull())
    .addColumn('driver_id', 'bigint', (column) => column.unsigned().notNull())
    .addColumn('vehicle_id', 'bigint', (column) => column.unsigned().notNull())
    .addColumn('requesting_office_id', 'bigint', (column) => column.unsigned().notNull())
    .addColumn('entry_date', 'date', (column) => column.notNull())
    .addColumn('travel_date', 'date', (column) => column.notNull())
    .addColumn('travel_start_at', 'datetime(6)')
    .addColumn('travel_end_at', 'datetime(6)')
    .addColumn('destination', 'varchar(255)', (column) => column.notNull())
    .addColumn('purpose', 'varchar(500)', (column) => column.notNull())
    .addColumn('odo_before', sql`decimal(12,1)`, (column) => column.notNull())
    .addColumn('odo_after', sql`decimal(12,1)`)
    .addColumn('passenger_count', 'integer', (column) => column.unsigned().notNull().defaultTo(0))
    .addColumn('status', 'varchar(10)', (column) => column.notNull().defaultTo('DRAFT'))
    .addColumn('created_by_user_id', 'bigint', (column) => column.unsigned().notNull())
    .addColumn('dispatched_at', 'datetime(6)')
    .addColumn('completed_at', 'datetime(6)')
    .addColumn('cancelled_at', 'datetime(6)')
    .addColumn('cancelled_by_user_id', 'bigint', (column) => column.unsigned())
    .addColumn('cancellation_reason', 'varchar(500)')
    .addColumn('created_at', 'datetime(6)', (column) => column.notNull())
    .addColumn('updated_at', 'datetime(6)', (column) => column.notNull())
    .addUniqueConstraint('uq_vehicle_dispatches_public_id', ['public_id'])
    .addCheckConstraint(
      'chk_vehicle_dispatches_status',
      sql`status in ('DRAFT', 'DISPATCHED', 'COMPLETED', 'CANCELLED')`,
    )
    .addCheckConstraint(
      'chk_vehicle_dispatches_odo_nonnegative',
      sql`odo_before >= 0 and (odo_after is null or odo_after >= 0)`,
    )
    .addCheckConstraint(
      'chk_vehicle_dispatches_odo_order',
      sql`odo_after is null or odo_after >= odo_before`,
    )
    .addCheckConstraint(
      'chk_vehicle_dispatches_lifecycle',
      sql`(
          status = 'DRAFT'
          and odo_after is null
          and dispatched_at is null
          and completed_at is null
          and cancelled_at is null
          and cancelled_by_user_id is null
          and cancellation_reason is null
        ) or (
          status = 'DISPATCHED'
          and odo_after is null
          and dispatched_at is not null
          and completed_at is null
          and cancelled_at is null
          and cancelled_by_user_id is null
          and cancellation_reason is null
        ) or (
          status = 'COMPLETED'
          and odo_after is not null
          and dispatched_at is not null
          and completed_at is not null
          and cancelled_at is null
          and cancelled_by_user_id is null
          and cancellation_reason is null
        ) or (
          status = 'CANCELLED'
          and odo_after is null
          and completed_at is null
          and cancelled_at is not null
          and cancelled_by_user_id is not null
          and char_length(cancellation_reason) between 10 and 500
        )`,
    )
    .addForeignKeyConstraint(
      'fk_vehicle_dispatches_driver',
      ['driver_id'],
      'drivers',
      ['id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .addForeignKeyConstraint(
      'fk_vehicle_dispatches_vehicle',
      ['vehicle_id'],
      'vehicles',
      ['id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .addForeignKeyConstraint(
      'fk_vehicle_dispatches_office',
      ['requesting_office_id'],
      'offices',
      ['id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .addForeignKeyConstraint(
      'fk_vehicle_dispatches_created_by',
      ['created_by_user_id'],
      'users',
      ['id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .addForeignKeyConstraint(
      'fk_vehicle_dispatches_cancelled_by',
      ['cancelled_by_user_id'],
      'users',
      ['id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .execute();

  await database.schema
    .createIndex('idx_vehicle_dispatches_travel')
    .on('vehicle_dispatches')
    .columns(['travel_date', 'public_id'])
    .execute();
  await database.schema
    .createIndex('idx_vehicle_dispatches_office_travel')
    .on('vehicle_dispatches')
    .columns(['requesting_office_id', 'travel_date', 'public_id'])
    .execute();
  await database.schema
    .createIndex('idx_vehicle_dispatches_vehicle_schedule')
    .on('vehicle_dispatches')
    .columns(['vehicle_id', 'travel_date', 'status'])
    .execute();
  await database.schema
    .createIndex('idx_vehicle_dispatches_driver_schedule')
    .on('vehicle_dispatches')
    .columns(['driver_id', 'travel_date', 'status'])
    .execute();
}

export async function down(database: Kysely<Database>): Promise<void> {
  await database.schema.dropTable('vehicle_dispatches').execute();
}
