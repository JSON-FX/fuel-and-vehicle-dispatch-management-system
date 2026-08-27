import { sql, type Kysely } from 'kysely';

import type { HealthCheckRepository } from '@/application/health/ports/health-check-repository';
import { ExternalDependencyError } from '@/application/shared/errors/application-error';
import type { Database } from '@/infrastructure/database/types';

export class KyselyHealthCheckRepository implements HealthCheckRepository {
  constructor(
    private readonly database: Kysely<Database>,
    private readonly timeoutMs: number,
  ) {}

  async check(): Promise<void> {
    let timeout: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        sql`select 1`.execute(this.database),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error('The database health check timed out.')),
            this.timeoutMs,
          );
          timeout.unref();
        }),
      ]);
    } catch (cause) {
      throw new ExternalDependencyError(cause);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
}
