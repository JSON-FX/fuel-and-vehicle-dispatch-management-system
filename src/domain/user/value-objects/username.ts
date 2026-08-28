import { DomainError } from '@/domain/shared/errors/domain-error';

export class Username {
  private constructor(private readonly value: string) {}

  static from(value: string): Username {
    const normalized = value.trim().toLowerCase();

    if (!/^[a-z0-9][a-z0-9._-]{1,62}[a-z0-9]$/.test(normalized)) {
      throw new DomainError(
        'INVALID_USERNAME',
        'Username must contain 3 to 64 lowercase letters, numbers, dots, underscores, or hyphens.',
      );
    }

    return new Username(normalized);
  }

  toString(): string {
    return this.value;
  }
}
