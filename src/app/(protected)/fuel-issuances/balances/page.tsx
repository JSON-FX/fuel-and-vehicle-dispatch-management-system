import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { ValidationError } from '@/application/shared/errors/application-error';
import { FuelBalanceFilterForm } from '@/components/fuel-issuances/fuel-balance-filter-form';
import { FuelBalanceSummary } from '@/components/fuel-issuances/fuel-balance-summary';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getServerAuthentication } from '@/lib/auth/server-authentication';
import { authorizeFuelPageAccess } from '@/lib/fuel/server-fuel-access';
import { parseFuelBalanceQuery } from '@/lib/fuel/route-schemas';

export const dynamic = 'force-dynamic';

export default async function FuelBalancesPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | readonly string[] | undefined>>;
}) {
  const { composition, session } = await getServerAuthentication();
  const access = await authorizeFuelPageAccess(
    composition,
    session.principal,
    '/fuel-issuances/balances',
  );
  if (access === null)
    return (
      <Message title="Fuel balance access denied" body="Your account cannot view fuel balances." />
    );
  const now = manilaDate(new Date());
  const defaults = { startDate: `${now.slice(0, 8)}01`, endDate: now, fuelType: '' };
  const params = await searchParams;
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (typeof value !== 'string')
      return <Message title="Invalid balance filters" body="Clear the filters and try again." />;
    normalized[key] = value;
  }
  let query;
  try {
    query = parseFuelBalanceQuery({
      startDate: normalized.startDate ?? defaults.startDate,
      endDate: normalized.endDate ?? defaults.endDate,
      fuelType: normalized.fuelType ?? defaults.fuelType,
    });
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    return (
      <Message
        title="Invalid balance filters"
        body="Use a valid inclusive date range and try again."
      />
    );
  }
  const balances = await composition.getFuelBalances.execute({ context: access, query });
  return (
    <div className="space-y-6">
      <Button asChild variant="link">
        <Link href="/fuel-issuances">
          <ArrowLeft aria-hidden="true" /> Back to fuel issuances
        </Link>
      </Button>
      <header>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Fuel balances</h1>
        <p className="mt-2 text-muted-foreground">
          Reconcile opening, receipts, adjustments, issuances, and closing by effective business
          date.
        </p>
      </header>
      <FuelBalanceFilterForm
        startDate={query.startDate}
        endDate={query.endDate}
        fuelType={query.fuelType ?? ''}
      />
      <FuelBalanceSummary balances={balances} />
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
function Message({ title, body }: { readonly title: string; readonly body: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <h1 className="font-heading text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}
