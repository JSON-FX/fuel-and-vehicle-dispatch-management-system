import { describe, expect, it, vi } from 'vitest';

import type { HealthCheckRepository } from '@/application/health/ports/health-check-repository';
import { GetHealthStatus } from '@/application/health/use-cases/get-health-status';
import { ExternalDependencyError } from '@/application/shared/errors/application-error';

describe('GetHealthStatus', () => {
  it('reports readiness after the database responds', async () => {
    const repository: HealthCheckRepository = { check: vi.fn().mockResolvedValue(undefined) };
    const useCase = new GetHealthStatus(repository, () => new Date('2026-08-28T00:00:00.000Z'));

    await expect(useCase.execute()).resolves.toEqual({
      status: 'ok',
      database: 'available',
      timestamp: '2026-08-28T00:00:00.000Z',
    });
    expect(repository.check).toHaveBeenCalledOnce();
  });

  it('preserves a typed dependency failure', async () => {
    const failure = new ExternalDependencyError(new Error('private driver message'));
    const repository: HealthCheckRepository = { check: vi.fn().mockRejectedValue(failure) };
    const useCase = new GetHealthStatus(repository);

    await expect(useCase.execute()).rejects.toBe(failure);
  });
});
