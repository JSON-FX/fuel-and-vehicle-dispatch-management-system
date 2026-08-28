import { createApplicationComposition } from '@/infrastructure/composition/root';
import { assertSecureJsonMutation, parseJsonBody } from '@/lib/auth/route-helpers';
import {
  authenticateDispatchRequest,
  dispatchRequestContext,
} from '@/lib/dispatch/server-dispatch-access';
import { updateDispatchScheduleSettingsSchema } from '@/lib/dispatch/route-schemas';
import { withResponseHandler } from '@/lib/http/with-response-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateDispatchRequest(
      currentRequest,
      composition,
      'settings',
      requestId,
      '/api/dispatch-schedule-settings',
    );
    return composition.getDispatchScheduleSettings.execute({
      context: dispatchRequestContext(currentRequest, authenticated.principal, requestId),
    });
  })(request);
}

export async function PATCH(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateDispatchRequest(
      currentRequest,
      composition,
      'settings',
      requestId,
      '/api/dispatch-schedule-settings',
    );
    assertSecureJsonMutation({
      request: currentRequest,
      allowedOrigin: composition.authAllowedOrigin,
      csrfTokenHash: authenticated.csrfTokenHash,
      tokenGenerator: composition.secureTokenGenerator,
    });
    return composition.updateDispatchScheduleSettings.execute({
      context: dispatchRequestContext(currentRequest, authenticated.principal, requestId),
      command: updateDispatchScheduleSettingsSchema.parse(await parseJsonBody(currentRequest)),
    });
  })(request);
}
