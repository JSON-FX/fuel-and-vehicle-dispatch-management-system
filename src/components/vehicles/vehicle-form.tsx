'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { VehicleAdminDto } from '@/application/vehicle/dto/vehicle-dtos';
import { FormStatus } from '@/components/forms/form-status';
import { FormFieldError } from '@/components/master-data/form-field-error';
import { ReferenceFormDialog } from '@/components/master-data/reference-form-dialog';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  MasterDataApiError,
  readMasterDataApiResponse,
} from '@/lib/master-data/master-data-form-response';

const vehicleFormSchema = z.object({
  modelBrand: z.string().trim().min(1, 'Enter the model or brand.').max(150),
  vehicleType: z.string().trim().min(1, 'Enter the vehicle type.').max(100),
  plateNumber: z.string().trim().min(1, 'Enter the plate number.').max(30),
  remarks: z.string().trim().max(2_000, 'Use at most 2,000 characters.'),
  status: z.enum(['SERVICEABLE', 'UNSERVICEABLE']).optional(),
});
type VehicleFormValues = z.infer<typeof vehicleFormSchema>;

export function VehicleCreateDialog({ csrfToken }: { readonly csrfToken: string }) {
  const [open, setOpen] = useState(false);
  return (
    <ReferenceFormDialog
      open={open}
      onOpenChange={setOpen}
      title="Create vehicle"
      description="New vehicles begin serviceable and may enter authorized operational selectors."
      trigger={
        <Button>
          <Plus aria-hidden="true" /> Create vehicle
        </Button>
      }
    >
      <VehicleForm csrfToken={csrfToken} onCreated={() => setOpen(false)} />
    </ReferenceFormDialog>
  );
}
export function VehicleEditForm({
  vehicle,
  csrfToken,
}: {
  readonly vehicle: VehicleAdminDto;
  readonly csrfToken: string;
}) {
  return <VehicleForm vehicle={vehicle} csrfToken={csrfToken} />;
}

function VehicleForm({
  vehicle,
  csrfToken,
  onCreated,
}: {
  readonly vehicle?: VehicleAdminDto;
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
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: {
      modelBrand: vehicle?.modelBrand ?? '',
      vehicleType: vehicle?.vehicleType ?? '',
      plateNumber: vehicle?.plateNumber ?? '',
      remarks: vehicle?.remarks ?? '',
      ...(vehicle === undefined ? {} : { status: vehicle.status }),
    },
  });
  const submit = handleSubmit(
    async (values) => {
      if (
        vehicle !== undefined &&
        values.status !== vehicle.status &&
        !window.confirm('Confirm this vehicle serviceability change.')
      )
        return;
      setRequestError(null);
      try {
        const response = await fetch(
          vehicle === undefined ? '/api/vehicles' : `/api/vehicles/${vehicle.publicId}`,
          {
            method: vehicle === undefined ? 'POST' : 'PATCH',
            headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
            body: JSON.stringify({ ...values, remarks: values.remarks || null }),
          },
        );
        const result = await readMasterDataApiResponse<VehicleAdminDto>(response);
        if (vehicle === undefined) {
          onCreated?.();
          router.push(`/admin/vehicles/${result.publicId}`);
          return;
        }
        router.refresh();
      } catch (caught) {
        if (caught instanceof MasterDataApiError) {
          for (const [field, message] of Object.entries(caught.fieldErrors)) {
            if (
              field === 'modelBrand' ||
              field === 'vehicleType' ||
              field === 'plateNumber' ||
              field === 'remarks' ||
              field === 'status'
            ) {
              setError(field, { message });
              setFocus(field);
              break;
            }
          }
        }
        setRequestError(
          caught instanceof Error ? caught.message : 'The vehicle could not be saved.',
        );
      }
    },
    (validationErrors) => {
      const first = ['modelBrand', 'vehicleType', 'plateNumber', 'remarks', 'status'].find(
        (field) => validationErrors[field as keyof VehicleFormValues] !== undefined,
      ) as keyof VehicleFormValues | undefined;
      if (first !== undefined) setFocus(first);
    },
  );
  return (
    <form className="space-y-4" noValidate onSubmit={submit}>
      <FormStatus message={requestError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="vehicle-model" label="Model or brand" error={errors.modelBrand?.message}>
          <Input
            id="vehicle-model"
            autoFocus={vehicle === undefined}
            aria-invalid={errors.modelBrand ? true : undefined}
            aria-describedby={errors.modelBrand ? 'vehicle-model-error' : undefined}
            {...register('modelBrand')}
          />
        </Field>
        <Field id="vehicle-type" label="Vehicle type" error={errors.vehicleType?.message}>
          <Input
            id="vehicle-type"
            aria-invalid={errors.vehicleType ? true : undefined}
            aria-describedby={errors.vehicleType ? 'vehicle-type-error' : undefined}
            {...register('vehicleType')}
          />
        </Field>
      </div>
      <Field id="vehicle-plate" label="Plate number" error={errors.plateNumber?.message}>
        <Input
          id="vehicle-plate"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={errors.plateNumber ? true : undefined}
          aria-describedby={errors.plateNumber ? 'vehicle-plate-error' : undefined}
          {...register('plateNumber')}
        />
      </Field>
      {vehicle === undefined ? null : (
        <Field id="vehicle-status" label="Serviceability" error={errors.status?.message}>
          <NativeSelect
            id="vehicle-status"
            aria-invalid={errors.status ? true : undefined}
            aria-describedby={errors.status ? 'vehicle-status-error' : undefined}
            {...register('status')}
          >
            <option value="SERVICEABLE">Serviceable</option>
            <option value="UNSERVICEABLE">Unserviceable</option>
          </NativeSelect>
        </Field>
      )}
      <Field id="vehicle-remarks" label="Remarks (optional)" error={errors.remarks?.message}>
        <Textarea
          id="vehicle-remarks"
          aria-invalid={errors.remarks ? true : undefined}
          aria-describedby={errors.remarks ? 'vehicle-remarks-error' : undefined}
          {...register('remarks')}
        />
      </Field>
      <DialogFooter>
        <Button type="submit" disabled={isSubmitting}>
          <Save aria-hidden="true" />
          {isSubmitting ? 'Saving…' : vehicle === undefined ? 'Create vehicle' : 'Save changes'}
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
