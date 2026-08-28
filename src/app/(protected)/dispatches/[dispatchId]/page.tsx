import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { NotFoundError } from '@/application/shared/errors/application-error';
import { DispatchDetail } from '@/components/dispatches/dispatch-detail';
import { DispatchDraftForm } from '@/components/dispatches/dispatch-draft-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getServerAuthentication } from '@/lib/auth/server-authentication';
import { dispatchPublicIdSchema } from '@/lib/dispatch/route-schemas';
import { authorizeDispatchPageAccess } from '@/lib/dispatch/server-dispatch-access';

export const dynamic = 'force-dynamic';

export default async function DispatchDetailPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly dispatchId: string }>;
  readonly searchParams: Promise<{ readonly edit?: string | readonly string[] }>;
}) {
  const { composition, session, bearerToken } = await getServerAuthentication();
  const access = await authorizeDispatchPageAccess(
    composition,
    session.principal,
    '/dispatches/:dispatchId',
  );
  if (access === null) return <Denied />;

  const parsedId = dispatchPublicIdSchema.safeParse((await params).dispatchId);
  if (!parsedId.success) notFound();
  const dispatch = await composition.getDispatch
    .execute({ context: access, publicId: parsedId.data })
    .catch((error: unknown) => {
      if (error instanceof NotFoundError) return null;
      throw error;
    });
  if (dispatch === null) notFound();

  const canUpdate = composition.dispatchPermissions.canUpdate(session.principal);
  const canComplete = composition.dispatchPermissions.canComplete(session.principal);
  const canCancel = composition.dispatchPermissions.canCancel(session.principal);
  const wantsEdit = (await searchParams).edit === '1';
  const needsCsrf = wantsEdit && dispatch.status === 'DRAFT' && canUpdate;
  const current = needsCsrf ? await composition.getCurrentPrincipal.execute(bearerToken) : null;

  if (wantsEdit && dispatch.status === 'DRAFT' && canUpdate && current !== null) {
    const options = await composition.getDispatchPreparationOptions.execute({
      context: access,
      access: 'update',
    });
    return (
      <div className="space-y-6">
        <Button asChild variant="link">
          <Link href={`/dispatches/${dispatch.publicId}`}>
            <ArrowLeft aria-hidden="true" /> Back to dispatch detail
          </Link>
        </Button>
        <header>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Edit dispatch draft
          </h1>
          <p className="mt-2 text-muted-foreground">
            The references will be checked again when this vehicle is dispatched.
          </p>
        </header>
        <DispatchDraftForm csrfToken={current.csrfToken} options={options} dispatch={dispatch} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="link">
        <Link href="/dispatches">
          <ArrowLeft aria-hidden="true" /> Back to vehicle dispatches
        </Link>
      </Button>
      <DispatchDetail
        dispatch={dispatch}
        canUpdate={canUpdate}
        canComplete={canComplete}
        canCancel={canCancel}
      />
    </div>
  );
}

function Denied() {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <h1 className="font-heading text-2xl font-semibold">Dispatch detail access denied</h1>
        <p className="mt-2 text-muted-foreground">Your account cannot view this dispatch.</p>
      </CardContent>
    </Card>
  );
}
