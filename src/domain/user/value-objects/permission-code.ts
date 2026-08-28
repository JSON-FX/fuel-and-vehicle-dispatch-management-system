import { DomainError } from '@/domain/shared/errors/domain-error';

export class PermissionCode {
  private constructor(private readonly value: string) {}

  static from(value: string): PermissionCode {
    if (!/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/.test(value)) {
      throw new DomainError(
        'INVALID_PERMISSION_CODE',
        'Permission codes require lowercase dot-separated segments.',
      );
    }

    return new PermissionCode(value);
  }

  toString(): string {
    return this.value;
  }
}
