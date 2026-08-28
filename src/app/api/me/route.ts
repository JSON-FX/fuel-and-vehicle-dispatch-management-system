import { AuthenticationError } from '@/application/shared/errors/application-error';
import { createApplicationComposition } from '@/infrastructure/composition/root';
import { AUTH_SESSION_COOKIE, readAuthCookie } from '@/lib/auth/cookies';
import { withResponseHandler } from '@/lib/http/with-response-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest }) => {
    const token = readAuthCookie(currentRequest, AUTH_SESSION_COOKIE);
    if (token === null) throw new AuthenticationError();
    return composition.getCurrentPrincipal.execute(token);
  })(request);
}
