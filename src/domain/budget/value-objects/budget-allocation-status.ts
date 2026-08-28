import { DomainError } from '@/domain/shared/errors/domain-error';

export type BudgetAllocationStatusValue = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'CANCELLED';

export class BudgetAllocationStatus {
  private constructor(private readonly value: BudgetAllocationStatusValue) {}

  static from(value: string): BudgetAllocationStatus {
    if (value !== 'DRAFT' && value !== 'ACTIVE' && value !== 'CLOSED' && value !== 'CANCELLED') {
      throw new DomainError(
        'INVALID_BUDGET_ALLOCATION_STATUS',
        'Budget allocation status is invalid.',
      );
    }

    return new BudgetAllocationStatus(value);
  }

  static draft(): BudgetAllocationStatus {
    return new BudgetAllocationStatus('DRAFT');
  }

  isDraft(): boolean {
    return this.value === 'DRAFT';
  }

  isActive(): boolean {
    return this.value === 'ACTIVE';
  }

  activate(): BudgetAllocationStatus {
    if (this.value === 'CLOSED') this.throwTerminal('Closed');
    if (this.value === 'CANCELLED') this.throwTerminal('Cancelled');
    if (this.value !== 'DRAFT') {
      throw new DomainError(
        'BUDGET_ALLOCATION_NOT_DRAFT',
        'Only draft budget allocations can be activated.',
      );
    }

    return new BudgetAllocationStatus('ACTIVE');
  }

  close(): BudgetAllocationStatus {
    if (this.value === 'CLOSED') this.throwTerminal('Closed');
    if (this.value === 'CANCELLED') this.throwTerminal('Cancelled');
    if (this.value !== 'ACTIVE') {
      throw new DomainError(
        'BUDGET_ALLOCATION_NOT_ACTIVE',
        'Only active budget allocations can be closed.',
      );
    }

    return new BudgetAllocationStatus('CLOSED');
  }

  cancel(): BudgetAllocationStatus {
    if (this.value === 'CLOSED') this.throwTerminal('Closed');
    if (this.value === 'CANCELLED') this.throwTerminal('Cancelled');
    return new BudgetAllocationStatus('CANCELLED');
  }

  restored(): BudgetAllocationStatus {
    return this.value === 'ACTIVE' ? BudgetAllocationStatus.draft() : this;
  }

  toString(): BudgetAllocationStatusValue {
    return this.value;
  }

  private throwTerminal(label: 'Closed' | 'Cancelled'): never {
    throw new DomainError(
      'BUDGET_ALLOCATION_TERMINAL',
      `${label} budget allocations are terminal.`,
    );
  }
}
