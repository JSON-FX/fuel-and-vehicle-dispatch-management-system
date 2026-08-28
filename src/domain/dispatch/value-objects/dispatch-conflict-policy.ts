import { DomainError } from '@/domain/shared/errors/domain-error';

export const DISPATCH_CONFLICT_POLICIES = ['BLOCK', 'WARN_AND_ACK'] as const;
export type DispatchConflictPolicyValue = (typeof DISPATCH_CONFLICT_POLICIES)[number];

export class DispatchConflictPolicy {
  private constructor(private readonly value: DispatchConflictPolicyValue) {}

  static from(value: unknown): DispatchConflictPolicy {
    if (!DISPATCH_CONFLICT_POLICIES.includes(value as DispatchConflictPolicyValue)) {
      throw new DomainError(
        'INVALID_DISPATCH_CONFLICT_POLICY',
        'Dispatch conflict policy must be BLOCK or WARN_AND_ACK.',
      );
    }

    return new DispatchConflictPolicy(value as DispatchConflictPolicyValue);
  }

  static block(): DispatchConflictPolicy {
    return new DispatchConflictPolicy('BLOCK');
  }

  static warnAndAcknowledge(): DispatchConflictPolicy {
    return new DispatchConflictPolicy('WARN_AND_ACK');
  }

  isBlock(): boolean {
    return this.value === 'BLOCK';
  }

  isWarnAndAcknowledge(): boolean {
    return this.value === 'WARN_AND_ACK';
  }

  toString(): DispatchConflictPolicyValue {
    return this.value;
  }
}
