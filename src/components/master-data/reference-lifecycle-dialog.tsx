'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

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
import {
  MasterDataApiError,
  readMasterDataApiResponse,
} from '@/lib/master-data/master-data-form-response';

export function ReferenceLifecycleDialog({
  title,
  description,
  actionLabel,
  endpoint,
  csrfToken,
  trigger,
  requireReason,
}: {
  readonly title: string;
  readonly description: string;
  readonly actionLabel: string;
  readonly endpoint: string;
  readonly csrfToken: string;
  readonly trigger: ReactNode;
  readonly requireReason: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | undefined>();
  const formId = `reference-lifecycle-${endpoint.replaceAll('/', '-')}`;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setReasonError(undefined);
    const form = new FormData(event.currentTarget);
    const reasonField = event.currentTarget.elements.namedItem('reason');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify(requireReason ? { reason: form.get('reason') } : {}),
      });
      await readMasterDataApiResponse(response);
      setOpen(false);
      router.refresh();
    } catch (caught) {
      if (caught instanceof MasterDataApiError && caught.fieldErrors.reason !== undefined) {
        setReasonError(caught.fieldErrors.reason);
        if (reasonField instanceof HTMLElement) reasonField.focus();
      }
      setError(caught instanceof Error ? caught.message : 'The action could not be completed.');
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <form id={formId} className="space-y-3" onSubmit={submit}>
          <FormStatus message={error} />
          {requireReason ? (
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
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            type="submit"
            form={formId}
            variant={requireReason ? 'destructive' : 'default'}
            disabled={pending}
          >
            {pending ? 'Working…' : actionLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
