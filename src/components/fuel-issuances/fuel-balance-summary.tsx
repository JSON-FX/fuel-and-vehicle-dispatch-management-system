import { AlertTriangle, Fuel } from 'lucide-react';

import type { FuelBalanceDto } from '@/application/fuel/dto/fuel-dtos';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function FuelBalanceSummary({ balances }: { readonly balances: readonly FuelBalanceDto[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {balances.map((balance) => (
        <Card key={balance.fuelType}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Fuel className="size-5 text-accent" aria-hidden="true" />
              <CardTitle>{balance.fuelType === 'DIESEL' ? 'Diesel' : 'Gasoline'}</CardTitle>
            </div>
            <CardDescription>
              {balance.startDate} through {balance.endDate}, inclusive
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Amount label="Opening" value={balance.opening} />
              <Amount label="Receipts" value={balance.receipts} positive />
              <Amount label="Adjustments" value={balance.adjustments} signed />
              <Amount label="Issuances" value={balance.issuances} negative />
              <Amount label="Net movement" value={balance.netMovement} signed />
              <Amount label="Closing" value={balance.closing} strong />
            </dl>
            {balance.closing.startsWith('-') ? (
              <p
                className="flex items-center gap-2 rounded-md border border-warning p-3 text-sm"
                role="status"
              >
                <AlertTriangle className="size-4 text-warning" aria-hidden="true" /> Negative
                closing balance requires review.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
function Amount({
  label,
  value,
  positive = false,
  negative = false,
  signed = false,
  strong = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly positive?: boolean;
  readonly negative?: boolean;
  readonly signed?: boolean;
  readonly strong?: boolean;
}) {
  const display =
    positive && !value.startsWith('-') && value !== '0.000'
      ? `+${value}`
      : negative && value !== '0.000'
        ? `−${value}`
        : signed && !value.startsWith('-') && value !== '0.000'
          ? `+${value}`
          : value;
  return (
    <div className={strong ? 'border-t pt-3' : undefined}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`${strong ? 'font-bold' : 'font-semibold'} text-right font-mono tabular-nums`}>
        {display} L
      </dd>
    </div>
  );
}
