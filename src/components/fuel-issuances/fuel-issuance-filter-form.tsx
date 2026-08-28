import { Search } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import type { FuelFilterValues } from '@/lib/fuel/page-query';

export function FuelIssuanceFilterForm({ values }: { readonly values: FuelFilterValues }) {
  return (
    <Card aria-labelledby="fuel-filter-heading">
      <CardContent className="pt-6">
        <form action="/fuel-issuances" method="get" className="space-y-4">
          <h2 id="fuel-filter-heading" className="font-heading text-lg font-semibold">
            Filter fuel issuances
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Field id="fuel-query" label="RIS, request, driver, or plate">
              <Input id="fuel-query" name="query" defaultValue={values.query} maxLength={150} />
            </Field>
            <Field id="fuel-status" label="Status">
              <NativeSelect id="fuel-status" name="status" defaultValue={values.status}>
                <option value="">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="POSTED">Posted</option>
                <option value="VOIDED">Voided</option>
              </NativeSelect>
            </Field>
            <Field id="fuel-type" label="Fuel type">
              <NativeSelect id="fuel-type" name="fuelType" defaultValue={values.fuelType}>
                <option value="">All fuel types</option>
                <option value="DIESEL">Diesel</option>
                <option value="GASOLINE">Gasoline</option>
              </NativeSelect>
            </Field>
            <Field id="fuel-start-date" label="Entry date from">
              <Input
                id="fuel-start-date"
                name="startDate"
                type="date"
                defaultValue={values.startDate}
              />
            </Field>
            <Field id="fuel-end-date" label="Entry date to">
              <Input id="fuel-end-date" name="endDate" type="date" defaultValue={values.endDate} />
            </Field>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit">
              <Search aria-hidden="true" /> Apply filters
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href="/fuel-issuances">Clear filters</Link>
            </Button>
          </div>
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
