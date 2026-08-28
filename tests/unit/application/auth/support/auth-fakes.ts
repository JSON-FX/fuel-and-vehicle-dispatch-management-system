import type { AuthRepositories, AuthTransaction } from '@/application/auth/ports/auth-transaction';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';
import { PublicId } from '@/domain/shared/value-objects/public-id';

const unavailableRepository = new Proxy(
  {},
  {
    get: (_target, property) => async () => {
      throw new Error(`Unexpected repository call: ${String(property)}`);
    },
  },
);

export function authRepositories(overrides: Partial<AuthRepositories> = {}): AuthRepositories {
  return {
    users: unavailableRepository,
    roles: unavailableRepository,
    permissions: unavailableRepository,
    sessions: unavailableRepository,
    challenges: unavailableRepository,
    rateLimits: unavailableRepository,
    totpFactors: unavailableRepository,
    passwordResets: unavailableRepository,
    securityEvents: unavailableRepository,
    ...overrides,
  } as AuthRepositories;
}

export class FakeAuthTransaction implements AuthTransaction {
  calls = 0;

  constructor(private readonly repositories: AuthRepositories) {}

  async execute<T>(work: (repositories: AuthRepositories) => Promise<T>): Promise<T> {
    this.calls += 1;
    return work(this.repositories);
  }
}

export class SequencePublicIdGenerator implements PublicIdGenerator {
  private next = 1;

  generate(): PublicId {
    const suffix = this.next.toString().padStart(12, '0');
    this.next += 1;
    return PublicId.from(`01900000-0000-7000-8000-${suffix}`);
  }
}
