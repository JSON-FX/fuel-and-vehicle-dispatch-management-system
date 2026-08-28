import type { DispatchStatusValue } from '@/domain/dispatch/value-objects/dispatch-status';

export function reservesDispatchDay(status: DispatchStatusValue): boolean {
  return status === 'DRAFT' || status === 'DISPATCHED' || status === 'COMPLETED';
}
