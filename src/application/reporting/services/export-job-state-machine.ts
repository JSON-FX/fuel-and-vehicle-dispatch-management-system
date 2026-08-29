import type { ExportJobStatus } from '@/application/reporting/dto/export-job-dtos';
import { ConflictError } from '@/application/shared/errors/application-error';

const TRANSITIONS = {
  QUEUED: ['RUNNING'],
  RUNNING: ['QUEUED', 'COMPLETED', 'FAILED'],
  COMPLETED: ['EXPIRED'],
  FAILED: [],
  EXPIRED: [],
} as const satisfies Readonly<Record<ExportJobStatus, readonly ExportJobStatus[]>>;

export class ExportJobStateMachine {
  canTransition(current: ExportJobStatus, next: ExportJobStatus): boolean {
    const allowed: readonly ExportJobStatus[] = TRANSITIONS[current];
    return allowed.includes(next);
  }

  assertTransition(current: ExportJobStatus, next: ExportJobStatus): void {
    if (!this.canTransition(current, next)) {
      throw new ConflictError(`Export job cannot transition from ${current} to ${next}.`);
    }
  }
}
