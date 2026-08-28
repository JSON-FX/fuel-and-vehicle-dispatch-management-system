'use client';

import { Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import type {
  DispatchDetailDto,
  DispatchPreparationOptionsDto,
} from '@/application/dispatch/dto/dispatch-dtos';
import { FormStatus } from '@/components/forms/form-status';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { OdometerReading } from '@/domain/dispatch/value-objects/odometer-reading';
import { DispatchApiError, readDispatchApiResponse } from '@/lib/dispatch/dispatch-form-response';
import { createDispatchSchema } from '@/lib/dispatch/route-schemas';

type Values = {
  entryDate: string;
  travelDate: string;
  driverPublicId: string;
  vehiclePublicId: string;
  requestingOfficePublicId: string;
  destination: string;
  purpose: string;
  odoBefore: string;
  passengerCount: string;
};

export function DispatchDraftForm({
  csrfToken,
  options,
  dispatch,
}: {
  readonly csrfToken: string;
  readonly options: DispatchPreparationOptionsDto;
  readonly dispatch?: DispatchDetailDto;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(() => initialValues(options, dispatch));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestError(null);
    setFieldErrors({});
    const parsed = createDispatchSchema.safeParse({
      ...values,
      passengerCount: /^\d+$/.test(values.passengerCount)
        ? Number(values.passengerCount)
        : values.passengerCount,
    });
    if (!parsed.success) {
      const errors = Object.fromEntries(
        parsed.error.issues.map((issue) => [String(issue.path[0] ?? 'form'), issue.message]),
      );
      setFieldErrors(errors);
      setRequestError('Review the highlighted fields and try again.');
      focusDispatchField(Object.keys(errors)[0]);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(
        dispatch === undefined ? '/api/dispatches' : `/api/dispatches/${dispatch.publicId}`,
        {
          method: dispatch === undefined ? 'POST' : 'PATCH',
          headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
          body: JSON.stringify(parsed.data),
        },
      );
      const saved = await readDispatchApiResponse<DispatchDetailDto>(response);
      if (dispatch === undefined) router.push(`/dispatches/${saved.publicId}`);
      else router.replace(`/dispatches/${saved.publicId}`);
    } catch (error) {
      if (error instanceof DispatchApiError) {
        setFieldErrors({ ...error.fieldErrors });
        focusDispatchField(Object.keys(error.fieldErrors)[0]);
      }
      setRequestError(error instanceof Error ? error.message : 'The dispatch could not be saved.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-6" noValidate onSubmit={submit}>
      <FormStatus message={requestError} />
      <Section
        title="Dispatch information"
        description="Record when the request was entered and when travel is expected."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="dispatch-entry-date" label="Entry date" error={fieldErrors.entryDate}>
            <Input
              id="dispatch-entry-date"
              type="date"
              value={values.entryDate}
              onChange={(event) => set('entryDate', event.target.value)}
              aria-invalid={fieldErrors.entryDate !== undefined}
              aria-describedby="dispatch-entry-date-error"
            />
          </Field>
          <Field id="dispatch-travel-date" label="Travel date" error={fieldErrors.travelDate}>
            <Input
              id="dispatch-travel-date"
              type="date"
              value={values.travelDate}
              onChange={(event) => set('travelDate', event.target.value)}
              aria-invalid={fieldErrors.travelDate !== undefined}
              aria-describedby="dispatch-travel-date-error"
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Vehicle and driver"
        description="Only current operational drivers and serviceable vehicles are available."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="dispatch-driver" label="Driver" error={fieldErrors.driverPublicId}>
            <NativeSelect
              id="dispatch-driver"
              value={values.driverPublicId}
              onChange={(event) => set('driverPublicId', event.target.value)}
              aria-invalid={fieldErrors.driverPublicId !== undefined}
              aria-describedby="dispatch-driver-error"
            >
              <option value="">Select a driver</option>
              {options.drivers.map((driver) => (
                <option key={driver.publicId} value={driver.publicId}>
                  {driver.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="dispatch-vehicle" label="Vehicle" error={fieldErrors.vehiclePublicId}>
            <NativeSelect
              id="dispatch-vehicle"
              value={values.vehiclePublicId}
              onChange={(event) => set('vehiclePublicId', event.target.value)}
              aria-invalid={fieldErrors.vehiclePublicId !== undefined}
              aria-describedby="dispatch-vehicle-error"
            >
              <option value="">Select a vehicle</option>
              {options.vehicles.map((vehicle) => (
                <option key={vehicle.publicId} value={vehicle.publicId}>
                  {vehicle.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </Section>

      <Section
        title="Travel details"
        description="Describe the requesting office, destination, and operational purpose."
      >
        <Field
          id="dispatch-requesting-office"
          label="Requesting office"
          error={fieldErrors.requestingOfficePublicId}
        >
          <NativeSelect
            id="dispatch-requesting-office"
            value={values.requestingOfficePublicId}
            onChange={(event) => set('requestingOfficePublicId', event.target.value)}
            aria-invalid={fieldErrors.requestingOfficePublicId !== undefined}
            aria-describedby="dispatch-requesting-office-error"
          >
            <option value="">Select an office</option>
            {options.offices.map((office) => (
              <option key={office.publicId} value={office.publicId}>
                {office.abbreviation} · {office.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="dispatch-destination" label="Destination" error={fieldErrors.destination}>
            <Input
              id="dispatch-destination"
              value={values.destination}
              onChange={(event) => set('destination', event.target.value)}
              maxLength={255}
              aria-invalid={fieldErrors.destination !== undefined}
              aria-describedby="dispatch-destination-error"
            />
          </Field>
          <Field id="dispatch-purpose" label="Purpose" error={fieldErrors.purpose}>
            <Textarea
              id="dispatch-purpose"
              value={values.purpose}
              onChange={(event) => set('purpose', event.target.value)}
              maxLength={500}
              aria-invalid={fieldErrors.purpose !== undefined}
              aria-describedby="dispatch-purpose-error"
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Odometer and passengers"
        description="Use the exact initial reading. Record the total passenger count, excluding the driver."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="dispatch-odo-before"
            label="Initial odometer (km)"
            error={fieldErrors.odoBefore}
          >
            <Input
              id="dispatch-odo-before"
              inputMode="decimal"
              value={values.odoBefore}
              onChange={(event) => set('odoBefore', event.target.value)}
              aria-invalid={fieldErrors.odoBefore !== undefined}
              aria-describedby="dispatch-odo-before-error"
            />
          </Field>
          <Field
            id="dispatch-passenger-count"
            label="Passenger count"
            error={fieldErrors.passengerCount}
          >
            <Input
              id="dispatch-passenger-count"
              inputMode="numeric"
              value={values.passengerCount}
              onChange={(event) => set('passengerCount', event.target.value)}
              aria-invalid={fieldErrors.passengerCount !== undefined}
              aria-describedby="dispatch-passenger-count-error"
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Review"
        description="Saving keeps this record in DRAFT. Dispatch it only after every assignment is confirmed."
      >
        <p className="text-sm text-muted-foreground">
          The driver, vehicle, and office are checked again when you dispatch the vehicle.
        </p>
      </Section>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          <Save aria-hidden="true" />
          {submitting ? 'Saving…' : dispatch === undefined ? 'Save draft' : 'Save draft changes'}
        </Button>
      </div>
    </form>
  );
}

export function calculateDispatchDistance(initial: string, final: string): string | null {
  try {
    return `${OdometerReading.from(final).distanceFrom(OdometerReading.from(initial))} km`;
  } catch {
    return null;
  }
}

function Section({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly children: React.ReactNode;
}) {
  return (
    <Card>
      <fieldset>
        <legend className="sr-only">{title}</legend>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </fieldset>
    </Card>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  readonly id: string;
  readonly label: string;
  readonly error?: string | undefined;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      <p
        id={`${id}-error`}
        className={error === undefined ? 'sr-only' : 'text-sm text-destructive'}
        aria-live="polite"
      >
        {error ?? null}
      </p>
    </div>
  );
}

function initialValues(
  options: DispatchPreparationOptionsDto,
  dispatch?: DispatchDetailDto,
): Values {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return {
    entryDate: dispatch?.entryDate ?? today,
    travelDate: dispatch?.travelDate ?? today,
    driverPublicId: dispatch?.driver.publicId ?? options.drivers[0]?.publicId ?? '',
    vehiclePublicId: dispatch?.vehicle.publicId ?? options.vehicles[0]?.publicId ?? '',
    requestingOfficePublicId:
      dispatch?.requestingOffice.publicId ?? options.offices[0]?.publicId ?? '',
    destination: dispatch?.destination ?? '',
    purpose: dispatch?.purpose ?? '',
    odoBefore: dispatch?.odoBefore ?? '',
    passengerCount: String(dispatch?.passengerCount ?? 0),
  };
}

function focusDispatchField(field?: string) {
  if (field === undefined || typeof document === 'undefined') return;
  const ids: Record<string, string> = {
    entryDate: 'dispatch-entry-date',
    travelDate: 'dispatch-travel-date',
    driverPublicId: 'dispatch-driver',
    vehiclePublicId: 'dispatch-vehicle',
    requestingOfficePublicId: 'dispatch-requesting-office',
    destination: 'dispatch-destination',
    purpose: 'dispatch-purpose',
    odoBefore: 'dispatch-odo-before',
    passengerCount: 'dispatch-passenger-count',
  };
  document.getElementById(ids[field] ?? '')?.focus();
}
