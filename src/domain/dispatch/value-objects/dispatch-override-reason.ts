import { DomainError } from '@/domain/shared/errors/domain-error';

const MIN_REASON_LENGTH = 10;
const MAX_REASON_LENGTH = 500;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

export class DispatchOverrideReason {
  private constructor(private readonly value: string) {}

  static from(value: unknown): DispatchOverrideReason {
    if (typeof value !== 'string' || CONTROL_CHARACTER_PATTERN.test(value)) {
      throw DispatchOverrideReason.invalid();
    }

    const normalized = value.trim().replace(/\s+/g, ' ');
    if (normalized.length < MIN_REASON_LENGTH || normalized.length > MAX_REASON_LENGTH) {
      throw DispatchOverrideReason.invalid();
    }

    return new DispatchOverrideReason(normalized);
  }

  toString(): string {
    return this.value;
  }

  private static invalid(): DomainError {
    return new DomainError(
      'INVALID_DISPATCH_OVERRIDE_REASON',
      'Conflict acknowledgment reason must contain between 10 and 500 characters.',
    );
  }
}
