'use client';

import { ArchiveRestore, Ban, CircleCheck, LockKeyhole, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import type { BudgetAllocationAdminDto } from '@/application/budget/dto/budget-allocation-dtos';
import { FormStatus } from '@/components/forms/form-status';
import { FormFieldError } from '@/components/master-data/form-field-error';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BudgetApiError, readBudgetApiResponse } from '@/lib/budget/budget-form-response';

type BudgetAllocationAction = 'activate' | 'close' | 'cancel' | 'delete' | 'restore';

const ACTIONS = {
  activate: {
    title: 'Activate allocation',
    description: 'Confirm this draft for operational use during its fiscal period.',
    label: 'Activate allocation',
    icon: CircleCheck,
    destructive: false,
    reason: false,
  },
  close: {
    title: 'Close allocation',
    description: 'Close this active allocation. Closed allocations cannot be reopened.',
    label: 'Close allocation',
    icon: LockKeyhole,
    destructive: false,
    reason: false,
  },
  cancel: {
    title: 'Cancel allocation',
    description: 'Cancel this allocation and record the reason in its audit history.',
    label: 'Cancel allocation',
    icon: Ban,
    destructive: true,
    reason: true,
  },
  delete: {
    title: 'Delete allocation',
    description: 'Remove this record from current lists while preserving its history.',
    label: 'Delete allocation',
    icon: Trash2,
    destructive: true,
    reason: true,
  },
  restore: {
    title: 'Restore allocation',
    description: 'Restore this record. A formerly active allocation returns as draft for review.',
    label: 'Restore allocation',
    icon: ArchiveRestore,
    destructive: false,
    reason: false,
  },
} as const;

export function BudgetAllocationDetailActions({
  allocation,
  csrfToken,
}: {
  readonly allocation: BudgetAllocationAdminDto;
  readonly csrfToken: string;
}) {
  const [transitioning, setTransitioning] = useState(false);

  if (allocation.deletedAt !== null) {
    return (
      <BudgetAllocationTransitionDialog
        allocationId={allocation.publicId}
        csrfToken={csrfToken}
        action="restore"
        disabled={transitioning}
        onCompleted={() => setTransitioning(true)}
      />
    );
  }
  const actions: BudgetAllocationAction[] =
    allocation.status === 'DRAFT'
      ? ['activate', 'cancel', 'delete']
      : allocation.status === 'ACTIVE'
        ? ['close', 'cancel', 'delete']
        : ['delete'];
  return (
    <div className="flex flex-col gap-3">
      {actions.map((action) => (
        <BudgetAllocationTransitionDialog
          key={action}
          allocationId={allocation.publicId}
          csrfToken={csrfToken}
          action={action}
          disabled={transitioning}
          onCompleted={() => setTransitioning(true)}
        />
      ))}
    </div>
  );
}

function BudgetAllocationTransitionDialog({
  allocationId,
  csrfToken,
  action,
  disabled,
  onCompleted,
}: {
  readonly allocationId: string;
  readonly csrfToken: string;
  readonly action: BudgetAllocationAction;
  readonly disabled: boolean;
  readonly onCompleted: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | undefined>();
  const details = ACTIONS[action];
  const Icon = details.icon;
  const formId = `budget-allocation-${action}-${allocationId}`;

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setRequestError(null);
      setReasonError(undefined);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setRequestError(null);
    setReasonError(undefined);
    const form = new FormData(event.currentTarget);
    const reasonField = event.currentTarget.elements.namedItem('reason');
    const endpoint =
      action === 'delete' || action === 'restore'
        ? `/api/budget-allocations/${allocationId}/${action === 'delete' ? 'soft-delete' : 'restore'}`
        : `/api/budget-allocations/${allocationId}`;
    const body =
      action === 'delete'
        ? { reason: form.get('reason') }
        : action === 'restore'
          ? {}
          : action === 'cancel'
            ? { action, reason: form.get('reason') }
            : { action };
    try {
      const response = await fetch(endpoint, {
        method: action === 'delete' || action === 'restore' ? 'POST' : 'PATCH',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify(body),
      });
      await readBudgetApiResponse(response);
      setOpen(false);
      onCompleted();
      router.refresh();
    } catch (caught) {
      if (caught instanceof BudgetApiError && caught.fieldErrors.reason !== undefined) {
        setReasonError(caught.fieldErrors.reason);
        if (reasonField instanceof HTMLElement) reasonField.focus();
      }
      setRequestError(
        caught instanceof Error ? caught.message : 'The allocation could not be updated.',
      );
    } finally {
      setPending(false);
    }
  }

  const trigger: ReactNode = (
    <Button variant={details.destructive ? 'destructive' : 'outline'} disabled={disabled}>
      <Icon aria-hidden="true" /> {details.label}
    </Button>
  );

  return (
    <AlertDialog open={open} onOpenChange={changeOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{details.title}</AlertDialogTitle>
          <AlertDialogDescription>{details.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <form id={formId} className="space-y-3" onSubmit={submit}>
          <FormStatus message={requestError} />
          {details.reason ? (
            <div className="space-y-2">
              <Label htmlFor={`${formId}-reason`}>Reason</Label>
              <Textarea
                id={`${formId}-reason`}
                name="reason"
                required
                minLength={10}
                maxLength={500}
                aria-invalid={reasonError === undefined ? undefined : true}
                aria-describedby={reasonError === undefined ? undefined : `${formId}-reason-error`}
              />
              <FormFieldError id={`${formId}-reason-error`} message={reasonError} />
            </div>
          ) : null}
        </form>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep allocation</AlertDialogCancel>
          <Button
            type="submit"
            form={formId}
            variant={details.destructive ? 'destructive' : 'default'}
            disabled={pending}
          >
            {pending ? 'Working…' : details.label}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
