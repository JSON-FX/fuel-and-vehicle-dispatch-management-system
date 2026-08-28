import { headers } from 'next/headers';

import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { BudgetRequestContext } from '@/application/budget/dto/budget-allocation-dtos';
import { AuthorizationError } from '@/application/shared/errors/application-error';
import type { ApplicationComposition } from '@/infrastructure/composition/root';
import { authenticateRequest, auditHeadersContext } from '@/lib/auth/authenticated-request';
import { resolveRequestId } from '@/lib/http/request-id';

type BudgetAccessComposition = Pick<
  ApplicationComposition,
  | 'authenticateSession'
  | 'authorizePermission'
  | 'recordAuthorizationDenial'
  | 'budgetPermissions'
  | 'publicIdGenerator'
>;

export async function authenticateBudgetRequest(
  request: Request,
  composition: BudgetAccessComposition,
  access: 'read' | 'manage',
  requestId: string,
  routeTemplate: string,
) {
  const authentication = await authenticateRequest(request, composition);
  try {
    if (access === 'manage') {
      composition.budgetPermissions.assertCanManage(authentication.principal);
    } else {
      composition.budgetPermissions.assertCanRead(authentication.principal);
    }
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
    const context = auditHeadersContext(request.headers);
    await composition.recordAuthorizationDenial.execute({
      principal: authentication.principal,
      permission: `budget.${access}`,
      requestId,
      routeTemplate,
      sourceAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    throw error;
  }
  return authentication;
}

export function budgetRequestContext(
  request: Request,
  principal: CurrentPrincipal,
  requestId: string,
): BudgetRequestContext {
  return { principal, requestId, ...auditHeadersContext(request.headers) };
}

export async function authorizeBudgetPageAccess(
  composition: BudgetAccessComposition,
  principal: CurrentPrincipal,
  routeTemplate: string,
): Promise<BudgetRequestContext | null> {
  const requestHeaders = await headers();
  const requestId = resolveRequestId(
    requestHeaders.get('x-request-id'),
    composition.publicIdGenerator,
  );
  const context = auditHeadersContext(requestHeaders);
  try {
    composition.budgetPermissions.assertCanRead(principal);
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
    await composition.recordAuthorizationDenial.execute({
      principal,
      permission: 'budget.read',
      requestId,
      routeTemplate,
      sourceAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return null;
  }
  return { principal, requestId, ...context };
}
