import { Filter } from 'lucide-react';
import Link from 'next/link';

import type { DispatchFilterOptionsDto } from '@/application/dispatch/dto/dispatch-dtos';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import type { SchedulePageValues } from '@/lib/dispatch/schedule-page-query';

export function DispatchScheduleFilterForm({
  values,
  options,
}: {
  readonly values: SchedulePageValues;
  readonly options: DispatchFilterOptionsDto;
}) {
  return (
    <Card aria-labelledby="schedule-filter-heading">
      <CardContent className="pt-6">
        <form action="/dispatches/schedule" method="get" className="space-y-4">
          <input type="hidden" name="view" value={values.view} />
          <input type="hidden" name="date" value={values.date} />
          <h2 id="schedule-filter-heading" className="font-heading text-lg font-semibold">
            Filter schedule
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field id="schedule-office" label="Requesting office">
              <NativeSelect
                id="schedule-office"
                name="requestingOfficePublicId"
                defaultValue={values.requestingOfficePublicId}
              >
                <option value="">All offices</option>
                {options.offices.map((office) => (
                  <option key={office.publicId} value={office.publicId}>
                    {office.abbreviation} · {office.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="schedule-driver" label="Driver">
              <NativeSelect
                id="schedule-driver"
                name="driverPublicId"
                defaultValue={values.driverPublicId}
              >
                <option value="">All drivers</option>
                {options.drivers.map((driver) => (
                  <option key={driver.publicId} value={driver.publicId}>
                    {driver.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="schedule-vehicle" label="Vehicle">
              <NativeSelect
                id="schedule-vehicle"
                name="vehiclePublicId"
                defaultValue={values.vehiclePublicId}
              >
                <option value="">All vehicles</option>
                {options.vehicles.map((vehicle) => (
                  <option key={vehicle.publicId} value={vehicle.publicId}>
                    {vehicle.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="schedule-status" label="Status">
              <NativeSelect id="schedule-status" name="status" defaultValue={values.status}>
                <option value="">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="DISPATCHED">Dispatched</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </NativeSelect>
            </Field>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit">
              <Filter aria-hidden="true" /> Apply filters
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href={`/dispatches/schedule?view=${values.view}&date=${values.date}`}>
                Clear filters
              </Link>
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
      <label className="block text-sm font-semibold" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}
