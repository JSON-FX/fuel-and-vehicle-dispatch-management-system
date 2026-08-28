import type { ColumnType, Generated } from 'kysely';

type CreatedTimestamp = ColumnType<Date, Date | string, never>;
type MutableTimestamp = ColumnType<Date, Date | string, Date | string>;
type NullableTimestamp = ColumnType<Date | null, Date | string | null, Date | string | null>;

export interface AuditOutboxTable {
  source_position: Generated<string>;
  legacy_security_event_id: string | null;
  event_public_id: Buffer;
  schema_version: number;
  occurred_at: CreatedTimestamp;
  actor_public_id: Buffer | null;
  action: string;
  entity_type: string | null;
  entity_public_id: Buffer | null;
  request_id: string;
  reason_code: string | null;
  ip_address: Buffer | null;
  user_agent: string | null;
  canonical_payload: string;
  captured_at: CreatedTimestamp;
}

export interface AuditChainEntriesTable {
  sequence: string;
  source_position: string;
  event_public_id: Buffer;
  schema_version: number;
  occurred_at: CreatedTimestamp;
  actor_public_id: Buffer | null;
  action: string;
  entity_type: string | null;
  entity_public_id: Buffer | null;
  request_id: string;
  reason_code: string | null;
  ip_address: Buffer | null;
  user_agent: string | null;
  canonical_payload: string;
  previous_hash: Buffer;
  record_hash: Buffer;
  chained_at: CreatedTimestamp;
}

export interface AuditChainHeadsTable {
  head_name: string;
  last_sequence: string;
  last_source_position: string;
  last_record_hash: Buffer;
  updated_at: MutableTimestamp;
}

export interface AuditSinkDeliveriesTable {
  sequence: string;
  attempt_count: ColumnType<number, number | undefined, number>;
  next_retry_at: MutableTimestamp;
  last_error_code: string | null;
  delivered_at: NullableTimestamp;
  delivery_fingerprint: Buffer | null;
  updated_at: MutableTimestamp;
}

export interface AuditVerificationRunsTable {
  id: Generated<string>;
  public_id: Buffer;
  high_water_sequence: string;
  high_water_record_hash: Buffer;
  verified_count: string;
  status: 'PASS' | 'FAIL';
  first_mismatch_sequence: string | null;
  first_mismatch_type: string | null;
  summary: string;
  started_at: CreatedTimestamp;
  completed_at: CreatedTimestamp;
}

export interface AuditSinkEntriesTable {
  delivery_fingerprint: Buffer;
  sequence: string;
  event_public_id: Buffer;
  canonical_payload: string;
  previous_hash: Buffer;
  record_hash: Buffer;
  delivered_at: CreatedTimestamp;
}

export interface AuditPrimaryDatabase {
  audit_outbox: AuditOutboxTable;
  audit_chain_entries: AuditChainEntriesTable;
  audit_chain_heads: AuditChainHeadsTable;
  audit_sink_deliveries: AuditSinkDeliveriesTable;
  audit_verification_runs: AuditVerificationRunsTable;
}

export interface AuditSinkDatabase {
  audit_sink_entries: AuditSinkEntriesTable;
}
