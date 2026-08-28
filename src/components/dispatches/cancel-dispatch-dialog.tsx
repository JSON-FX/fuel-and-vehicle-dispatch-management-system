'use client';

import { CircleX } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import type { DispatchDetailDto } from '@/application/dispatch/dto/dispatch-dtos';
import { FormStatus } from '@/components/forms/form-status';
import {
  AlertDialog,
  AlertDialogAction,
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
  DispatchApiError,
  getFreshDispatchCsrfToken,
  readDispatchApiResponse,
} from '@/lib/dispatch/dispatch-form-response';

export function CancelDispatchDialog({ dispatch }: { readonly dispatch: DispatchDetailDto }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const reasonInput = useRef<HTMLTextAreaElement>(null);

  async function cancel() {
    setError(null);
    setPending(true);
    try {
      const csrfToken = await getFreshDispatchCsrfToken();
      const response = await fetch(`/api/dispatches/${dispatch.publicId}/cancel`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ reason }),
      });
      await readDispatchApiResponse(response);
      setOpen(false);
      router.refresh();
    } catch (caught) {
      const message =
        caught instanceof DispatchApiError
          ? (caught.fieldErrors.reason ?? caught.message)
          : caught instanceof Error
            ? caught.message
            : 'The dispatch could not be cancelled.';
      setError(message);
      requestAnimationFrame(() => {
        if (caught instanceof DispatchApiError && caught.fieldErrors.reason !== undefined) {
          reasonInput.current?.focus();
        } else {
          errorSummary.current?.focus();
        }
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="w-full">
          <CircleX aria-hidden="true" /> Cancel dispatch
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this dispatch?</AlertDialogTitle>
          <AlertDialogDescription>
            Cancellation is terminal. The reason becomes permanent audit evidence for this trip.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div ref={errorSummary} id="cancel-dispatch-error" tabIndex={-1}>
          <FormStatus message={error} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dispatch-cancellation-reason">Reason</Label>
          <Textarea
            ref={reasonInput}
            id="dispatch-cancellation-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={10}
            maxLength={500}
            autoFocus
            aria-describedby="dispatch-cancellation-help"
            aria-invalid={error !== null}
          />
          <p id="dispatch-cancellation-help" className="text-sm text-muted-foreground">
            Provide 10 to 500 characters for the audit record.
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep dispatch</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={pending || reason.trim().length < 10}
            onClick={(event) => {
              event.preventDefault();
              void cancel();
            }}
          >
            {pending ? 'Cancelling…' : 'Cancel dispatch'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
