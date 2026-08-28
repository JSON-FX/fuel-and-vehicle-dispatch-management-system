import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { FuelIssuanceDraftForm } from '@/components/fuel-issuances/fuel-issuance-draft-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getServerAuthentication } from '@/lib/auth/server-authentication';
import { authorizeFuelPageAccess } from '@/lib/fuel/server-fuel-access';

export const dynamic = 'force-dynamic';

export default async function NewFuelIssuancePage() {
  const { composition, session, bearerToken } = await getServerAuthentication();
  const access = await authorizeFuelPageAccess(
    composition,
    session.principal,
    '/fuel-issuances/new',
  );
  if (access === null || !composition.fuelPermissions.canCreate(session.principal))
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <h1 className="font-heading text-2xl font-semibold">Draft preparation denied</h1>
          <p className="mt-2 text-muted-foreground">Your account cannot create fuel issuances.</p>
        </CardContent>
      </Card>
    );
  const entryDate = manilaDate(new Date());
  const [current, options] = await Promise.all([
    composition.getCurrentPrincipal.execute(bearerToken),
    composition.getFuelPreparationOptions.execute({ context: access, entryDate }),
  ]);
  return (
    <div className="space-y-6">
      <Button asChild variant="link">
        <Link href="/fuel-issuances">
          <ArrowLeft aria-hidden="true" /> Back to fuel issuances
        </Link>
      </Button>
      <header>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">New fuel issuance</h1>
        <p className="mt-2 text-muted-foreground">
          Save a complete operational draft. RIS and total remain pending until posting.
        </p>
      </header>
      <FuelIssuanceDraftForm csrfToken={current.csrfToken} options={options} />
    </div>
  );
}
function manilaDate(value: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}
