import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { createApplicationComposition } from '@/infrastructure/composition/root';
import { AUTH_SESSION_COOKIE } from '@/lib/auth/cookies';

export async function getServerAuthentication() {
  const cookieStore = await cookies();
  const bearerToken = cookieStore.get(AUTH_SESSION_COOKIE)?.value;
  if (bearerToken === undefined) redirect('/login');

  const composition = createApplicationComposition();
  try {
    const session = await composition.authenticateSession.execute(bearerToken);
    return { composition, session, bearerToken };
  } catch {
    redirect('/login');
  }
}

export function hasPermission(permissions: readonly string[], permission: string): boolean {
  return permissions.includes(permission);
}
