import { headers } from 'next/headers';

import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { DispatchRequestContext } from '@/application/dispatch/dto/dispatch-dtos';
import { AuthorizationError } from '@/application/shared/errors/application-error';
import type { ApplicationComposition } from '@/infrastructure/composition/root';
import { authenticateRequest, auditHeadersContext } from '@/lib/auth/authenticated-request';
import { resolveRequestId } from '@/lib/http/request-id';

export type DispatchAccess =
  'create' | 'read' | 'update' | 'complete' | 'cancel' | 'override' | 'settings';
type DispatchAccessComposition = Pick<
  ApplicationComposition,
  | 'authenticateSession'
  | 'authorizePermission'
  | 'recordAuthorizationDenial'
  | 'dispatchPermissions'
  | 'publicIdGenerator'
>;

export async function authenticateDispatchRequest(
  request: Request,
  composition: DispatchAccessComposition,
  access: DispatchAccess,
  requestId: string,
  routeTemplate: string,
) {
  const authentication = await authenticateRequest(request, composition);
  await authorizeDispatchRequestAccess(
    request,
    composition,
    authentication.principal,
    access,
    requestId,
    routeTemplate,
  );
  return authentication;
}

export async function authorizeDispatchRequestAccess(
  request: Request,
  composition: DispatchAccessComposition,
  principal: CurrentPrincipal,
  access: DispatchAccess,
  requestId: string,
  routeTemplate: string,
): Promise<void> {
  try {
    assertAccess(composition, principal, access);
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
    const context = auditHeadersContext(request.headers);
    await composition.recordAuthorizationDenial.execute({
      principal,
      permission: permissionForAccess(access),
      requestId,
      routeTemplate,
      sourceAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    throw error;
  }
}

export function dispatchRequestContext(
  request: Request,
  principal: CurrentPrincipal,
  requestId: string,
): DispatchRequestContext {
  return { principal, requestId, ...auditHeadersContext(request.headers) };
}

export async function authorizeDispatchPageAccess(
  composition: DispatchAccessComposition,
  principal: CurrentPrincipal,
  routeTemplate: string,
): Promise<DispatchRequestContext | null> {
  const requestHeaders = await headers();
  const requestId = resolveRequestId(
    requestHeaders.get('x-request-id'),
    composition.publicIdGenerator,
  );
  const context = auditHeadersContext(requestHeaders);
  try {
    composition.dispatchPermissions.assertCanRead(principal);
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
    await composition.recordAuthorizationDenial.execute({
      principal,
      permission: 'dispatch.read',
      requestId,
      routeTemplate,
      sourceAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return null;
  }
  return { principal, requestId, ...context };
}

export async function authorizeDispatchSettingsPageAccess(
  composition: DispatchAccessComposition,
  principal: CurrentPrincipal,
  routeTemplate: string,
): Promise<DispatchRequestContext | null> {
  const requestHeaders = await headers();
  const requestId = resolveRequestId(
    requestHeaders.get('x-request-id'),
    composition.publicIdGenerator,
  );
  const context = auditHeadersContext(requestHeaders);
  try {
    composition.dispatchPermissions.assertCanManageSettings(principal);
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
    await composition.recordAuthorizationDenial.execute({
      principal,
      permission: 'dispatch.settings.manage',
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
  composition: DispatchAccessComposition,
  principal: CurrentPrincipal,
  access: DispatchAccess,
): void {
  if (access === 'create') composition.dispatchPermissions.assertCanCreate(principal);
  else if (access === 'read') composition.dispatchPermissions.assertCanRead(principal);
  else if (access === 'update') composition.dispatchPermissions.assertCanUpdate(principal);
  else if (access === 'complete') composition.dispatchPermissions.assertCanComplete(principal);
  else if (access === 'cancel') composition.dispatchPermissions.assertCanCancel(principal);
  else if (access === 'override')
    composition.dispatchPermissions.assertCanOverrideConflict(principal);
  else composition.dispatchPermissions.assertCanManageSettings(principal);
}

function permissionForAccess(access: DispatchAccess): string {
  if (access === 'override') return 'dispatch.conflict.override';
  if (access === 'settings') return 'dispatch.settings.manage';
  return `dispatch.${access}`;
}
