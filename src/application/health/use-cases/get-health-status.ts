import type { HealthStatusResponse } from '@/application/health/dto/health-status-response';
import type { HealthCheckRepository } from '@/application/health/ports/health-check-repository';

export class GetHealthStatus {
  constructor(
    private readonly repository: HealthCheckRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<HealthStatusResponse> {
    await this.repository.check();

    return {
      status: 'ok',
      database: 'available',
      timestamp: this.now().toISOString(),
    };
  }
}
