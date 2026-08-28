import 'server-only';

import { headers } from 'next/headers';

import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import { AuthorizationError } from '@/application/shared/errors/application-error';
import type { ApplicationComposition } from '@/infrastructure/composition/root';
import { auditHeadersContext } from '@/lib/auth/authenticated-request';
import { resolveRequestId } from '@/lib/http/request-id';

export interface ServerAuditAccessContext {
  readonly requestId: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export async function authorizeAuditPageAccess(
  composition: Pick<
    ApplicationComposition,
    'authorizePermission' | 'publicIdGenerator' | 'recordAuthorizationDenial'
  >,
  principal: CurrentPrincipal,
  routeTemplate: string,
): Promise<ServerAuditAccessContext | null> {
  const requestHeaders = await headers();
  const context = auditHeadersContext(requestHeaders);
  const requestId = resolveRequestId(
    requestHeaders.get('x-request-id'),
    composition.publicIdGenerator,
  );

  try {
    composition.authorizePermission.execute(principal, 'audit.read');
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
    await composition.recordAuthorizationDenial.execute({
      principal,
      permission: 'audit.read',
      requestId,
      routeTemplate,
      sourceAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return null;
  }

  return { requestId, ...context };
}
