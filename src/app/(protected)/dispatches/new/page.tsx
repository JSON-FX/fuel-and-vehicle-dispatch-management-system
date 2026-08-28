import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { DispatchDraftForm } from '@/components/dispatches/dispatch-draft-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getServerAuthentication } from '@/lib/auth/server-authentication';
import { authorizeDispatchPageAccess } from '@/lib/dispatch/server-dispatch-access';

export const dynamic = 'force-dynamic';

export default async function NewDispatchPage() {
  const { composition, session, bearerToken } = await getServerAuthentication();
  const access = await authorizeDispatchPageAccess(
    composition,
    session.principal,
    '/dispatches/new',
  );
  if (access === null || !composition.dispatchPermissions.canCreate(session.principal)) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <h1 className="font-heading text-2xl font-semibold">Dispatch preparation denied</h1>
          <p className="mt-2 text-muted-foreground">
            Your account cannot create vehicle dispatches.
          </p>
        </CardContent>
      </Card>
    );
  }

  const [current, options] = await Promise.all([
    composition.getCurrentPrincipal.execute(bearerToken),
    composition.getDispatchPreparationOptions.execute({ context: access }),
  ]);
  return (
    <div className="space-y-6">
      <Button asChild variant="link">
        <Link href="/dispatches">
          <ArrowLeft aria-hidden="true" /> Back to vehicle dispatches
        </Link>
      </Button>
      <header>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">New dispatch</h1>
        <p className="mt-2 text-muted-foreground">
          Save an operational draft, then dispatch it after every assignment is confirmed.
        </p>
      </header>
      <DispatchDraftForm csrfToken={current.csrfToken} options={options} />
    </div>
  );
}
