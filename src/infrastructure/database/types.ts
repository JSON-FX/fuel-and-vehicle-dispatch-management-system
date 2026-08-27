import type { ColumnType, Generated } from 'kysely';

export type JsonValue =
  string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export interface ApplicationMetadataTable {
  id: Generated<string>;
  public_id: Buffer;
  metadata_key: string;
  metadata_value: ColumnType<JsonValue | null, string | null, string | null>;
  created_at: ColumnType<Date, Date | string, never>;
  updated_at: ColumnType<Date, Date | string, Date | string>;
}

export interface Database {
  application_metadata: ApplicationMetadataTable;
}
