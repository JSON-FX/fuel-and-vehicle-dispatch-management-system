import { GetHealthStatus } from '@/application/health/use-cases/get-health-status';
import type { Logger } from '@/application/shared/ports/logger';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';
import { parseRuntimeEnvironment } from '@/infrastructure/config/environment';
import { getRuntimeDatabase } from '@/infrastructure/database/client';
import { KyselyHealthCheckRepository } from '@/infrastructure/database/health/kysely-health-check-repository';
import { UuidV7Generator } from '@/infrastructure/identifiers/uuid-v7-generator';
import { createPinoLogger } from '@/infrastructure/logging/pino-logger';

export interface ApplicationComposition {
  readonly getHealthStatus: GetHealthStatus;
  readonly logger: Logger;
  readonly publicIdGenerator: PublicIdGenerator;
}

export function createApplicationComposition(
  environment: Record<string, string | undefined> = process.env,
): ApplicationComposition {
  const configuration = parseRuntimeEnvironment(environment);
  const database = getRuntimeDatabase(environment);

  return Object.freeze({
    getHealthStatus: new GetHealthStatus(
      new KyselyHealthCheckRepository(database, configuration.database.queryTimeoutMs),
    ),
    logger: createPinoLogger({ level: configuration.logLevel }),
    publicIdGenerator: new UuidV7Generator(),
  });
}
