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
}

export type DatabaseWithLegacyAuthSecurityEvents = Database;
