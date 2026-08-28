import { headers } from 'next/headers';

import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { FuelRequestContext } from '@/application/fuel/dto/fuel-dtos';
import { AuthorizationError } from '@/application/shared/errors/application-error';
import type { ApplicationComposition } from '@/infrastructure/composition/root';
import { authenticateRequest, auditHeadersContext } from '@/lib/auth/authenticated-request';
import { resolveRequestId } from '@/lib/http/request-id';

export type FuelAccess = 'create' | 'read' | 'post' | 'void';
type FuelAccessComposition = Pick<
  ApplicationComposition,
  | 'authenticateSession'
  | 'authorizePermission'
  | 'recordAuthorizationDenial'
  | 'fuelPermissions'
  | 'publicIdGenerator'
>;

export async function authenticateFuelRequest(
  request: Request,
  composition: FuelAccessComposition,
  access: FuelAccess,
  requestId: string,
  routeTemplate: string,
) {
  const authentication = await authenticateRequest(request, composition);
  try {
    assertAccess(composition, authentication.principal, access);
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
    const context = auditHeadersContext(request.headers);
    await composition.recordAuthorizationDenial.execute({
      principal: authentication.principal,
      permission: `fuel.${access}`,
      requestId,
      routeTemplate,
      sourceAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    throw error;
  }
  return authentication;
}

export function fuelRequestContext(
  request: Request,
  principal: CurrentPrincipal,
  requestId: string,
): FuelRequestContext {
  return { principal, requestId, ...auditHeadersContext(request.headers) };
}

export async function authorizeFuelPageAccess(
  composition: FuelAccessComposition,
  principal: CurrentPrincipal,
  routeTemplate: string,
): Promise<FuelRequestContext | null> {
  const requestHeaders = await headers();
  const requestId = resolveRequestId(
    requestHeaders.get('x-request-id'),
    composition.publicIdGenerator,
  );
  const context = auditHeadersContext(requestHeaders);
  try {
    composition.fuelPermissions.assertCanRead(principal);
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
    await composition.recordAuthorizationDenial.execute({
      principal,
      permission: 'fuel.read',
      requestId,
      routeTemplate,
      sourceAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return null;
  }
  return { principal, requestId, ...context };
}

function assertAccess(
  composition: FuelAccessComposition,
  principal: CurrentPrincipal,
  access: FuelAccess,
): void {
  if (access === 'create') composition.fuelPermissions.assertCanCreate(principal);
  else if (access === 'read') composition.fuelPermissions.assertCanRead(principal);
  else if (access === 'post') composition.fuelPermissions.assertCanPost(principal);
  else composition.fuelPermissions.assertCanVoid(principal);
}
