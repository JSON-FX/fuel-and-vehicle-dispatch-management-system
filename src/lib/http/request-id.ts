import { validate as validateUuid } from 'uuid';

import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';

const maximumRequestIdLength = 128;

export function resolveRequestId(
  incomingRequestId: string | null,
  generator: PublicIdGenerator,
): string {
  const candidate = incomingRequestId?.trim().toLowerCase();

  if (candidate && candidate.length <= maximumRequestIdLength && validateUuid(candidate)) {
    return candidate;
  }

  return generator.generate().toString();
}
