import { headers } from 'next/headers';

import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type {
  MasterDataMode,
  MasterDataRequestContext,
  MasterDataResource,
} from '@/application/master-data/dto/master-data-list-dtos';
import { AuthorizationError } from '@/application/shared/errors/application-error';
import type { ApplicationComposition } from '@/infrastructure/composition/root';
import { authenticateRequest, auditHeadersContext } from '@/lib/auth/authenticated-request';
import { resolveRequestId } from '@/lib/http/request-id';

type AccessComposition = Pick<
  ApplicationComposition,
  | 'authenticateSession'
  | 'authorizePermission'
  | 'recordAuthorizationDenial'
  | 'masterDataPermissions'
  | 'publicIdGenerator'
>;

export async function authenticateMasterDataRequest(
  request: Request,
  composition: AccessComposition,
  resource: MasterDataResource,
  mode: MasterDataMode,
  requestId: string,
  routeTemplate: string,
) {
  const authentication = await authenticateRequest(request, composition);
  const permission = `${resource}.${mode === 'admin' ? 'manage' : 'read'}`;
  try {
    if (mode === 'admin') {
      composition.masterDataPermissions.assertCanManage(authentication.principal, resource);
    } else {
      composition.masterDataPermissions.assertCanRead(authentication.principal, resource);
    }
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
    const context = auditHeadersContext(request.headers);
    await composition.recordAuthorizationDenial.execute({
      principal: authentication.principal,
      permission,
      requestId,
      routeTemplate,
      sourceAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    throw error;
  }
  return authentication;
}

export function masterDataRequestContext(
  request: Request,
  principal: CurrentPrincipal,
  requestId: string,
): MasterDataRequestContext {
  return { principal, requestId, ...auditHeadersContext(request.headers) };
}

export async function authorizeMasterDataPageAccess(
  composition: AccessComposition,
  principal: CurrentPrincipal,
  resource: MasterDataResource,
  routeTemplate: string,
): Promise<MasterDataRequestContext | null> {
  const requestHeaders = await headers();
  const requestId = resolveRequestId(
    requestHeaders.get('x-request-id'),
    composition.publicIdGenerator,
  );
  const context = auditHeadersContext(requestHeaders);
  try {
    composition.masterDataPermissions.assertCanManage(principal, resource);
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
    await composition.recordAuthorizationDenial.execute({
      principal,
      permission: `${resource}.manage`,
      requestId,
      routeTemplate,
      sourceAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return null;
  }
  return { principal, requestId, ...context };
}
