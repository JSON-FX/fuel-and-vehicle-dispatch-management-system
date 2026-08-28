'use client';

import { Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import type { BudgetAllocationOperationalOptionDto } from '@/application/budget/dto/budget-allocation-dtos';
import type { FuelIssuanceDto, FuelPreparationOptionsDto } from '@/application/fuel/dto/fuel-dtos';
import { FormStatus } from '@/components/forms/form-status';
import { FormFieldError } from '@/components/master-data/form-field-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { FuelApiError, readFuelApiResponse } from '@/lib/fuel/fuel-form-response';
import { createFuelIssuanceSchema } from '@/lib/fuel/route-schemas';

type Values = {
  purchaseRequestNumber: string;
  entryDate: string;
  driverPublicId: string;
  destination: string;
  purpose: string;
  vehiclePublicId: string;
  requestedLiters: string;
  isFullTank: boolean;
  issuedLiters: string;
  unitPrice: string;
  budgetAllocationPublicId: string;
  fuelType: 'DIESEL' | 'GASOLINE';
};

export function FuelIssuanceDraftForm({
  csrfToken,
  options,
  issuance,
}: {
  readonly csrfToken: string;
  readonly options: FuelPreparationOptionsDto;
  readonly issuance?: FuelIssuanceDto;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(() => initialValues(options, issuance));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [availableAllocations, setAvailableAllocations] = useState<
    readonly BudgetAllocationOperationalOptionDto[]
  >(options.allocations);
  const [allocationStatus, setAllocationStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const allocations = useMemo(
    () =>
      availableAllocations.filter((allocation) => eligibleForDate(allocation, values.entryDate)),
    [availableAllocations, values.entryDate],
  );
  const selectedVehicle = options.vehicles.find(
    (vehicle) => vehicle.publicId === values.vehiclePublicId,
  );

  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.entryDate)) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(
          `/api/fuel-preparation-options?entryDate=${encodeURIComponent(values.entryDate)}`,
          { headers: { accept: 'application/json' }, signal: controller.signal },
        );
        const refreshed = await readFuelApiResponse<FuelPreparationOptionsDto>(response);
        setAvailableAllocations(refreshed.allocations);
        setValues((current) => ({
          ...current,
          budgetAllocationPublicId: refreshed.allocations.some(
            (allocation) => allocation.publicId === current.budgetAllocationPublicId,
          )
            ? current.budgetAllocationPublicId
            : (refreshed.allocations[0]?.publicId ?? ''),
        }));
        setAllocationStatus('idle');
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        setAvailableAllocations([]);
        setAllocationStatus('error');
      }
    })();
    return () => controller.abort();
  }, [values.entryDate]);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    if (key === 'entryDate') {
      const hasCompleteDate = /^\d{4}-\d{2}-\d{2}$/.test(String(value));
      setAllocationStatus(hasCompleteDate ? 'loading' : 'idle');
      if (!hasCompleteDate) setAvailableAllocations([]);
    }
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === 'entryDate') {
        const selected = options.allocations.find(
          (allocation) => allocation.publicId === current.budgetAllocationPublicId,
        );
        if (selected !== undefined && !eligibleForDate(selected, String(value)))
          next.budgetAllocationPublicId = '';
      }
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestError(null);
    setFieldErrors({});
    const parsed = createFuelIssuanceSchema.safeParse({
      ...values,
      requestedLiters: values.isFullTank ? null : values.requestedLiters,
      issuedLiters: values.issuedLiters.trim() === '' ? null : values.issuedLiters,
    });
    if (!parsed.success) {
      const errors = Object.fromEntries(
        parsed.error.issues.map((issue) => [String(issue.path[0] ?? 'form'), issue.message]),
      );
      setFieldErrors(errors);
      setRequestError('Review the highlighted fields and try again.');
      focusField(Object.keys(errors)[0]);
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(
        issuance === undefined ? '/api/fuel-issuances' : `/api/fuel-issuances/${issuance.publicId}`,
        {
          method: issuance === undefined ? 'POST' : 'PATCH',
          headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
          body: JSON.stringify(parsed.data),
        },
      );
      const saved = await readFuelApiResponse<FuelIssuanceDto>(response);
      if (issuance === undefined) router.push(`/fuel-issuances/${saved.publicId}`);
      else router.replace(`/fuel-issuances/${saved.publicId}`);
    } catch (error) {
      if (error instanceof FuelApiError) {
        setFieldErrors({ ...error.fieldErrors });
        focusField(Object.keys(error.fieldErrors)[0]);
      }
      setRequestError(
        error instanceof Error ? error.message : 'The fuel issuance could not be saved.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-6" noValidate onSubmit={submit}>
      <FormStatus message={requestError} />
      <Section
        title="Request details"
        description="Record the authoritative request date and operational purpose."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="fuel-pr"
            label="Purchase request number"
            error={fieldErrors.purchaseRequestNumber}
          >
            <Input
              id="fuel-pr"
              value={values.purchaseRequestNumber}
              onChange={(event) => set('purchaseRequestNumber', event.target.value)}
              maxLength={80}
            />
          </Field>
          <Field id="fuel-entry-date" label="Entry date" error={fieldErrors.entryDate}>
            <Input
              id="fuel-entry-date"
              type="date"
              value={values.entryDate}
              onChange={(event) => set('entryDate', event.target.value)}
            />
          </Field>
        </div>
        <Field id="fuel-purpose" label="Purpose" error={fieldErrors.purpose}>
          <Textarea
            id="fuel-purpose"
            value={values.purpose}
            onChange={(event) => set('purpose', event.target.value)}
            maxLength={1000}
          />
        </Field>
      </Section>
      <Section
        title="Dispatch details"
        description="Choose current operational records. Vehicle type is derived from the selected vehicle."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="fuel-driver" label="Driver" error={fieldErrors.driverPublicId}>
            <NativeSelect
              id="fuel-driver"
              value={values.driverPublicId}
              onChange={(event) => set('driverPublicId', event.target.value)}
            >
              <option value="">Select a driver</option>
              {options.drivers.map((driver) => (
                <option key={driver.publicId} value={driver.publicId}>
                  {driver.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="fuel-destination" label="Destination" error={fieldErrors.destination}>
            <Input
              id="fuel-destination"
              value={values.destination}
              onChange={(event) => set('destination', event.target.value)}
              maxLength={255}
            />
          </Field>
          <Field id="fuel-vehicle" label="Vehicle" error={fieldErrors.vehiclePublicId}>
            <NativeSelect
              id="fuel-vehicle"
              value={values.vehiclePublicId}
              onChange={(event) => set('vehiclePublicId', event.target.value)}
            >
              <option value="">Select a vehicle</option>
              {options.vehicles.map((vehicle) => (
                <option key={vehicle.publicId} value={vehicle.publicId}>
                  {vehicle.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="space-y-2">
            <span className="block text-sm font-semibold">Vehicle type</span>
            <p className="min-h-11 rounded-md border bg-muted px-3 py-2">
              {selectedVehicle?.vehicleType ?? 'Select a vehicle'}
            </p>
          </div>
        </div>
      </Section>
      <Section
        title="Quantity"
        description="A full-tank request has no requested quantity. Actual liters may remain blank until posting."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="fuel-type-select" label="Fuel type" error={fieldErrors.fuelType}>
            <NativeSelect
              id="fuel-type-select"
              value={values.fuelType}
              onChange={(event) => set('fuelType', event.target.value as Values['fuelType'])}
            >
              <option value="DIESEL">Diesel</option>
              <option value="GASOLINE">Gasoline</option>
            </NativeSelect>
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Request mode</legend>
            <label className="flex min-h-11 items-center gap-2 rounded-md border px-3">
              <input
                type="checkbox"
                checked={values.isFullTank}
                onChange={(event) => set('isFullTank', event.target.checked)}
              />{' '}
              Full tank
            </label>
          </fieldset>
          {values.isFullTank ? null : (
            <Field
              id="fuel-requested-liters"
              label="Requested liters"
              error={fieldErrors.requestedLiters}
            >
              <Input
                id="fuel-requested-liters"
                inputMode="decimal"
                value={values.requestedLiters}
                onChange={(event) => set('requestedLiters', event.target.value)}
              />
            </Field>
          )}
          <Field
            id="fuel-issued-liters"
            label="Actual issued liters (optional in draft)"
            error={fieldErrors.issuedLiters}
          >
            <Input
              id="fuel-issued-liters"
              inputMode="decimal"
              value={values.issuedLiters}
              onChange={(event) => set('issuedLiters', event.target.value)}
            />
          </Field>
        </div>
      </Section>
      <Section
        title="Pricing"
        description="The server calculates the authoritative total once the issuance is posted."
      >
        <Field id="fuel-unit-price" label="Unit price per liter" error={fieldErrors.unitPrice}>
          <Input
            id="fuel-unit-price"
            inputMode="decimal"
            value={values.unitPrice}
            onChange={(event) => set('unitPrice', event.target.value)}
          />
        </Field>
      </Section>
      <Section
        title="Budget allocation"
        description="Only active allocations eligible for the entry date are available."
      >
        <Field
          id="fuel-allocation"
          label="PPMP allocation"
          error={fieldErrors.budgetAllocationPublicId}
        >
          <NativeSelect
            id="fuel-allocation"
            value={values.budgetAllocationPublicId}
            disabled={allocationStatus === 'loading'}
            onChange={(event) => set('budgetAllocationPublicId', event.target.value)}
          >
            <option value="">Select an allocation</option>
            {allocations.map((allocation) => (
              <option key={allocation.publicId} value={allocation.publicId}>
                {allocation.ppmpNumber} · {allocation.office.abbreviation} · FY{' '}
                {allocation.fiscalYear} Q{allocation.quarter}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {allocationStatus === 'loading' ? (
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
            Refreshing eligible allocations…
          </p>
        ) : allocationStatus === 'error' ? (
          <p className="text-sm text-destructive" role="alert">
            Eligible allocations could not be refreshed. Change the entry date to retry.
          </p>
        ) : allocations.length === 0 ? (
          <p className="text-sm text-warning" role="status">
            No active allocation matches this entry date.
          </p>
        ) : null}
      </Section>
      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          <Save aria-hidden="true" />
          {submitting ? 'Saving…' : issuance === undefined ? 'Save draft' : 'Save draft changes'}
        </Button>
      </div>
    </form>
  );
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
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
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
      <FormFieldError id={`${id}-error`} message={error} />
    </div>
  );
}
function initialValues(options: FuelPreparationOptionsDto, issuance?: FuelIssuanceDto): Values {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return {
    purchaseRequestNumber: issuance?.purchaseRequestNumber ?? '',
    entryDate: issuance?.entryDate ?? today,
    driverPublicId: issuance?.driver.publicId ?? options.drivers[0]?.publicId ?? '',
    destination: issuance?.destination ?? 'AOR',
    purpose: issuance?.purpose ?? '',
    vehiclePublicId: issuance?.vehicle.publicId ?? options.vehicles[0]?.publicId ?? '',
    requestedLiters: issuance?.requestedLiters ?? '',
    isFullTank: issuance?.isFullTank ?? false,
    issuedLiters: issuance?.issuedLiters ?? issuance?.requestedLiters ?? '',
    unitPrice: issuance?.unitPrice ?? '',
    budgetAllocationPublicId:
      issuance?.allocation.publicId ?? options.allocations[0]?.publicId ?? '',
    fuelType: issuance?.fuelType ?? 'DIESEL',
  };
}
function eligibleForDate(
  allocation: FuelPreparationOptionsDto['allocations'][number],
  date: string,
) {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(date);
  if (match === null) return false;
  return (
    allocation.fiscalYear === Number(match[1]) &&
    allocation.quarter === Math.ceil(Number(match[2]) / 3)
  );
}
function focusField(field?: string) {
  if (field === undefined || typeof document === 'undefined') return;
  const ids: Record<string, string> = {
    purchaseRequestNumber: 'fuel-pr',
    entryDate: 'fuel-entry-date',
    driverPublicId: 'fuel-driver',
    destination: 'fuel-destination',
    purpose: 'fuel-purpose',
    vehiclePublicId: 'fuel-vehicle',
    requestedLiters: 'fuel-requested-liters',
    issuedLiters: 'fuel-issued-liters',
    unitPrice: 'fuel-unit-price',
    budgetAllocationPublicId: 'fuel-allocation',
    fuelType: 'fuel-type-select',
  };
  document.getElementById(ids[field] ?? '')?.focus();
}
