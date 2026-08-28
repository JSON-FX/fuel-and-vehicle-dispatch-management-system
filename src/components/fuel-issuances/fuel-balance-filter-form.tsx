import { Calculator } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';

export function FuelBalanceFilterForm({
  startDate,
  endDate,
  fuelType,
}: {
  readonly startDate: string;
  readonly endDate: string;
  readonly fuelType: string;
}) {
  return (
    <Card aria-labelledby="balance-filter-heading">
      <CardContent className="pt-6">
        <form action="/fuel-issuances/balances" method="get" className="space-y-4">
          <h2 id="balance-filter-heading" className="font-heading text-lg font-semibold">
            Balance period
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="balance-start" label="Start date">
              <Input
                id="balance-start"
                name="startDate"
                type="date"
                required
                defaultValue={startDate}
              />
            </Field>
            <Field id="balance-end" label="End date">
              <Input id="balance-end" name="endDate" type="date" required defaultValue={endDate} />
            </Field>
            <Field id="balance-fuel-type" label="Fuel type">
              <NativeSelect id="balance-fuel-type" name="fuelType" defaultValue={fuelType}>
                <option value="">Diesel and Gasoline</option>
                <option value="DIESEL">Diesel</option>
                <option value="GASOLINE">Gasoline</option>
              </NativeSelect>
            </Field>
          </div>
          <Button type="submit">
            <Calculator aria-hidden="true" /> Calculate balances
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
function Field({
  id,
  label,
  children,
}: {
  readonly id: string;
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}
