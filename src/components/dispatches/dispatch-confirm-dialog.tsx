'use client';

import { Route } from 'lucide-react';
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
import {
  getFreshDispatchCsrfToken,
  readDispatchApiResponse,
} from '@/lib/dispatch/dispatch-form-response';

export function DispatchConfirmDialog({ dispatch }: { readonly dispatch: DispatchDetailDto }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorSummary = useRef<HTMLDivElement>(null);

  async function confirmDispatch() {
    setError(null);
    setPending(true);
    try {
      const csrfToken = await getFreshDispatchCsrfToken();
      const response = await fetch(`/api/dispatches/${dispatch.publicId}/dispatch`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({}),
      });
      await readDispatchApiResponse(response);
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The vehicle could not be dispatched.');
      requestAnimationFrame(() => errorSummary.current?.focus());
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button className="w-full">
          <Route aria-hidden="true" /> Dispatch vehicle
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Dispatch this vehicle?</AlertDialogTitle>
          <AlertDialogDescription>
            This starts the operational trip. Draft details become read-only and the dispatch must
            later be completed or cancelled.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div ref={errorSummary} id="dispatch-confirm-error" tabIndex={-1}>
          <FormStatus message={error} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep draft</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              void confirmDispatch();
            }}
          >
            {pending ? 'Dispatching…' : 'Confirm dispatch'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
