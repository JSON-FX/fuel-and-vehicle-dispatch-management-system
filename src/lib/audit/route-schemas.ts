import { z } from 'zod';

const optionalText = (maximumLength: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim().length === 0 ? undefined : value),
    z.string().trim().min(1).max(maximumLength).optional(),
  );

export const auditSearchQuerySchema = z
  .object({
    from: optionalText(40),
    to: optionalText(40),
    action: optionalText(96),
    entityType: optionalText(64),
    entityPublicId: optionalText(36),
    actorPublicId: optionalText(36),
    requestId: optionalText(128),
    cursor: optionalText(2_048),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
