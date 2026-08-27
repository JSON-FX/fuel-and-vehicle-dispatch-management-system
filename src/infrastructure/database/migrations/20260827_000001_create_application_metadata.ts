import type { Kysely } from 'kysely';

const tableName = 'application_metadata';

export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable(tableName)
    .addColumn('id', 'bigint', (column) => column.unsigned().autoIncrement().primaryKey())
    .addColumn('public_id', 'binary(16)', (column) => column.notNull().unique())
    .addColumn('metadata_key', 'varchar(100)', (column) => column.notNull().unique())
    .addColumn('metadata_value', 'json')
    .addColumn('created_at', 'datetime(6)', (column) => column.notNull())
    .addColumn('updated_at', 'datetime(6)', (column) => column.notNull())
    .execute();
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.dropTable(tableName).execute();
}
