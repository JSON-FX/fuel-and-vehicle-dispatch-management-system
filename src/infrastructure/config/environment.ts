import { z } from 'zod';

const nodeEnvironmentSchema = z.enum(['development', 'test', 'production']).default('development');
const logLevelSchema = z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info');
const positiveIntegerSchema = z.coerce.number().int().positive();
const nonNegativeIntegerSchema = z.coerce.number().int().nonnegative();
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

export interface RuntimeEnvironment {
  readonly nodeEnv: NodeEnvironment;
  readonly logLevel: LogLevel;
  readonly database: DatabaseEnvironment;
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
      /(PASSWORD|SECRET|TOKEN|AUTHORIZATION|DATABASE)/i.test(key),
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

export function parseRuntimeEnvironment(
  environment: Record<string, string | undefined>,
): RuntimeEnvironment {
  rejectPublicSecrets(environment);
  const parsed = databaseConnectionSchema.parse(environment);

  return {
    ...parseCommonEnvironment(environment),
    database: mapDatabaseEnvironment(parsed, {
      user: parsed.DATABASE_USER,
      password: parsed.DATABASE_PASSWORD,
    }),
  };
}

export function parseMigrationEnvironment(
  environment: Record<string, string | undefined>,
): RuntimeEnvironment {
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
  };
}

export function parseBuildEnvironment(
  environment: Record<string, string | undefined>,
): BuildEnvironment {
  rejectPublicSecrets(environment);
  return parseCommonEnvironment(environment);
}
