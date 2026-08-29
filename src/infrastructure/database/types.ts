import type { ColumnType, Generated } from 'kysely';

import type {
  AuditPrimaryDatabase,
  AuditSinkDatabase,
} from '@/infrastructure/database/audit/types';

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

type DatabaseBoolean = ColumnType<number, number | boolean, number | boolean>;
type CreatedTimestamp = ColumnType<Date, Date | string, never>;
type UpdatedTimestamp = ColumnType<Date, Date | string, Date | string>;
type NullableTimestamp = ColumnType<Date | null, Date | string | null, Date | string | null>;
type CivilDate = ColumnType<string, string, string>;
type DecimalString = ColumnType<string, string, string>;

export interface UsersTable {
  id: Generated<string>;
  public_id: Buffer;
  username: string;
  email: string;
  full_name: string;
  password_hash: string;
  is_active: DatabaseBoolean;
  must_change_password: DatabaseBoolean;
  deleted_at: NullableTimestamp;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface RolesTable {
  id: Generated<string>;
  public_id: Buffer;
  code: string;
  name: string;
  is_privileged: DatabaseBoolean;
  is_active: DatabaseBoolean;
  is_system: DatabaseBoolean;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface PermissionsTable {
  id: Generated<string>;
  public_id: Buffer;
  code: string;
  name: string;
  is_active: DatabaseBoolean;
  is_system: DatabaseBoolean;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface UserRolesTable {
  id: Generated<string>;
  user_id: string;
  role_id: string;
  assigned_by_user_id: string | null;
  created_at: CreatedTimestamp;
}

export interface RolePermissionsTable {
  id: Generated<string>;
  role_id: string;
  permission_id: string;
  assigned_by_user_id: string | null;
  created_at: CreatedTimestamp;
}

export interface UserSessionsTable {
  id: Generated<string>;
  public_id: Buffer;
  user_id: string;
  token_hash: Buffer;
  csrf_token_hash: Buffer;
  is_privileged: DatabaseBoolean;
  created_at: CreatedTimestamp;
  last_seen_at: UpdatedTimestamp;
  idle_expires_at: UpdatedTimestamp;
  absolute_expires_at: UpdatedTimestamp;
  revoked_at: NullableTimestamp;
  revoke_reason: string | null;
}

export interface AuthenticationChallengesTable {
  id: Generated<string>;
  public_id: Buffer;
  user_id: string;
  token_hash: Buffer;
  csrf_token_hash: Buffer;
  challenge_type: 'PASSWORD_CHANGE' | 'TOTP_ENROLLMENT' | 'TOTP_VERIFICATION';
  failed_attempts: ColumnType<number, number | undefined, number>;
  expires_at: UpdatedTimestamp;
  consumed_at: NullableTimestamp;
  created_at: CreatedTimestamp;
}

export interface AuthenticationSettingsTable {
  id: number;
  mfa_required: DatabaseBoolean;
  updated_by_user_id: string | null;
  updated_at: UpdatedTimestamp;
}

export interface LoginRateLimitsTable {
  id: Generated<string>;
  bucket_type: 'ACCOUNT' | 'SOURCE' | 'TOTP';
  bucket_key: Buffer;
  window_started_at: UpdatedTimestamp;
  failure_count: ColumnType<number, number | undefined, number>;
  locked_until: NullableTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface UserTotpFactorsTable {
  id: Generated<string>;
  public_id: Buffer;
  user_id: string;
  status: 'PENDING' | 'ENABLED' | 'DISABLED';
  secret_ciphertext: Buffer;
  secret_iv: Buffer;
  secret_auth_tag: Buffer;
  key_version: number;
  last_used_counter: ColumnType<string | null, string | number | null, string | number | null>;
  confirmed_at: NullableTimestamp;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface AdminPasswordResetsTable {
  id: Generated<string>;
  public_id: Buffer;
  actor_user_id: string;
  target_user_id: string;
  request_id: string;
  reason: string;
  created_at: CreatedTimestamp;
}

export interface AuthSecurityEventsTable {
  id: Generated<string>;
  public_id: Buffer;
  event_type: string;
  actor_user_id: string | null;
  target_user_id: string | null;
  request_id: string;
  reason_code: string | null;
  metadata: ColumnType<JsonValue | null, string | null, never>;
  created_at: CreatedTimestamp;
}

export interface OfficesTable {
  id: Generated<string>;
  public_id: Buffer;
  office_name: string;
  abbreviation: string;
  status: 'ACTIVE' | 'INACTIVE';
  deleted_at: NullableTimestamp;
  deleted_by_user_id: string | null;
  delete_reason: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface DriversTable {
  id: Generated<string>;
  public_id: Buffer;
  full_name: string;
  contact_no: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  deleted_at: NullableTimestamp;
  deleted_by_user_id: string | null;
  delete_reason: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface VehiclesTable {
  id: Generated<string>;
  public_id: Buffer;
  model_brand: string;
  vehicle_type: string;
  plate_no: string;
  status: 'SERVICEABLE' | 'UNSERVICEABLE';
  remarks: string | null;
  deleted_at: NullableTimestamp;
  deleted_by_user_id: string | null;
  delete_reason: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface BudgetAllocationsTable {
  id: Generated<string>;
  public_id: Buffer;
  ppmp_number: string;
  office_id: string;
  quarter: number;
  fiscal_year: number;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'CANCELLED';
  deleted_at: NullableTimestamp;
  deleted_by_user_id: string | null;
  delete_reason: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface FuelSequenceMonthlyTable {
  id: Generated<string>;
  sequence_year: number;
  sequence_month: number;
  last_number: number;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface FuelIssuancesTable {
  id: Generated<string>;
  public_id: Buffer;
  ris_number: string | null;
  purchase_request_number: string;
  entry_date: CivilDate;
  driver_id: string;
  destination: string;
  purpose: string;
  vehicle_id: string;
  requested_liters: DecimalString | null;
  is_full_tank: DatabaseBoolean;
  issued_liters: DecimalString | null;
  unit_price: DecimalString;
  total_amount: DecimalString | null;
  budget_allocation_id: string;
  fuel_type: 'DIESEL' | 'GASOLINE';
  status: 'DRAFT' | 'POSTED' | 'VOIDED';
  created_by_user_id: string;
  posted_at: NullableTimestamp;
  voided_at: NullableTimestamp;
  voided_by_user_id: string | null;
  void_reason: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface FuelLedgerEntriesTable {
  id: Generated<string>;
  public_id: Buffer;
  fuel_issuance_id: string | null;
  fuel_type: 'DIESEL' | 'GASOLINE';
  transaction_type: 'OPENING' | 'RECEIPT' | 'ISSUANCE' | 'ADJUSTMENT';
  quantity: DecimalString;
  signed_quantity: DecimalString;
  effective_date: CivilDate;
  reference: string;
  occurred_at: CreatedTimestamp;
  created_at: CreatedTimestamp;
}

export interface VehicleDispatchesTable {
  id: Generated<string>;
  public_id: Buffer;
  driver_id: string;
  vehicle_id: string;
  requesting_office_id: string;
  entry_date: CivilDate;
  travel_date: CivilDate;
  travel_start_at: NullableTimestamp;
  travel_end_at: NullableTimestamp;
  destination: string;
  purpose: string;
  odo_before: DecimalString;
  odo_after: DecimalString | null;
  passenger_count: number;
  status: 'DRAFT' | 'DISPATCHED' | 'COMPLETED' | 'CANCELLED';
  created_by_user_id: string;
  dispatched_at: NullableTimestamp;
  completed_at: NullableTimestamp;
  cancelled_at: NullableTimestamp;
  cancelled_by_user_id: string | null;
  cancellation_reason: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface DispatchScheduleSettingsTable {
  id: number;
  policy: 'BLOCK' | 'WARN_AND_ACK';
  updated_by_user_id: string | null;
  updated_at: UpdatedTimestamp;
}

export interface VehicleDispatchConflictOverridesTable {
  id: Generated<string>;
  public_id: Buffer;
  dispatch_id: string;
  conflicting_dispatch_id: string;
  conflict_type: 'DRIVER' | 'VEHICLE' | 'DRIVER_AND_VEHICLE';
  policy: 'BLOCK' | 'WARN_AND_ACK';
  acknowledged_by_user_id: string;
  acknowledgement_reason: string;
  acknowledged_at: CreatedTimestamp;
  created_at: CreatedTimestamp;
}

export interface ExportJobsTable {
  id: Generated<string>;
  public_id: Buffer;
  requester_user_id: string;
  report_type:
    | 'FUEL_ISSUANCE'
    | 'DISPATCH'
    | 'FUEL_BY_OFFICE'
    | 'FUEL_BY_VEHICLE'
    | 'FUEL_TYPE_TOTALS'
    | 'FUEL_AMOUNT_BY_PERIOD'
    | 'DISPATCH_COUNT_BY_OFFICE'
    | 'VEHICLE_UTILIZATION'
    | 'BUDGET_ALLOCATION_ACTIVITY';
  period_type: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'CUSTOM';
  filters: ColumnType<JsonValue, string, string>;
  filter_hash: Buffer;
  mode: 'SYNCHRONOUS' | 'QUEUED';
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
  estimated_rows: number;
  actual_rows: number | null;
  attempts: ColumnType<number, number | undefined, number>;
  max_attempts: ColumnType<number, number | undefined, number>;
  available_at: UpdatedTimestamp;
  lease_owner: string | null;
  lease_expires_at: NullableTimestamp;
  started_at: NullableTimestamp;
  finished_at: NullableTimestamp;
  storage_key: string | null;
  filename: string | null;
  mime_type: string | null;
  byte_length: ColumnType<string | null, string | number | null, string | number | null>;
  sha256: Buffer | null;
  file_expires_at: NullableTimestamp;
  failure_code: string | null;
  failure_message: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface ExportDownloadTokensTable {
  id: Generated<string>;
  export_job_id: string;
  user_id: string;
  token_hash: Buffer;
  expires_at: UpdatedTimestamp;
  consumed_at: NullableTimestamp;
  created_at: CreatedTimestamp;
}

export interface Database extends AuditPrimaryDatabase, AuditSinkDatabase {
  application_metadata: ApplicationMetadataTable;
  users: UsersTable;
  roles: RolesTable;
  permissions: PermissionsTable;
  user_roles: UserRolesTable;
  role_permissions: RolePermissionsTable;
  user_sessions: UserSessionsTable;
  authentication_challenges: AuthenticationChallengesTable;
  authentication_settings: AuthenticationSettingsTable;
  login_rate_limits: LoginRateLimitsTable;
  user_totp_factors: UserTotpFactorsTable;
  admin_password_resets: AdminPasswordResetsTable;
  /** Migration-only legacy table. Migration 000003 removes it after verified backfill. */
  auth_security_events: AuthSecurityEventsTable;
  offices: OfficesTable;
  drivers: DriversTable;
  vehicles: VehiclesTable;
  budget_allocations: BudgetAllocationsTable;
  fuel_sequence_monthly: FuelSequenceMonthlyTable;
  fuel_issuances: FuelIssuancesTable;
  fuel_ledger_entries: FuelLedgerEntriesTable;
  vehicle_dispatches: VehicleDispatchesTable;
  dispatch_schedule_settings: DispatchScheduleSettingsTable;
  vehicle_dispatch_conflict_overrides: VehicleDispatchConflictOverridesTable;
  export_jobs: ExportJobsTable;
  export_download_tokens: ExportDownloadTokensTable;
}

export type DatabaseWithLegacyAuthSecurityEvents = Database;
