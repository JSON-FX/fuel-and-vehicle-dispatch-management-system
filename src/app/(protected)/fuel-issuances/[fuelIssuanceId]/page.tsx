import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { NotFoundError } from '@/application/shared/errors/application-error';
import { FuelIssuanceDetail } from '@/components/fuel-issuances/fuel-issuance-detail';
import { FuelIssuanceDraftForm } from '@/components/fuel-issuances/fuel-issuance-draft-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getServerAuthentication } from '@/lib/auth/server-authentication';
import { authorizeFuelPageAccess } from '@/lib/fuel/server-fuel-access';
import { fuelPublicIdSchema } from '@/lib/fuel/route-schemas';

export const dynamic = 'force-dynamic';

export default async function FuelIssuanceDetailPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly fuelIssuanceId: string }>;
  readonly searchParams: Promise<{ readonly edit?: string | readonly string[] }>;
}) {
  const { composition, session, bearerToken } = await getServerAuthentication();
  const access = await authorizeFuelPageAccess(
    composition,
    session.principal,
    '/fuel-issuances/:fuelIssuanceId',
  );
  if (access === null) return <Denied />;
  const parsedId = fuelPublicIdSchema.safeParse((await params).fuelIssuanceId);
  if (!parsedId.success) notFound();
  const issuance = await composition.getFuelIssuance
    .execute({ context: access, publicId: parsedId.data })
    .catch((error: unknown) => {
      if (error instanceof NotFoundError) return null;
      throw error;
    });
  if (issuance === null) notFound();
  const canCreate = composition.fuelPermissions.canCreate(session.principal);
  const canPost = composition.fuelPermissions.canPost(session.principal);
  const canVoid = composition.fuelPermissions.canVoid(session.principal);
  const wantsEdit = (await searchParams).edit === '1';
  const needsCsrf =
    (issuance.status === 'DRAFT' && (canCreate || canPost)) ||
    (issuance.status === 'POSTED' && canVoid);
  const current = needsCsrf ? await composition.getCurrentPrincipal.execute(bearerToken) : null;
  if (wantsEdit && issuance.status === 'DRAFT' && canCreate && current !== null) {
    const options = await composition.getFuelPreparationOptions.execute({
      context: access,
      entryDate: issuance.entryDate,
    });
    return (
      <div className="space-y-6">
        <Button asChild variant="link">
          <Link href={`/fuel-issuances/${issuance.publicId}`}>
            <ArrowLeft aria-hidden="true" /> Back to issuance detail
          </Link>
        </Button>
        <header>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Edit fuel issuance draft
          </h1>
          <p className="mt-2 text-muted-foreground">
            RIS and authoritative total remain pending until posting.
          </p>
        </header>
        <FuelIssuanceDraftForm
          csrfToken={current.csrfToken}
          options={options}
          issuance={issuance}
        />
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <Button asChild variant="link">
        <Link href="/fuel-issuances">
          <ArrowLeft aria-hidden="true" /> Back to fuel issuances
        </Link>
      </Button>
      <FuelIssuanceDetail
        issuance={issuance}
        csrfToken={current?.csrfToken ?? null}
        canCreate={canCreate}
        canPost={canPost}
        canVoid={canVoid}
      />
    </div>
  );
}

function Denied() {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <h1 className="font-heading text-2xl font-semibold">Fuel issuance detail access denied</h1>
        <p className="mt-2 text-muted-foreground">Your account cannot view this fuel issuance.</p>
      </CardContent>
    </Card>
  );
}
