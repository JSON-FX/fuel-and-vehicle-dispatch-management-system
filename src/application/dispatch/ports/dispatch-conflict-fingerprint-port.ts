import type { DispatchConflictFingerprintInputDto } from '@/application/dispatch/dto/dispatch-dtos';

export interface DispatchConflictFingerprintPort {
  create(input: DispatchConflictFingerprintInputDto): string;
}
