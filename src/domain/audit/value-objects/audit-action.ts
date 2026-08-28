import { DomainError } from '@/domain/shared/errors/domain-error';

const MAX_ACTION_LENGTH = 96;
const ACTION_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/;

export class AuditAction {
  private constructor(private readonly value: string) {}

  static from(value: string): AuditAction {
    const normalized = value.trim().toLowerCase();

    if (normalized.length > MAX_ACTION_LENGTH || !ACTION_PATTERN.test(normalized)) {
      throw new DomainError(
        'INVALID_AUDIT_ACTION',
        'Audit actions require bounded lowercase dot-separated segments.',
      );
    }

    return new AuditAction(normalized);
  }

  toString(): string {
    return this.value;
  }
}
