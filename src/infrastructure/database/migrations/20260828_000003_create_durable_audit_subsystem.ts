import canonicalize from 'canonicalize';
import { parse as parseUuid, stringify as stringifyUuid } from 'uuid';

import { sql, type Kysely } from 'kysely';

import type {
  DatabaseWithLegacyAuthSecurityEvents,
  JsonValue,
} from '@/infrastructure/database/types';

const PRIMARY_AUDIT_SCHEMA = 'fvdms_audit';
const SINK_AUDIT_SCHEMA = 'fvdms_audit_sink';
const seededAt = new Date('2026-08-28T00:10:00.000Z');
const maximumPayloadBytes = 65_536;
const forbiddenMetadataKeys = new Set([
  '__proto__',
  'authorization',
  'constructor',
  'cookie',
  'csrftoken',
  'encryptedsecret',
  'manualsecret',
  'password',
  'passwordhash',
  'prototype',
  'resettoken',
  'sessiontoken',
  'totpsecret',
]);

export async function up(database: Kysely<DatabaseWithLegacyAuthSecurityEvents>): Promise<void> {
  const primary = database.withSchema(PRIMARY_AUDIT_SCHEMA);
  const sink = database.withSchema(SINK_AUDIT_SCHEMA);

  await createPrimaryTables(primary);
  await createSinkTable(sink);

  await primary
    .insertInto('audit_chain_heads')
    .values({
      head_name: 'global',
      last_sequence: '0',
      last_source_position: '0',
      last_record_hash: Buffer.alloc(32),
      updated_at: seededAt,
    })
    .execute();

  await seedAuditPermissions(database);
  await backfillLegacyEvents(database, primary);
  await database.schema.dropTable('auth_security_events').execute();
}

async function createPrimaryTables(
  database: Kysely<DatabaseWithLegacyAuthSecurityEvents>,
): Promise<void> {
  await database.schema
    .createTable('audit_outbox')
    .addColumn('source_position', 'bigint', (column) =>
      column.unsigned().autoIncrement().primaryKey(),
    )
    .addColumn('legacy_security_event_id', 'bigint', (column) => column.unsigned().unique())
    .addColumn('event_public_id', 'binary(16)', (column) => column.notNull().unique())
    .addColumn('schema_version', 'smallint', (column) => column.unsigned().notNull())
    .addColumn('occurred_at', 'datetime(3)', (column) => column.notNull())
    .addColumn('actor_public_id', 'binary(16)')
    .addColumn('action', 'varchar(96)', (column) => column.notNull())
    .addColumn('entity_type', 'varchar(64)')
    .addColumn('entity_public_id', 'binary(16)')
    .addColumn('request_id', 'varchar(128)', (column) => column.notNull())
    .addColumn('reason_code', 'varchar(96)')
    .addColumn('ip_address', 'varbinary(16)')
    .addColumn('user_agent', 'varchar(512)')
    .addColumn('canonical_payload', sql`longtext`, (column) => column.notNull())
    .addColumn('captured_at', 'datetime(6)', (column) => column.notNull())
    .addCheckConstraint('chk_audit_outbox_schema_version', sql`schema_version = 1`)
    .addCheckConstraint(
      'chk_audit_outbox_entity_reference',
      sql`(entity_type is null and entity_public_id is null)
        or (entity_type is not null and entity_public_id is not null)`,
    )
    .addCheckConstraint(
      'chk_audit_outbox_payload',
      sql`json_valid(canonical_payload) and octet_length(canonical_payload) <= 65536`,
    )
    .execute();

  await database.schema
    .createIndex('idx_audit_outbox_occurred_at')
    .on('audit_outbox')
    .columns(['occurred_at', 'source_position'])
    .execute();

  await database.schema
    .createTable('audit_chain_entries')
    .addColumn('sequence', 'bigint', (column) => column.unsigned().primaryKey())
    .addColumn('source_position', 'bigint', (column) => column.unsigned().notNull())
    .addColumn('event_public_id', 'binary(16)', (column) => column.notNull())
    .addColumn('schema_version', 'smallint', (column) => column.unsigned().notNull())
    .addColumn('occurred_at', 'datetime(3)', (column) => column.notNull())
    .addColumn('actor_public_id', 'binary(16)')
    .addColumn('action', 'varchar(96)', (column) => column.notNull())
    .addColumn('entity_type', 'varchar(64)')
    .addColumn('entity_public_id', 'binary(16)')
    .addColumn('request_id', 'varchar(128)', (column) => column.notNull())
    .addColumn('reason_code', 'varchar(96)')
    .addColumn('ip_address', 'varbinary(16)')
    .addColumn('user_agent', 'varchar(512)')
    .addColumn('canonical_payload', sql`longtext`, (column) => column.notNull())
    .addColumn('previous_hash', 'binary(32)', (column) => column.notNull())
    .addColumn('record_hash', 'binary(32)', (column) => column.notNull())
    .addColumn('chained_at', 'datetime(6)', (column) => column.notNull())
    .addUniqueConstraint('uq_audit_chain_source_position', ['source_position'])
    .addUniqueConstraint('uq_audit_chain_event_public_id', ['event_public_id'])
    .addCheckConstraint('chk_audit_chain_sequence', sql`sequence > 0`)
    .addCheckConstraint('chk_audit_chain_schema_version', sql`schema_version = 1`)
    .addCheckConstraint(
      'chk_audit_chain_entity_reference',
      sql`(entity_type is null and entity_public_id is null)
        or (entity_type is not null and entity_public_id is not null)`,
    )
    .addCheckConstraint(
      'chk_audit_chain_payload',
      sql`json_valid(canonical_payload) and octet_length(canonical_payload) <= 65536`,
    )
    .execute();

  await database.schema
    .createIndex('idx_audit_chain_occurred_sequence')
    .on('audit_chain_entries')
    .columns(['occurred_at', 'sequence'])
    .execute();
  await database.schema
    .createIndex('idx_audit_chain_action_sequence')
    .on('audit_chain_entries')
    .columns(['action', 'sequence'])
    .execute();
  await database.schema
    .createIndex('idx_audit_chain_actor_sequence')
    .on('audit_chain_entries')
    .columns(['actor_public_id', 'sequence'])
    .execute();
  await database.schema
    .createIndex('idx_audit_chain_entity_sequence')
    .on('audit_chain_entries')
    .columns(['entity_type', 'entity_public_id', 'sequence'])
    .execute();
  await database.schema
    .createIndex('idx_audit_chain_request_sequence')
    .on('audit_chain_entries')
    .columns(['request_id', 'sequence'])
    .execute();

  await database.schema
    .createTable('audit_chain_heads')
    .addColumn('head_name', 'varchar(32)', (column) => column.primaryKey())
    .addColumn('last_sequence', 'bigint', (column) => column.unsigned().notNull())
    .addColumn('last_source_position', 'bigint', (column) => column.unsigned().notNull())
    .addColumn('last_record_hash', 'binary(32)', (column) => column.notNull())
    .addColumn('updated_at', 'datetime(6)', (column) => column.notNull())
    .addCheckConstraint('chk_audit_chain_head_name', sql`head_name = 'global'`)
    .execute();

  await database.schema
    .createTable('audit_sink_deliveries')
    .addColumn('sequence', 'bigint', (column) =>
      column
        .unsigned()
        .primaryKey()
        .references('audit_chain_entries.sequence')
        .onDelete('restrict'),
    )
    .addColumn('attempt_count', 'integer', (column) => column.unsigned().notNull().defaultTo(0))
    .addColumn('next_retry_at', 'datetime(6)', (column) => column.notNull())
    .addColumn('last_error_code', 'varchar(64)')
    .addColumn('delivered_at', 'datetime(6)')
    .addColumn('delivery_fingerprint', 'binary(32)')
    .addColumn('updated_at', 'datetime(6)', (column) => column.notNull())
    .execute();

  await database.schema
    .createIndex('idx_audit_sink_delivery_due')
    .on('audit_sink_deliveries')
    .columns(['delivered_at', 'next_retry_at', 'sequence'])
    .execute();

  await database.schema
    .createTable('audit_verification_runs')
    .addColumn('id', 'bigint', (column) => column.unsigned().autoIncrement().primaryKey())
    .addColumn('public_id', 'binary(16)', (column) => column.notNull().unique())
    .addColumn('high_water_sequence', 'bigint', (column) => column.unsigned().notNull())
    .addColumn('high_water_record_hash', 'binary(32)', (column) => column.notNull())
    .addColumn('verified_count', 'bigint', (column) => column.unsigned().notNull())
    .addColumn('status', 'varchar(8)', (column) => column.notNull())
    .addColumn('first_mismatch_sequence', 'bigint', (column) => column.unsigned())
    .addColumn('first_mismatch_type', 'varchar(64)')
    .addColumn('summary', 'varchar(500)', (column) => column.notNull())
    .addColumn('started_at', 'datetime(6)', (column) => column.notNull())
    .addColumn('completed_at', 'datetime(6)', (column) => column.notNull())
    .addCheckConstraint('chk_audit_verification_status', sql`status in ('PASS', 'FAIL')`)
    .addCheckConstraint(
      'chk_audit_verification_mismatch',
      sql`(status = 'PASS' and first_mismatch_sequence is null and first_mismatch_type is null)
        or status = 'FAIL'`,
    )
    .execute();

  await database.schema
    .createIndex('idx_audit_verification_completed')
    .on('audit_verification_runs')
    .columns(['completed_at', 'id'])
    .execute();
}

async function createSinkTable(
  database: Kysely<DatabaseWithLegacyAuthSecurityEvents>,
): Promise<void> {
  await database.schema
    .createTable('audit_sink_entries')
    .addColumn('delivery_fingerprint', 'binary(32)', (column) => column.primaryKey())
    .addColumn('sequence', 'bigint', (column) => column.unsigned().notNull())
    .addColumn('event_public_id', 'binary(16)', (column) => column.notNull())
    .addColumn('canonical_payload', sql`longtext`, (column) => column.notNull())
    .addColumn('previous_hash', 'binary(32)', (column) => column.notNull())
    .addColumn('record_hash', 'binary(32)', (column) => column.notNull())
    .addColumn('delivered_at', 'datetime(6)', (column) => column.notNull())
    .addCheckConstraint('chk_audit_sink_sequence', sql`sequence > 0`)
    .addCheckConstraint(
      'chk_audit_sink_payload',
      sql`json_valid(canonical_payload) and octet_length(canonical_payload) <= 65536`,
    )
    .execute();

  await database.schema
    .createIndex('idx_audit_sink_sequence')
    .on('audit_sink_entries')
    .column('sequence')
    .execute();
  await database.schema
    .createIndex('idx_audit_sink_event')
    .on('audit_sink_entries')
    .column('event_public_id')
    .execute();
}

async function seedAuditPermissions(
  database: Kysely<DatabaseWithLegacyAuthSecurityEvents>,
): Promise<void> {
  await database
    .insertInto('permissions')
    .values({
      public_id: Buffer.from(parseUuid('019d0000-0000-7002-8000-000000000001')),
      code: 'audit.read_sensitive',
      name: 'Read sensitive audit context',
      is_active: true,
      is_system: true,
      created_at: seededAt,
      updated_at: seededAt,
    })
    .execute();

  const permissions = await database
    .selectFrom('permissions')
    .select(['id', 'code'])
    .where('code', 'in', ['audit.read', 'audit.read_sensitive'])
    .execute();
  const roles = await database
    .selectFrom('roles')
    .select(['id', 'code'])
    .where('code', 'in', ['AUDITOR', 'SUPER_ADMIN', 'SYSTEM_ADMIN'])
    .execute();
  const permissionIds = new Map(permissions.map((permission) => [permission.code, permission.id]));
  const roleIds = new Map(roles.map((role) => [role.code, role.id]));

  const assignment = (roleCode: string, permissionCode: string) => {
    const roleId = roleIds.get(roleCode);
    const permissionId = permissionIds.get(permissionCode);
    if (roleId === undefined || permissionId === undefined) {
      throw new Error(`Audit permission assignment ${roleCode}/${permissionCode} is unavailable.`);
    }
    return {
      role_id: roleId,
      permission_id: permissionId,
      assigned_by_user_id: null,
      created_at: seededAt,
    };
  };

  await database
    .insertInto('role_permissions')
    .values([
      assignment('SYSTEM_ADMIN', 'audit.read'),
      assignment('AUDITOR', 'audit.read_sensitive'),
      assignment('SUPER_ADMIN', 'audit.read_sensitive'),
    ])
    .execute();
}

interface LegacySecurityEventRow {
  readonly id: string;
  readonly public_id: Buffer;
  readonly event_type: string;
  readonly actor_public_id: Buffer | null;
  readonly target_public_id: Buffer | null;
  readonly request_id: string;
  readonly reason_code: string | null;
  readonly metadata: JsonValue | string | null;
  readonly created_at: Date;
}

function parseMetadata(value: JsonValue | string | null): unknown {
  if (value === null) return null;
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function publicId(value: Uint8Array): string {
  if (value.byteLength !== 16) throw new Error('Legacy audit public IDs must contain 16 bytes.');
  return stringifyUuid(value).toLowerCase();
}

function safeMetadata(value: unknown, ancestors = new Set<object>(), depth = 0): JsonValue {
  if (depth > 10) throw new Error('Legacy audit metadata exceeds the maximum depth.');
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || !Number.isFinite(value) || Object.is(value, -0)) {
      throw new Error('Legacy audit metadata contains an unsafe number.');
    }
    return value;
  }
  if (typeof value !== 'object' || value instanceof Date) {
    throw new Error('Legacy audit metadata contains an unsupported value.');
  }
  if (ancestors.has(value)) throw new Error('Legacy audit metadata contains a cycle.');
  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      if (value.length > 100) throw new Error('Legacy audit metadata array is too large.');
      return value.map((item, index) => {
        if (!Object.hasOwn(value, index)) throw new Error('Legacy audit metadata array is sparse.');
        return safeMetadata(item, ancestors, depth + 1);
      });
    }

    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > 100) throw new Error('Legacy audit metadata object is too large.');
    return Object.fromEntries(
      entries.map(([key, item]) => {
        const normalizedKey = key.replaceAll(/[^a-zA-Z0-9]/g, '').toLowerCase();
        if (forbiddenMetadataKeys.has(key) || forbiddenMetadataKeys.has(normalizedKey)) {
          throw new Error('Legacy audit metadata contains an unsafe key.');
        }
        return [key, safeMetadata(item, ancestors, depth + 1)];
      }),
    );
  } finally {
    ancestors.delete(value);
  }
}

function canonicalLegacyEvent(input: {
  readonly publicId: string;
  readonly occurredAt: string;
  readonly actorPublicId: string | null;
  readonly action: string;
  readonly entity: { readonly type: 'user'; readonly publicId: string } | null;
  readonly requestId: string;
  readonly reasonCode: string | null;
  readonly metadata: unknown;
}): { readonly canonicalPayload: string; readonly metadata: JsonValue | null } {
  if (!/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/.test(input.action)) {
    throw new Error('Legacy audit action is invalid.');
  }
  const metadata = input.metadata === null ? null : safeMetadata(input.metadata);
  const event = {
    publicId: input.publicId,
    schemaVersion: 1,
    occurredAt: input.occurredAt,
    actorPublicId: input.actorPublicId,
    action: input.action,
    entity: input.entity,
    requestId: input.requestId,
    ipAddress: null,
    userAgent: null,
    reasonCode: input.reasonCode,
    before: null,
    after: null,
    metadata,
  };
  const canonicalPayload = canonicalize(event);
  if (canonicalPayload === undefined) throw new Error('Legacy audit canonicalization failed.');
  if (Buffer.byteLength(canonicalPayload, 'utf8') > maximumPayloadBytes) {
    throw new Error('Legacy audit canonical payload exceeds 65,536 bytes.');
  }
  return { canonicalPayload, metadata };
}

async function backfillLegacyEvents(
  database: Kysely<DatabaseWithLegacyAuthSecurityEvents>,
  primary: Kysely<DatabaseWithLegacyAuthSecurityEvents>,
): Promise<void> {
  const events = (await database
    .selectFrom('auth_security_events as event')
    .leftJoin('users as actor', 'actor.id', 'event.actor_user_id')
    .leftJoin('users as target', 'target.id', 'event.target_user_id')
    .select([
      'event.id',
      'event.public_id',
      'event.event_type',
      'actor.public_id as actor_public_id',
      'target.public_id as target_public_id',
      'event.request_id',
      'event.reason_code',
      'event.metadata',
      'event.created_at',
    ])
    .orderBy('event.id')
    .execute()) as readonly LegacySecurityEventRow[];

  for (const row of events) {
    const actorPublicId = row.actor_public_id === null ? null : publicId(row.actor_public_id);
    const targetPublicId = row.target_public_id === null ? null : publicId(row.target_public_id);
    const event = canonicalLegacyEvent({
      publicId: publicId(row.public_id),
      occurredAt: row.created_at.toISOString(),
      actorPublicId,
      action: row.event_type,
      entity: targetPublicId === null ? null : { type: 'user', publicId: targetPublicId },
      requestId: row.request_id,
      reasonCode: row.reason_code,
      metadata: parseMetadata(row.metadata),
    });

    await primary
      .insertInto('audit_outbox')
      .values({
        legacy_security_event_id: row.id,
        event_public_id: row.public_id,
        schema_version: 1,
        occurred_at: row.created_at,
        actor_public_id: row.actor_public_id,
        action: row.event_type,
        entity_type: targetPublicId === null ? null : 'user',
        entity_public_id: row.target_public_id,
        request_id: row.request_id,
        reason_code: row.reason_code,
        ip_address: null,
        user_agent: null,
        canonical_payload: event.canonicalPayload,
        captured_at: row.created_at,
      })
      .execute();
  }

  const migrated = await primary
    .selectFrom('audit_outbox')
    .select(['legacy_security_event_id', 'event_public_id'])
    .where('legacy_security_event_id', 'is not', null)
    .execute();
  const sourceIds = events.map((event) => event.public_id.toString('hex')).sort();
  const destinationIds = migrated.map((event) => event.event_public_id.toString('hex')).sort();
  if (events.length !== migrated.length || sourceIds.join(',') !== destinationIds.join(',')) {
    throw new Error('Legacy audit backfill count or public identifiers do not match.');
  }
}

export async function down(database: Kysely<DatabaseWithLegacyAuthSecurityEvents>): Promise<void> {
  await createLegacySecurityEventsTable(database);
  await restoreLegacyEvents(database);
  await removeAuditPermissions(database);

  const primary = database.withSchema(PRIMARY_AUDIT_SCHEMA);
  const sink = database.withSchema(SINK_AUDIT_SCHEMA);
  await sink.schema.dropTable('audit_sink_entries').execute();
  for (const table of [
    'audit_sink_deliveries',
    'audit_verification_runs',
    'audit_chain_heads',
    'audit_chain_entries',
    'audit_outbox',
  ] as const) {
    await primary.schema.dropTable(table).execute();
  }
}

async function createLegacySecurityEventsTable(
  database: Kysely<DatabaseWithLegacyAuthSecurityEvents>,
): Promise<void> {
  await database.schema
    .createTable('auth_security_events')
    .addColumn('id', 'bigint', (column) => column.unsigned().autoIncrement().primaryKey())
    .addColumn('public_id', 'binary(16)', (column) => column.notNull().unique())
    .addColumn('event_type', 'varchar(100)', (column) => column.notNull())
    .addColumn('actor_user_id', 'bigint', (column) =>
      column.unsigned().references('users.id').onDelete('restrict'),
    )
    .addColumn('target_user_id', 'bigint', (column) =>
      column.unsigned().references('users.id').onDelete('restrict'),
    )
    .addColumn('request_id', 'varchar(64)', (column) => column.notNull())
    .addColumn('reason_code', 'varchar(100)')
    .addColumn('metadata', 'json')
    .addColumn('created_at', 'datetime(6)', (column) => column.notNull())
    .execute();
  await database.schema
    .createIndex('idx_auth_security_events_target')
    .on('auth_security_events')
    .columns(['target_user_id', 'created_at'])
    .execute();
}

interface StoredAuditEvent {
  readonly publicId: string;
  readonly occurredAt: string;
  readonly actorPublicId: string | null;
  readonly action: string;
  readonly entity: { readonly type: string; readonly publicId: string } | null;
  readonly requestId: string;
  readonly reasonCode: string | null;
  readonly metadata: JsonValue | null;
}

async function restoreLegacyEvents(
  database: Kysely<DatabaseWithLegacyAuthSecurityEvents>,
): Promise<void> {
  const primary = database.withSchema(PRIMARY_AUDIT_SCHEMA);
  const rows = await primary
    .selectFrom('audit_outbox')
    .select(['legacy_security_event_id', 'event_public_id', 'canonical_payload'])
    .where('legacy_security_event_id', 'is not', null)
    .orderBy('legacy_security_event_id')
    .execute();
  if (rows.length === 0) return;

  const users = await database.selectFrom('users').select(['id', 'public_id']).execute();
  const userIds = new Map(users.map((user) => [publicId(user.public_id), user.id]));

  for (const row of rows) {
    const parsed = JSON.parse(row.canonical_payload) as StoredAuditEvent;
    const recanonicalized = canonicalize(parsed);
    if (
      recanonicalized !== row.canonical_payload ||
      parsed.publicId !== publicId(row.event_public_id)
    ) {
      throw new Error('Stored legacy audit payload cannot be restored safely.');
    }
    safeMetadata(parsed.metadata);
    const actorUserId =
      parsed.actorPublicId === null ? null : (userIds.get(parsed.actorPublicId) ?? null);
    const targetUserId =
      parsed.entity?.type === 'user' ? (userIds.get(parsed.entity.publicId) ?? null) : null;

    await database
      .insertInto('auth_security_events')
      .values({
        id: row.legacy_security_event_id!,
        public_id: row.event_public_id,
        event_type: parsed.action,
        actor_user_id: actorUserId,
        target_user_id: targetUserId,
        request_id: parsed.requestId,
        reason_code: parsed.reasonCode,
        metadata: parsed.metadata === null ? null : JSON.stringify(parsed.metadata),
        created_at: new Date(parsed.occurredAt),
      })
      .execute();
  }
}

async function removeAuditPermissions(
  database: Kysely<DatabaseWithLegacyAuthSecurityEvents>,
): Promise<void> {
  const permissions = await database
    .selectFrom('permissions')
    .select(['id', 'code'])
    .where('code', 'in', ['audit.read', 'audit.read_sensitive'])
    .execute();
  const permissionIds = new Map(permissions.map((permission) => [permission.code, permission.id]));
  const sensitiveId = permissionIds.get('audit.read_sensitive');
  const auditReadId = permissionIds.get('audit.read');

  if (sensitiveId !== undefined) {
    await database
      .deleteFrom('role_permissions')
      .where('permission_id', '=', sensitiveId)
      .execute();
  }

  if (auditReadId !== undefined) {
    const systemAdmin = await database
      .selectFrom('roles')
      .select('id')
      .where('code', '=', 'SYSTEM_ADMIN')
      .executeTakeFirst();
    if (systemAdmin !== undefined) {
      await database
        .deleteFrom('role_permissions')
        .where('role_id', '=', systemAdmin.id)
        .where('permission_id', '=', auditReadId)
        .execute();
    }
  }

  if (sensitiveId !== undefined) {
    await database.deleteFrom('permissions').where('id', '=', sensitiveId).execute();
  }
}
