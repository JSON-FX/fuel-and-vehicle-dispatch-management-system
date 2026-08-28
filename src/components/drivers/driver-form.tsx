'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { DriverAdminDto } from '@/application/driver/dto/driver-dtos';
import { FormStatus } from '@/components/forms/form-status';
import { FormFieldError } from '@/components/master-data/form-field-error';
import { ReferenceFormDialog } from '@/components/master-data/reference-form-dialog';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  MasterDataApiError,
  readMasterDataApiResponse,
} from '@/lib/master-data/master-data-form-response';

const driverFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter the driver name.').max(150),
  contactNumber: z.string().trim().max(50, 'Use at most 50 characters.'),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});
type DriverFormValues = z.infer<typeof driverFormSchema>;

export function DriverCreateDialog({ csrfToken }: { readonly csrfToken: string }) {
  const [open, setOpen] = useState(false);
  return (
    <ReferenceFormDialog
      open={open}
      onOpenChange={setOpen}
      title="Create driver"
      description="Contact numbers are optional personal data and visible only to authorized managers."
      trigger={
        <Button>
          <Plus aria-hidden="true" /> Create driver
        </Button>
      }
    >
      <DriverForm csrfToken={csrfToken} onCreated={() => setOpen(false)} />
    </ReferenceFormDialog>
  );
}

export function DriverEditForm({
  driver,
  csrfToken,
}: {
  readonly driver: DriverAdminDto;
  readonly csrfToken: string;
}) {
  return <DriverForm driver={driver} csrfToken={csrfToken} />;
}

function DriverForm({
  driver,
  csrfToken,
  onCreated,
}: {
  readonly driver?: DriverAdminDto;
  readonly csrfToken: string;
  readonly onCreated?: () => void;
}) {
  const router = useRouter();
  const [requestError, setRequestError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<DriverFormValues>({
    resolver: zodResolver(driverFormSchema),
    defaultValues: {
      name: driver?.name ?? '',
      contactNumber: driver?.contactNumber ?? '',
      ...(driver === undefined ? {} : { status: driver.status }),
    },
  });
  const submit = handleSubmit(
    async (values) => {
      if (
        driver !== undefined &&
        values.status !== driver.status &&
        !window.confirm('Confirm this driver status change.')
      )
        return;
      setRequestError(null);
      try {
        const response = await fetch(
          driver === undefined ? '/api/drivers' : `/api/drivers/${driver.publicId}`,
          {
            method: driver === undefined ? 'POST' : 'PATCH',
            headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
            body: JSON.stringify({ ...values, contactNumber: values.contactNumber || null }),
          },
        );
        const result = await readMasterDataApiResponse<DriverAdminDto>(response);
        if (driver === undefined) {
          onCreated?.();
          router.push(`/admin/drivers/${result.publicId}`);
          return;
        }
        router.refresh();
      } catch (caught) {
        if (caught instanceof MasterDataApiError) {
          for (const [field, message] of Object.entries(caught.fieldErrors)) {
            if (field === 'name' || field === 'contactNumber' || field === 'status') {
              setError(field, { message });
              setFocus(field);
              break;
            }
          }
        }
        setRequestError(
          caught instanceof Error ? caught.message : 'The driver could not be saved.',
        );
      }
    },
    (validationErrors) => {
      const first = ['name', 'contactNumber', 'status'].find(
        (field) => validationErrors[field as keyof DriverFormValues] !== undefined,
      ) as keyof DriverFormValues | undefined;
      if (first !== undefined) setFocus(first);
    },
  );
  return (
    <form className="space-y-4" noValidate onSubmit={submit}>
      <FormStatus message={requestError} />
      <Field id="driver-name" label="Driver name" error={errors.name?.message}>
        <Input
          id="driver-name"
          autoFocus={driver === undefined}
          autoComplete="name"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? 'driver-name-error' : undefined}
          {...register('name')}
        />
      </Field>
      <Field
        id="driver-contact"
        label="Contact number (optional)"
        error={errors.contactNumber?.message}
      >
        <Input
          id="driver-contact"
          type="tel"
          autoComplete="tel"
          aria-invalid={errors.contactNumber ? true : undefined}
          aria-describedby="driver-contact-help driver-contact-error"
          {...register('contactNumber')}
        />
        <p id="driver-contact-help" className="text-sm text-muted-foreground">
          Personal data. It is excluded from selectors and audit snapshots.
        </p>
      </Field>
      {driver === undefined ? null : (
        <Field id="driver-status" label="Operational status" error={errors.status?.message}>
          <NativeSelect
            id="driver-status"
            aria-invalid={errors.status ? true : undefined}
            aria-describedby={errors.status ? 'driver-status-error' : undefined}
            {...register('status')}
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </NativeSelect>
        </Field>
      )}
      <DialogFooter>
        <Button type="submit" disabled={isSubmitting}>
          <Save aria-hidden="true" />
          {isSubmitting ? 'Saving…' : driver === undefined ? 'Create driver' : 'Save changes'}
        </Button>
      </DialogFooter>
    </form>
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
