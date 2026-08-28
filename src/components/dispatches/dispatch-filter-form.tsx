import { Search } from 'lucide-react';
import Link from 'next/link';

import type { OfficeOperationalOptionDto } from '@/application/office/dto/office-dtos';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import type { DispatchFilterValues } from '@/lib/dispatch/page-query';

export function DispatchFilterForm({
  values,
  offices,
}: {
  readonly values: DispatchFilterValues;
  readonly offices: readonly OfficeOperationalOptionDto[];
}) {
  return (
    <Card aria-labelledby="dispatch-filter-heading">
      <CardContent className="pt-6">
        <form action="/dispatches" method="get" className="space-y-4">
          <h2 id="dispatch-filter-heading" className="font-heading text-lg font-semibold">
            Filter vehicle dispatches
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Field id="dispatch-query" label="Destination, purpose, driver, vehicle, or office">
              <Input id="dispatch-query" name="query" defaultValue={values.query} maxLength={150} />
            </Field>
            <Field id="dispatch-filter-status" label="Status">
              <NativeSelect id="dispatch-filter-status" name="status" defaultValue={values.status}>
                <option value="">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="DISPATCHED">Dispatched</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </NativeSelect>
            </Field>
            <Field id="dispatch-filter-office" label="Requesting office">
              <NativeSelect
                id="dispatch-filter-office"
                name="requestingOfficePublicId"
                defaultValue={values.requestingOfficePublicId}
              >
                <option value="">All offices</option>
                {offices.map((office) => (
                  <option key={office.publicId} value={office.publicId}>
                    {office.abbreviation} · {office.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="dispatch-travel-from" label="Travel date from">
              <Input
                id="dispatch-travel-from"
                name="travelDateFrom"
                type="date"
                defaultValue={values.travelDateFrom}
              />
            </Field>
            <Field id="dispatch-travel-to" label="Travel date to">
              <Input
                id="dispatch-travel-to"
                name="travelDateTo"
                type="date"
                defaultValue={values.travelDateTo}
              />
            </Field>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit">
              <Search aria-hidden="true" /> Apply filters
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href="/dispatches">Clear filters</Link>
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
