import { z } from 'zod';

const nodeEnvironmentSchema = z.enum(['development', 'test', 'production']).default('development');
const logLevelSchema = z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info');
const positiveIntegerSchema = z.coerce.number().int().positive();
const nonNegativeIntegerSchema = z.coerce.number().int().nonnegative();
const positiveVersionSchema = z.coerce.number().int().positive();
const databaseIdentifierSchema = z
  .string()
  .min(1)
  .regex(
    /^[a-zA-Z0-9_]+$/,
    'Database identifiers may only contain letters, numbers, and underscores.',
  );

const databaseConnectionSchema = z
  .object({
    DATABASE_HOST: z.string().min(1),
    DATABASE_PORT: positiveIntegerSchema.default(3306),
    DATABASE_NAME: databaseIdentifierSchema,
    DATABASE_USER: databaseIdentifierSchema,
    DATABASE_PASSWORD: z.string().min(1),
    DATABASE_POOL_MIN: nonNegativeIntegerSchema.default(1),
    DATABASE_POOL_MAX: positiveIntegerSchema.default(10),
    DATABASE_CONNECT_TIMEOUT_MS: positiveIntegerSchema.default(5_000),
    DATABASE_QUERY_TIMEOUT_MS: positiveIntegerSchema.default(2_000),
  })
  .refine((value) => value.DATABASE_POOL_MAX >= value.DATABASE_POOL_MIN, {
    message: 'DATABASE_POOL_MAX must be greater than or equal to DATABASE_POOL_MIN.',
    path: ['DATABASE_POOL_MAX'],
  });

function base64KeySchema(variableName: string) {
  return z.string().superRefine((value, context) => {
    if (!/^[A-Za-z0-9+/]{43}=$/.test(value) || Buffer.from(value, 'base64').byteLength !== 32) {
      context.addIssue({
        code: 'custom',
        message: `${variableName} must decode to exactly 32 bytes.`,
      });
    }
  });
}

const totpKeyRingSchema = z.string().transform((value, context) => {
  let decoded: unknown;

  try {
    decoded = JSON.parse(value);
  } catch {
    context.addIssue({
      code: 'custom',
      message: 'AUTH_TOTP_ENCRYPTION_KEYS must be a JSON object.',
    });
    return z.NEVER;
  }

  const result = z
    .record(z.string().regex(/^[1-9]\d*$/), base64KeySchema('Each TOTP encryption key'))
    .safeParse(decoded);

  if (!result.success) {
    context.addIssue({
      code: 'custom',
      message: 'AUTH_TOTP_ENCRYPTION_KEYS must contain versioned 32-byte base64 keys.',
    });
    return z.NEVER;
  }

  return result.data;
});

const authenticationEnvironmentSchema = z
  .object({
    AUTH_ALLOWED_ORIGIN: z
      .string()
      .url()
      .refine((value) => new URL(value).origin === value, {
        message: 'AUTH_ALLOWED_ORIGIN must be an exact origin without a path.',
      }),
    AUTH_STANDARD_IDLE_TIMEOUT_SECONDS: positiveIntegerSchema.default(1_800),
    AUTH_PRIVILEGED_IDLE_TIMEOUT_SECONDS: positiveIntegerSchema.default(900),
    AUTH_ABSOLUTE_TIMEOUT_SECONDS: positiveIntegerSchema.default(28_800),
    AUTH_PRIVILEGED_SESSION_LIMIT: positiveIntegerSchema.default(1),
    AUTH_RATE_LIMIT_MAX_FAILURES: positiveIntegerSchema.default(5),
    AUTH_RATE_LIMIT_WINDOW_SECONDS: positiveIntegerSchema.default(900),
    AUTH_RATE_LIMIT_LOCK_SECONDS: positiveIntegerSchema.default(900),
    AUTH_CHALLENGE_TTL_SECONDS: positiveIntegerSchema.default(300),
    AUTH_ACTIVITY_WRITE_INTERVAL_SECONDS: positiveIntegerSchema.default(300),
    AUTH_PASSWORD_MIN_LENGTH: positiveIntegerSchema.default(12),
    AUTH_PASSWORD_MAX_LENGTH: positiveIntegerSchema.default(128),
    AUTH_TOTP_ACTIVE_KEY_VERSION: positiveVersionSchema,
    AUTH_TOTP_ENCRYPTION_KEYS: totpKeyRingSchema,
    AUTH_RATE_LIMIT_HMAC_KEY: base64KeySchema('AUTH_RATE_LIMIT_HMAC_KEY'),
  })
  .superRefine((value, context) => {
    if (!(String(value.AUTH_TOTP_ACTIVE_KEY_VERSION) in value.AUTH_TOTP_ENCRYPTION_KEYS)) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_TOTP_ENCRYPTION_KEYS'],
        message: `AUTH_TOTP_ENCRYPTION_KEYS must contain active key version ${value.AUTH_TOTP_ACTIVE_KEY_VERSION}.`,
      });
    }

    if (value.AUTH_PASSWORD_MAX_LENGTH < value.AUTH_PASSWORD_MIN_LENGTH) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_PASSWORD_MAX_LENGTH'],
        message: 'AUTH_PASSWORD_MAX_LENGTH must be at least AUTH_PASSWORD_MIN_LENGTH.',
      });
    }

    if (
      value.AUTH_ABSOLUTE_TIMEOUT_SECONDS < value.AUTH_STANDARD_IDLE_TIMEOUT_SECONDS ||
      value.AUTH_ABSOLUTE_TIMEOUT_SECONDS < value.AUTH_PRIVILEGED_IDLE_TIMEOUT_SECONDS
    ) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_ABSOLUTE_TIMEOUT_SECONDS'],
        message: 'AUTH_ABSOLUTE_TIMEOUT_SECONDS must cover both idle timeouts.',
      });
    }
  });

const auditPolicySchema = z
  .object({
    AUDIT_DATABASE_NAME: databaseIdentifierSchema.default('fvdms_audit'),
    AUDIT_SINK_DATABASE_NAME: databaseIdentifierSchema.default('fvdms_audit_sink'),
    AUDIT_MAX_CANONICAL_PAYLOAD_BYTES: positiveIntegerSchema.default(65_536),
    AUDIT_CHAIN_BATCH_SIZE: positiveIntegerSchema.default(100),
    AUDIT_SINK_BATCH_SIZE: positiveIntegerSchema.default(100),
    AUDIT_POLL_INTERVAL_MS: positiveIntegerSchema.default(1_000),
    AUDIT_RETRY_BASE_MS: positiveIntegerSchema.default(1_000),
    AUDIT_RETRY_MAX_MS: positiveIntegerSchema.default(60_000),
    AUDIT_VERIFICATION_PAGE_SIZE: positiveIntegerSchema.default(500),
  })
  .superRefine((value, context) => {
    if (value.AUDIT_RETRY_MAX_MS < value.AUDIT_RETRY_BASE_MS) {
      context.addIssue({
        code: 'custom',
        path: ['AUDIT_RETRY_MAX_MS'],
        message: 'AUDIT_RETRY_MAX_MS must be greater than or equal to AUDIT_RETRY_BASE_MS.',
      });
    }
  });

const auditWorkerEnvironmentSchema = databaseConnectionSchema
  .safeExtend({
    AUDIT_WORKER_DATABASE_USER: databaseIdentifierSchema,
    AUDIT_WORKER_DATABASE_PASSWORD: z.string().min(1),
    AUDIT_SINK_HOST: z.string().min(1),
    AUDIT_SINK_PORT: positiveIntegerSchema.default(3306),
    AUDIT_SINK_DATABASE_USER: databaseIdentifierSchema,
    AUDIT_SINK_DATABASE_PASSWORD: z.string().min(1),
  })
  .and(auditPolicySchema);

const auditVerifierEnvironmentSchema = databaseConnectionSchema
  .safeExtend({
    AUDIT_VERIFIER_DATABASE_USER: databaseIdentifierSchema,
    AUDIT_VERIFIER_DATABASE_PASSWORD: z.string().min(1),
    AUDIT_SINK_HOST: z.string().min(1),
    AUDIT_SINK_PORT: positiveIntegerSchema.default(3306),
  })
  .and(auditPolicySchema);

const migrationConnectionSchema = databaseConnectionSchema.safeExtend({
  MIGRATION_DATABASE_USER: databaseIdentifierSchema,
  MIGRATION_DATABASE_PASSWORD: z.string().min(1),
});

const bootstrapEnvironmentSchema = z.object({
  MYSQL_ADMIN_HOST: z.string().min(1),
  MYSQL_ADMIN_PORT: positiveIntegerSchema.default(3306),
  MYSQL_ADMIN_USER: databaseIdentifierSchema,
  MYSQL_ADMIN_PASSWORD: z.string(),
  DATABASE_NAME: databaseIdentifierSchema,
  DATABASE_USER: databaseIdentifierSchema,
  DATABASE_PASSWORD: z.string().min(1),
  MIGRATION_DATABASE_USER: databaseIdentifierSchema,
  MIGRATION_DATABASE_PASSWORD: z.string().min(1),
  AUDIT_DATABASE_NAME: databaseIdentifierSchema.default('fvdms_audit'),
  AUDIT_SINK_DATABASE_NAME: databaseIdentifierSchema.default('fvdms_audit_sink'),
  AUDIT_WORKER_DATABASE_USER: databaseIdentifierSchema,
  AUDIT_WORKER_DATABASE_PASSWORD: z.string().min(1),
  AUDIT_SINK_DATABASE_USER: databaseIdentifierSchema,
  AUDIT_SINK_DATABASE_PASSWORD: z.string().min(1),
  AUDIT_VERIFIER_DATABASE_USER: databaseIdentifierSchema,
  AUDIT_VERIFIER_DATABASE_PASSWORD: z.string().min(1),
});

export type NodeEnvironment = z.infer<typeof nodeEnvironmentSchema>;
export type LogLevel = z.infer<typeof logLevelSchema>;

export interface DatabaseEnvironment {
  readonly host: string;
  readonly port: number;
  readonly name: string;
  readonly user: string;
  readonly password: string;
  readonly poolMin: number;
  readonly poolMax: number;
  readonly connectTimeoutMs: number;
  readonly queryTimeoutMs: number;
}

export interface DatabaseRuntimeEnvironment {
  readonly nodeEnv: NodeEnvironment;
  readonly logLevel: LogLevel;
  readonly database: DatabaseEnvironment;
}

export interface RuntimeEnvironment extends DatabaseRuntimeEnvironment {
  readonly auth: AuthenticationEnvironment;
  readonly audit: AuditPolicyEnvironment;
}

export interface AuditPolicyEnvironment {
  readonly primarySchema: string;
  readonly sinkSchema: string;
  readonly maxCanonicalPayloadBytes: number;
  readonly chainBatchSize: number;
  readonly sinkBatchSize: number;
  readonly pollIntervalMs: number;
  readonly retryBaseMs: number;
  readonly retryMaxMs: number;
  readonly verificationPageSize: number;
}

export interface AuditProcessEnvironment {
  readonly nodeEnv: NodeEnvironment;
  readonly logLevel: LogLevel;
  readonly primaryDatabase: DatabaseEnvironment;
  readonly sinkDatabase: DatabaseEnvironment;
  readonly policy: AuditPolicyEnvironment;
}

export interface AuthenticationEnvironment {
  readonly allowedOrigin: string;
  readonly standardIdleTimeoutSeconds: number;
  readonly privilegedIdleTimeoutSeconds: number;
  readonly absoluteTimeoutSeconds: number;
  readonly privilegedSessionLimit: number;
  readonly rateLimitMaxFailures: number;
  readonly rateLimitWindowSeconds: number;
  readonly rateLimitLockSeconds: number;
  readonly challengeTtlSeconds: number;
  readonly activityWriteIntervalSeconds: number;
  readonly passwordMinLength: number;
  readonly passwordMaxLength: number;
  readonly totpActiveKeyVersion: number;
  readonly totpEncryptionKeys: Readonly<Record<string, string>>;
  readonly rateLimitHmacKey: string;
}

export interface BootstrapEnvironment {
  readonly administrator: {
    readonly host: string;
    readonly port: number;
    readonly user: string;
    readonly password: string;
  };
  readonly database: { readonly name: string };
  readonly application: { readonly user: string; readonly password: string };
  readonly migration: { readonly user: string; readonly password: string };
  readonly audit: {
    readonly primarySchema: string;
    readonly sinkSchema: string;
    readonly worker: { readonly user: string; readonly password: string };
    readonly sinkWriter: { readonly user: string; readonly password: string };
    readonly verifier: { readonly user: string; readonly password: string };
  };
}

export interface BuildEnvironment {
  readonly nodeEnv: NodeEnvironment;
  readonly logLevel: LogLevel;
}

function rejectPublicSecrets(environment: Record<string, string | undefined>): void {
  const exposedSecret = Object.entries(environment).find(
    ([key, value]) =>
      value !== undefined &&
      key.startsWith('NEXT_PUBLIC_') &&
      /(PASSWORD|SECRET|TOKEN|AUTHORIZATION|DATABASE|CSRF|TOTP|HMAC|ENCRYPTION|KEY)/i.test(key),
  );

  if (exposedSecret) {
    throw new Error(`${exposedSecret[0]} must not expose server-only configuration.`);
  }
}

function parseCommonEnvironment(environment: Record<string, string | undefined>): BuildEnvironment {
  return {
    nodeEnv: nodeEnvironmentSchema.parse(environment.NODE_ENV),
    logLevel: logLevelSchema.parse(environment.LOG_LEVEL),
  };
}

function mapDatabaseEnvironment(
  parsed: z.infer<typeof databaseConnectionSchema>,
  credentials: { user: string; password: string },
): DatabaseEnvironment {
  return {
    host: parsed.DATABASE_HOST,
    port: parsed.DATABASE_PORT,
    name: parsed.DATABASE_NAME,
    user: credentials.user,
    password: credentials.password,
    poolMin: parsed.DATABASE_POOL_MIN,
    poolMax: parsed.DATABASE_POOL_MAX,
    connectTimeoutMs: parsed.DATABASE_CONNECT_TIMEOUT_MS,
    queryTimeoutMs: parsed.DATABASE_QUERY_TIMEOUT_MS,
  };
}

function mapAuditPolicy(parsed: z.infer<typeof auditPolicySchema>): AuditPolicyEnvironment {
  return {
    primarySchema: parsed.AUDIT_DATABASE_NAME,
    sinkSchema: parsed.AUDIT_SINK_DATABASE_NAME,
    maxCanonicalPayloadBytes: parsed.AUDIT_MAX_CANONICAL_PAYLOAD_BYTES,
    chainBatchSize: parsed.AUDIT_CHAIN_BATCH_SIZE,
    sinkBatchSize: parsed.AUDIT_SINK_BATCH_SIZE,
    pollIntervalMs: parsed.AUDIT_POLL_INTERVAL_MS,
    retryBaseMs: parsed.AUDIT_RETRY_BASE_MS,
    retryMaxMs: parsed.AUDIT_RETRY_MAX_MS,
    verificationPageSize: parsed.AUDIT_VERIFICATION_PAGE_SIZE,
  };
}

function mapAuditDatabaseEnvironment(
  parsed: z.infer<typeof databaseConnectionSchema>,
  input: {
    readonly host: string;
    readonly port: number;
    readonly name: string;
    readonly user: string;
    readonly password: string;
  },
): DatabaseEnvironment {
  return {
    ...mapDatabaseEnvironment(parsed, input),
    host: input.host,
    port: input.port,
    name: input.name,
  };
}

function assertSeparatedSinkIdentity(input: {
  readonly nodeEnv: NodeEnvironment;
  readonly applicationUser: string;
  readonly sinkWriterUser: string;
}): void {
  if (input.nodeEnv !== 'test' && input.applicationUser === input.sinkWriterUser) {
    throw new Error('AUDIT_SINK_DATABASE_USER must differ from DATABASE_USER outside tests.');
  }
}

export function parseRuntimeEnvironment(
  environment: Record<string, string | undefined>,
): RuntimeEnvironment {
  rejectPublicSecrets(environment);
  const parsed = databaseConnectionSchema.parse(environment);
  const auth = authenticationEnvironmentSchema.parse(environment);
  const audit = auditPolicySchema.parse(environment);

  return {
    ...parseCommonEnvironment(environment),
    database: mapDatabaseEnvironment(parsed, {
      user: parsed.DATABASE_USER,
      password: parsed.DATABASE_PASSWORD,
    }),
    auth: {
      allowedOrigin: auth.AUTH_ALLOWED_ORIGIN,
      standardIdleTimeoutSeconds: auth.AUTH_STANDARD_IDLE_TIMEOUT_SECONDS,
      privilegedIdleTimeoutSeconds: auth.AUTH_PRIVILEGED_IDLE_TIMEOUT_SECONDS,
      absoluteTimeoutSeconds: auth.AUTH_ABSOLUTE_TIMEOUT_SECONDS,
      privilegedSessionLimit: auth.AUTH_PRIVILEGED_SESSION_LIMIT,
      rateLimitMaxFailures: auth.AUTH_RATE_LIMIT_MAX_FAILURES,
      rateLimitWindowSeconds: auth.AUTH_RATE_LIMIT_WINDOW_SECONDS,
      rateLimitLockSeconds: auth.AUTH_RATE_LIMIT_LOCK_SECONDS,
      challengeTtlSeconds: auth.AUTH_CHALLENGE_TTL_SECONDS,
      activityWriteIntervalSeconds: auth.AUTH_ACTIVITY_WRITE_INTERVAL_SECONDS,
      passwordMinLength: auth.AUTH_PASSWORD_MIN_LENGTH,
      passwordMaxLength: auth.AUTH_PASSWORD_MAX_LENGTH,
      totpActiveKeyVersion: auth.AUTH_TOTP_ACTIVE_KEY_VERSION,
      totpEncryptionKeys: auth.AUTH_TOTP_ENCRYPTION_KEYS,
      rateLimitHmacKey: auth.AUTH_RATE_LIMIT_HMAC_KEY,
    },
    audit: mapAuditPolicy(audit),
  };
}

export function parseAuditWorkerEnvironment(
  environment: Record<string, string | undefined>,
): AuditProcessEnvironment {
  rejectPublicSecrets(environment);
  const common = parseCommonEnvironment(environment);
  const parsed = auditWorkerEnvironmentSchema.parse(environment);
  assertSeparatedSinkIdentity({
    nodeEnv: common.nodeEnv,
    applicationUser: parsed.DATABASE_USER,
    sinkWriterUser: parsed.AUDIT_SINK_DATABASE_USER,
  });

  return {
    ...common,
    primaryDatabase: mapAuditDatabaseEnvironment(parsed, {
      host: parsed.DATABASE_HOST,
      port: parsed.DATABASE_PORT,
      name: parsed.AUDIT_DATABASE_NAME,
      user: parsed.AUDIT_WORKER_DATABASE_USER,
      password: parsed.AUDIT_WORKER_DATABASE_PASSWORD,
    }),
    sinkDatabase: mapAuditDatabaseEnvironment(parsed, {
      host: parsed.AUDIT_SINK_HOST,
      port: parsed.AUDIT_SINK_PORT,
      name: parsed.AUDIT_SINK_DATABASE_NAME,
      user: parsed.AUDIT_SINK_DATABASE_USER,
      password: parsed.AUDIT_SINK_DATABASE_PASSWORD,
    }),
    policy: mapAuditPolicy(parsed),
  };
}

export function parseAuditVerifierEnvironment(
  environment: Record<string, string | undefined>,
): AuditProcessEnvironment {
  rejectPublicSecrets(environment);
  const common = parseCommonEnvironment(environment);
  const parsed = auditVerifierEnvironmentSchema.parse(environment);

  return {
    ...common,
    primaryDatabase: mapAuditDatabaseEnvironment(parsed, {
      host: parsed.DATABASE_HOST,
      port: parsed.DATABASE_PORT,
      name: parsed.AUDIT_DATABASE_NAME,
      user: parsed.AUDIT_VERIFIER_DATABASE_USER,
      password: parsed.AUDIT_VERIFIER_DATABASE_PASSWORD,
    }),
    sinkDatabase: mapAuditDatabaseEnvironment(parsed, {
      host: parsed.AUDIT_SINK_HOST,
      port: parsed.AUDIT_SINK_PORT,
      name: parsed.AUDIT_SINK_DATABASE_NAME,
      user: parsed.AUDIT_VERIFIER_DATABASE_USER,
      password: parsed.AUDIT_VERIFIER_DATABASE_PASSWORD,
    }),
    policy: mapAuditPolicy(parsed),
  };
}

export function parseMigrationEnvironment(
  environment: Record<string, string | undefined>,
): DatabaseRuntimeEnvironment {
  rejectPublicSecrets(environment);
  const parsed = migrationConnectionSchema.parse(environment);

  return {
    ...parseCommonEnvironment(environment),
    database: mapDatabaseEnvironment(parsed, {
      user: parsed.MIGRATION_DATABASE_USER,
      password: parsed.MIGRATION_DATABASE_PASSWORD,
    }),
  };
}

export function parseBootstrapEnvironment(
  environment: Record<string, string | undefined>,
): BootstrapEnvironment {
  rejectPublicSecrets(environment);
  const parsed = bootstrapEnvironmentSchema.parse(environment);

  return {
    administrator: {
      host: parsed.MYSQL_ADMIN_HOST,
      port: parsed.MYSQL_ADMIN_PORT,
      user: parsed.MYSQL_ADMIN_USER,
      password: parsed.MYSQL_ADMIN_PASSWORD,
    },
    database: { name: parsed.DATABASE_NAME },
    application: { user: parsed.DATABASE_USER, password: parsed.DATABASE_PASSWORD },
    migration: {
      user: parsed.MIGRATION_DATABASE_USER,
      password: parsed.MIGRATION_DATABASE_PASSWORD,
    },
    audit: {
      primarySchema: parsed.AUDIT_DATABASE_NAME,
      sinkSchema: parsed.AUDIT_SINK_DATABASE_NAME,
      worker: {
        user: parsed.AUDIT_WORKER_DATABASE_USER,
        password: parsed.AUDIT_WORKER_DATABASE_PASSWORD,
      },
      sinkWriter: {
        user: parsed.AUDIT_SINK_DATABASE_USER,
        password: parsed.AUDIT_SINK_DATABASE_PASSWORD,
      },
      verifier: {
        user: parsed.AUDIT_VERIFIER_DATABASE_USER,
        password: parsed.AUDIT_VERIFIER_DATABASE_PASSWORD,
      },
    },
  };
}

export function parseBuildEnvironment(
  environment: Record<string, string | undefined>,
): BuildEnvironment {
  rejectPublicSecrets(environment);
  return parseCommonEnvironment(environment);
}
