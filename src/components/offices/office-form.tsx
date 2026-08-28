'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { OfficeAdminDto } from '@/application/office/dto/office-dtos';
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

const officeFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter the office name.').max(150),
  abbreviation: z.string().trim().min(1, 'Enter the office abbreviation.').max(30),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});
type OfficeFormValues = z.infer<typeof officeFormSchema>;

export function OfficeCreateDialog({ csrfToken }: { readonly csrfToken: string }) {
  const [open, setOpen] = useState(false);
  return (
    <ReferenceFormDialog
      open={open}
      onOpenChange={setOpen}
      title="Create office"
      description="New offices begin active and are available to authorized selectors."
      trigger={
        <Button>
          <Plus aria-hidden="true" /> Create office
        </Button>
      }
    >
      <OfficeForm csrfToken={csrfToken} onCreated={() => setOpen(false)} />
    </ReferenceFormDialog>
  );
}

export function OfficeEditForm({
  office,
  csrfToken,
}: {
  readonly office: OfficeAdminDto;
  readonly csrfToken: string;
}) {
  return <OfficeForm office={office} csrfToken={csrfToken} />;
}

function OfficeForm({
  office,
  csrfToken,
  onCreated,
}: {
  readonly office?: OfficeAdminDto;
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
  } = useForm<OfficeFormValues>({
    resolver: zodResolver(officeFormSchema),
    defaultValues: {
      name: office?.name ?? '',
      abbreviation: office?.abbreviation ?? '',
      ...(office === undefined ? {} : { status: office.status }),
    },
  });

  const submit = handleSubmit(
    async (values) => {
      if (
        office !== undefined &&
        values.status !== office.status &&
        !window.confirm('Confirm this office status change.')
      ) {
        return;
      }
      setRequestError(null);
      try {
        const response = await fetch(
          office === undefined ? '/api/offices' : `/api/offices/${office.publicId}`,
          {
            method: office === undefined ? 'POST' : 'PATCH',
            headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
            body: JSON.stringify(values),
          },
        );
        const result = await readMasterDataApiResponse<OfficeAdminDto>(response);
        if (office === undefined) {
          onCreated?.();
          router.push(`/admin/offices/${result.publicId}`);
          return;
        }
        router.refresh();
      } catch (caught) {
        if (caught instanceof MasterDataApiError) {
          for (const [field, message] of Object.entries(caught.fieldErrors)) {
            if (field === 'name' || field === 'abbreviation' || field === 'status') {
              setError(field, { message });
              setFocus(field);
              break;
            }
          }
        }
        setRequestError(
          caught instanceof Error ? caught.message : 'The office could not be saved.',
        );
      }
    },
    (validationErrors) => {
      const first = ['name', 'abbreviation', 'status'].find(
        (field) => validationErrors[field as keyof OfficeFormValues] !== undefined,
      ) as keyof OfficeFormValues | undefined;
      if (first !== undefined) setFocus(first);
    },
  );

  return (
    <form className="space-y-4" noValidate onSubmit={submit}>
      <FormStatus message={requestError} />
      <Field id="office-name" label="Office name" error={errors.name?.message}>
        <Input
          id="office-name"
          autoFocus={office === undefined}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? 'office-name-error' : undefined}
          {...register('name')}
        />
      </Field>
      <Field
        id="office-abbreviation"
        label="Office abbreviation"
        error={errors.abbreviation?.message}
      >
        <Input
          id="office-abbreviation"
          autoCapitalize="characters"
          aria-invalid={errors.abbreviation ? true : undefined}
          aria-describedby={errors.abbreviation ? 'office-abbreviation-error' : undefined}
          {...register('abbreviation')}
        />
      </Field>
      {office === undefined ? null : (
        <Field id="office-status" label="Operational status" error={errors.status?.message}>
          <NativeSelect
            id="office-status"
            aria-invalid={errors.status ? true : undefined}
            aria-describedby={errors.status ? 'office-status-error' : undefined}
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
          {isSubmitting ? 'Saving…' : office === undefined ? 'Create office' : 'Save changes'}
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
