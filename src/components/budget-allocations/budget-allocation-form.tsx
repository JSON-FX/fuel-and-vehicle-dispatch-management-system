'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { BudgetAllocationAdminDto } from '@/application/budget/dto/budget-allocation-dtos';
import type { OfficeOperationalOptionDto } from '@/application/office/dto/office-dtos';
import { FormStatus } from '@/components/forms/form-status';
import { FormFieldError } from '@/components/master-data/form-field-error';
import { ReferenceFormDialog } from '@/components/master-data/reference-form-dialog';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { BudgetApiError, readBudgetApiResponse } from '@/lib/budget/budget-form-response';

export const QUARTER_OPTIONS = [
  { value: 1, label: 'Quarter 1' },
  { value: 2, label: 'Quarter 2' },
  { value: 3, label: 'Quarter 3' },
  { value: 4, label: 'Quarter 4' },
] as const;

const budgetAllocationFormSchema = z.object({
  ppmpNumber: z
    .string()
    .trim()
    .min(1, 'Enter the PPMP number.')
    .max(80, 'Use at most 80 characters.'),
  officePublicId: z.string().min(1, 'Select an office.'),
  fiscalYear: z.number().int().min(2000, 'Use a fiscal year from 2000 through 9999.').max(9999),
  quarter: z.number().int().min(1).max(4),
});

type BudgetAllocationFormValues = z.infer<typeof budgetAllocationFormSchema>;

export function BudgetAllocationCreateDialog({
  csrfToken,
  offices,
  defaultFiscalYear,
  defaultQuarter,
}: {
  readonly csrfToken: string;
  readonly offices: readonly OfficeOperationalOptionDto[];
  readonly defaultFiscalYear: number;
  readonly defaultQuarter: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <ReferenceFormDialog
      open={open}
      onOpenChange={setOpen}
      title="Create budget allocation"
      description="Create a draft allocation for an active office and fiscal period."
      trigger={
        <Button disabled={offices.length === 0}>
          <Plus aria-hidden="true" /> Create allocation
        </Button>
      }
    >
      <BudgetAllocationForm
        csrfToken={csrfToken}
        offices={offices}
        defaultFiscalYear={defaultFiscalYear}
        defaultQuarter={defaultQuarter}
        onCreated={() => setOpen(false)}
      />
    </ReferenceFormDialog>
  );
}

export function BudgetAllocationEditForm({
  allocation,
  offices,
  csrfToken,
}: {
  readonly allocation: BudgetAllocationAdminDto;
  readonly offices: readonly OfficeOperationalOptionDto[];
  readonly csrfToken: string;
}) {
  return <BudgetAllocationForm allocation={allocation} offices={offices} csrfToken={csrfToken} />;
}

function BudgetAllocationForm({
  allocation,
  offices,
  csrfToken,
  defaultFiscalYear,
  defaultQuarter,
  onCreated,
}: {
  readonly allocation?: BudgetAllocationAdminDto;
  readonly offices: readonly OfficeOperationalOptionDto[];
  readonly csrfToken: string;
  readonly defaultFiscalYear?: number;
  readonly defaultQuarter?: number;
  readonly onCreated?: () => void;
}) {
  const router = useRouter();
  const [requestError, setRequestError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { dirtyFields, errors, isDirty, isSubmitting },
  } = useForm<BudgetAllocationFormValues>({
    resolver: zodResolver(budgetAllocationFormSchema),
    defaultValues: {
      ppmpNumber: allocation?.ppmpNumber ?? '',
      officePublicId: allocation?.office.publicId ?? offices[0]?.publicId ?? '',
      fiscalYear: allocation?.fiscalYear ?? defaultFiscalYear ?? 2000,
      quarter: allocation?.quarter ?? defaultQuarter ?? 1,
    },
  });
  const officeOptions = includeCurrentOffice(offices, allocation);
  const submit = handleSubmit(
    async (values) => {
      setRequestError(null);
      const body =
        allocation === undefined
          ? values
          : {
              action: 'update',
              ...(dirtyFields.ppmpNumber ? { ppmpNumber: values.ppmpNumber } : {}),
              ...(dirtyFields.officePublicId ? { officePublicId: values.officePublicId } : {}),
              ...(dirtyFields.fiscalYear ? { fiscalYear: values.fiscalYear } : {}),
              ...(dirtyFields.quarter ? { quarter: values.quarter } : {}),
            };
      try {
        const response = await fetch(
          allocation === undefined
            ? '/api/budget-allocations'
            : `/api/budget-allocations/${allocation.publicId}`,
          {
            method: allocation === undefined ? 'POST' : 'PATCH',
            headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
            body: JSON.stringify(body),
          },
        );
        const result = await readBudgetApiResponse<BudgetAllocationAdminDto>(response);
        if (allocation === undefined) {
          onCreated?.();
          router.push(`/budget-allocations/${result.publicId}`);
          return;
        }
        router.refresh();
      } catch (caught) {
        if (caught instanceof BudgetApiError) {
          for (const field of ['ppmpNumber', 'officePublicId', 'fiscalYear', 'quarter'] as const) {
            const message = caught.fieldErrors[field];
            if (message !== undefined) {
              setError(field, { message });
              setFocus(field);
              break;
            }
          }
        }
        setRequestError(
          caught instanceof Error ? caught.message : 'The budget allocation could not be saved.',
        );
      }
    },
    (validationErrors) => {
      const first = ['ppmpNumber', 'officePublicId', 'fiscalYear', 'quarter'].find(
        (field) => validationErrors[field as keyof BudgetAllocationFormValues] !== undefined,
      ) as keyof BudgetAllocationFormValues | undefined;
      if (first !== undefined) setFocus(first);
    },
  );

  return (
    <form className="space-y-4" noValidate onSubmit={submit}>
      <FormStatus message={requestError} />
      <Field id="budget-ppmp" label="PPMP number" error={errors.ppmpNumber?.message}>
        <Input
          id="budget-ppmp"
          autoFocus={allocation === undefined}
          maxLength={80}
          aria-invalid={errors.ppmpNumber ? true : undefined}
          aria-describedby={
            errors.ppmpNumber ? 'budget-ppmp-help budget-ppmp-error' : 'budget-ppmp-help'
          }
          {...register('ppmpNumber')}
        />
        <p id="budget-ppmp-help" className="text-sm text-muted-foreground">
          Letters are stored in uppercase. Punctuation and leading zeros are preserved.
        </p>
      </Field>
      <Field id="budget-office" label="Office" error={errors.officePublicId?.message}>
        <NativeSelect
          id="budget-office"
          aria-invalid={errors.officePublicId ? true : undefined}
          aria-describedby={errors.officePublicId ? 'budget-office-error' : undefined}
          {...register('officePublicId')}
        >
          {officeOptions.map((office) => (
            <option key={office.publicId} value={office.publicId}>
              {office.name} ({office.abbreviation})
            </option>
          ))}
        </NativeSelect>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="budget-allocation-fiscal-year"
          label="Fiscal year"
          error={errors.fiscalYear?.message}
        >
          <Input
            id="budget-allocation-fiscal-year"
            type="number"
            inputMode="numeric"
            min={2000}
            max={9999}
            step={1}
            aria-invalid={errors.fiscalYear ? true : undefined}
            aria-describedby={errors.fiscalYear ? 'budget-allocation-fiscal-year-error' : undefined}
            {...register('fiscalYear', { valueAsNumber: true })}
          />
        </Field>
        <Field id="budget-allocation-quarter" label="Quarter" error={errors.quarter?.message}>
          <NativeSelect
            id="budget-allocation-quarter"
            aria-invalid={errors.quarter ? true : undefined}
            aria-describedby={errors.quarter ? 'budget-allocation-quarter-error' : undefined}
            {...register('quarter', { valueAsNumber: true })}
          >
            {QUARTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isSubmitting || (allocation !== undefined && !isDirty)}>
          <Save aria-hidden="true" />
          {isSubmitting
            ? 'Saving…'
            : allocation === undefined
              ? 'Create allocation'
              : 'Save draft changes'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function includeCurrentOffice(
  offices: readonly OfficeOperationalOptionDto[],
  allocation?: BudgetAllocationAdminDto,
): readonly OfficeOperationalOptionDto[] {
  if (
    allocation === undefined ||
    offices.some((office) => office.publicId === allocation.office.publicId)
  ) {
    return offices;
  }
  return [allocation.office, ...offices];
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
